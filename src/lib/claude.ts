import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { z } from "zod/v4";

export const MODEL = process.env.CLAUDE_MODEL ?? "claude-opus-5-5";
const client = new Anthropic();

type Effort = "low" | "medium" | "high";
// Server-side fallback: a classifier false positive reroutes instead of failing the date.
const common = { model: MODEL, betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };

export async function askJSON<T extends z.ZodType>(opts: {
  system: string; messages: BetaMessageParam[]; schema: T; effort?: Effort; maxTokens?: number;
}): Promise<z.infer<T>> {
  const res = await client.beta.messages.parse({
    ...common,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
  });
  if (res.stop_reason === "refusal") throw new Error("Model declined this request");
  if (!res.parsed_output) throw new Error(`No structured output (stop_reason=${res.stop_reason})`);
  return res.parsed_output as z.infer<T>;
}

export async function askText(opts: { system: string; messages: BetaMessageParam[]; effort?: Effort }) {
  const res = await client.beta.messages.create({
    ...common,
    max_tokens: 4000,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort ?? "low" },
  });
  if (res.stop_reason === "refusal") throw new Error("Model declined this request");
  return res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("").trim();
}
