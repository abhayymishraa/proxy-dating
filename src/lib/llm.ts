import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import type { ResponseInputContent, ResponseInputItem } from "openai/resources/responses/responses";
import { GoogleGenAI, ThinkingLevel, type Content, type Part } from "@google/genai";
import { z } from "zod/v4";

// First provider with a key wins: Anthropic, then Gemini, then OpenAI. Force with LLM_PROVIDER.
const GEMINI_KEY = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
const PROVIDER = process.env.LLM_PROVIDER
  ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : GEMINI_KEY ? "gemini" : "openai");
const DEFAULT_MODEL = { anthropic: "claude-opus-5-5", gemini: "gemini-3.8-flash", openai: "gpt-5.6" };
export const MODEL = process.env.LLM_MODEL ?? DEFAULT_MODEL[PROVIDER as keyof typeof DEFAULT_MODEL];

type Effort = "low" | "medium" | "high";
type Opts = { system: string; messages: BetaMessageParam[]; effort?: Effort };

// ---------- Anthropic ----------
let anthropic: Anthropic | undefined;
// Server-side fallback: a classifier false positive reroutes instead of failing the date.
const common = () => ({ model: MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const });

async function anthropicJSON<T extends z.ZodType>(o: Opts & { schema: T; maxTokens?: number }) {
  const res = await (anthropic ??= new Anthropic()).beta.messages.parse({
    ...common(),
    max_tokens: o.maxTokens ?? 16000,
    system: o.system,
    messages: o.messages,
    output_config: { effort: o.effort ?? "medium", format: betaZodOutputFormat(o.schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("Model declined this request");
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason=${res.stop_reason})`);
  return res.parsed_output as z.infer<T>;
}

async function anthropicText(o: Opts) {
  const res = await (anthropic ??= new Anthropic()).beta.messages.create({
    ...common(),
    max_tokens: 4000,
    system: o.system,
    messages: o.messages,
    output_config: { effort: o.effort ?? "low" },
  });
  if (res.stop_reason === "refusal") throw new Error("Model declined this request");
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
}

// ---------- OpenAI (Responses API) ----------
let openai: OpenAI | undefined;

// Agents build Anthropic-shaped messages; translate text + base64 image blocks for OpenAI.
function toOpenAI(messages: BetaMessageParam[]): ResponseInputItem[] {
  return messages.map((m) => {
    if (typeof m.content === "string" || m.role === "assistant") {
      const text = typeof m.content === "string" ? m.content
        : m.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n");
      return { role: m.role, content: text };
    }
    return {
      role: "user",
      content: m.content.flatMap((b): ResponseInputContent[] =>
        b.type === "text" ? [{ type: "input_text", text: b.text }]
        : b.type === "image" && b.source.type === "base64"
          ? [{ type: "input_image", detail: "auto", image_url: `data:${b.source.media_type};base64,${b.source.data}` }]
          : []),
    };
  });
}

async function openaiJSON<T extends z.ZodType>(o: Opts & { schema: T; maxTokens?: number }) {
  const res = await (openai ??= new OpenAI()).responses.parse({
    model: MODEL,
    instructions: o.system,
    input: toOpenAI(o.messages),
    reasoning: { effort: o.effort ?? "medium" },
    max_output_tokens: o.maxTokens ?? 16000,
    text: { format: zodTextFormat(o.schema, "output") },
  });
  if (!res.output_parsed) throw new Error(`No structured output (status=${res.status})`);
  return res.output_parsed as z.infer<T>;
}

async function openaiText(o: Opts) {
  const res = await (openai ??= new OpenAI()).responses.create({
    model: MODEL,
    instructions: o.system,
    input: toOpenAI(o.messages),
    reasoning: { effort: o.effort ?? "low" },
    max_output_tokens: 4000,
  });
  return res.output_text.trim();
}

// ---------- Gemini ----------
let gemini: GoogleGenAI | undefined;
const LEVEL = { low: ThinkingLevel.LOW, medium: ThinkingLevel.MEDIUM, high: ThinkingLevel.HIGH };

function toGemini(messages: BetaMessageParam[]): Content[] {
  return messages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: typeof m.content === "string" ? [{ text: m.content }] : m.content.flatMap((b): Part[] =>
      b.type === "text" ? [{ text: b.text }]
      : b.type === "image" && b.source.type === "base64" ? [{ inlineData: { mimeType: b.source.media_type, data: b.source.data } }]
      : []),
  }));
}

async function geminiCall(o: Opts, effort: Effort, extra: object) {
  const res = await (gemini ??= new GoogleGenAI({ apiKey: GEMINI_KEY })).models.generateContent({
    model: MODEL,
    contents: toGemini(o.messages),
    config: { systemInstruction: o.system, thinkingConfig: { thinkingLevel: LEVEL[o.effort ?? effort] }, ...extra },
  });
  if (!res.text) throw new Error(`Empty response (finish=${res.candidates?.[0]?.finishReason ?? res.promptFeedback?.blockReason})`);
  return res.text;
}

async function geminiJSON<T extends z.ZodType>(o: Opts & { schema: T; maxTokens?: number }) {
  const text = await geminiCall(o, "medium", {
    responseMimeType: "application/json", responseJsonSchema: z.toJSONSchema(o.schema), maxOutputTokens: o.maxTokens ?? 16000,
  });
  return o.schema.parse(JSON.parse(text)) as z.infer<T>;
}

const geminiText = async (o: Opts) => (await geminiCall(o, "low", { maxOutputTokens: 4000 })).trim();

const JSON_BY = { anthropic: anthropicJSON, gemini: geminiJSON, openai: openaiJSON };
const TEXT_BY = { anthropic: anthropicText, gemini: geminiText, openai: openaiText };
export const askJSON = <T extends z.ZodType>(o: Opts & { schema: T; maxTokens?: number }) =>
  JSON_BY[PROVIDER as keyof typeof JSON_BY](o) as Promise<z.infer<T>>;
export const askText = (o: Opts) => TEXT_BY[PROVIDER as keyof typeof TEXT_BY](o);
