import { addPerson } from "@/lib/pipeline";
import { people } from "@/lib/db";

// ponytail: in-memory per-IP limit; resets on restart. Move to the DB if abuse shows up.
const hits = new Map<string, number[]>();
const LIMIT = Number(process.env.SUBMISSIONS_PER_IP_PER_DAY ?? 5);
const MAX_PEOPLE = Number(process.env.MAX_PEOPLE ?? 300);

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 86_400_000);
  if (recent.length >= LIMIT) return Response.json({ error: "Daily limit reached for your network — try tomorrow." }, { status: 429 });
  if (people.all().length >= MAX_PEOPLE) return Response.json({ error: "The pool is full right now." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  if (typeof body.linkedin !== "string" || typeof body.instagram !== "string")
    return Response.json({ error: "Both links are required." }, { status: 400 });
  try {
    const id = addPerson(body.linkedin, body.instagram);
    hits.set(ip, [...recent, now]);
    return Response.json({ id });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
