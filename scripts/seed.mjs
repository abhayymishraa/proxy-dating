// Seed the demo cohort, then run a dating round.
// usage: BASE_URL=http://localhost:3000 ADMIN_TOKEN=... node scripts/seed.mjs people.csv
// then, once everyone shows "Ranked":  node scripts/seed.mjs --round
import fs from "node:fs";

const base = process.env.BASE_URL ?? "http://localhost:3000";
const post = (body) =>
  fetch(`${base}/api/admin`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-token": process.env.ADMIN_TOKEN ?? "" },
    body: JSON.stringify(body),
  }).then((r) => r.json());

if (process.argv[2] === "--round") {
  console.log(await post({ round: true, perPerson: Number(process.argv[3] ?? 3) }));
} else {
  const rows = fs.readFileSync(process.argv[2] ?? "people.csv", "utf8").trim().split("\n").slice(1)
    .map((l) => l.split(",").map((s) => s.trim())).filter((r) => r[0] && !r[0].startsWith("#"));
  const { results } = await post({ people: rows.map(([linkedin, instagram]) => ({ linkedin, instagram })) });
  results.forEach((r, i) => console.log(r.ok ? "queued" : `FAILED ${r.error}`, rows[i][0]));
}
