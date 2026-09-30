import { addPerson, runRound } from "@/lib/pipeline";

// Bulk seed + dating round for the demo cohort. Guarded by ADMIN_TOKEN.
// POST { people: [{ linkedin, instagram }] }  -> queue (no dates yet)
// POST { round: true, perPerson?: number }    -> everyone dates their top matches
export async function POST(req: Request) {
  if (!process.env.ADMIN_TOKEN || req.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN)
    return Response.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  if (body.round) {
    runRound(body.perPerson);
    return Response.json({ ok: true });
  }
  const results = (body.people as { linkedin: string; instagram: string }[]).map((p) => {
    try { return { ok: true, id: addPerson(p.linkedin, p.instagram, { dates: false }) }; }
    catch (e) { return { ok: false, error: (e as Error).message, ...p }; }
  });
  return Response.json({ results });
}
