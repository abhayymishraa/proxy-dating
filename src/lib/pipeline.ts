import { analyze, goOnDate, pickDates, screen } from "./agents";
import { events, people } from "./db";
import { fetchImage, normalize, scrapeInstagram, scrapeLinkedin, type Instagram } from "./scrape";

// ponytail: in-process serial queue. Survives nothing across restarts; `resume()` re-queues unfinished people on boot.
const g = globalThis as unknown as { __q?: Promise<unknown>; __resumed?: boolean };
const enqueue = (job: () => Promise<unknown>) => (g.__q = (g.__q ?? Promise.resolve()).then(job).catch(console.error));

const pool = async <T>(items: T[], n: number, fn: (x: T) => Promise<unknown>) => {
  const q = [...items];
  await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { while (q.length) await fn(q.shift()!); }));
};

const DATES_PER_PERSON = Number(process.env.DATES_PER_PERSON ?? 3);

export function addPerson(linkedinUrl: string, instagramUrl: string, opts: { dates?: boolean } = {}) {
  const { linkedin, instagram } = normalize(linkedinUrl, instagramUrl);
  const existing = people.byLinkedin(linkedin);
  if (existing && existing.status !== "error") return existing.id;
  const id = existing?.id ?? crypto.randomUUID();
  if (!existing) people.insert(id, linkedin, instagram);
  else people.set(id, { status: "queued", error: null });
  events.log(`New person queued: ${linkedin.split("/in/")[1]}`, id);
  enqueue(() => ingest(id, opts.dates ?? true));
  return id;
}

async function ingest(id: string, withDates: boolean) {
  const p = people.get(id)!;
  const { igUser } = normalize(p.linkedin_url, p.instagram_url);
  try {
    let raw = people.raw(id);
    if (!raw?.raw_linkedin || !raw?.raw_instagram) {
      people.set(id, { status: "scraping" });
      events.log(`Agent is fetching LinkedIn + Instagram for ${igUser}`, id);
      const [li, ig] = await Promise.all([scrapeLinkedin(p.linkedin_url), scrapeInstagram(igUser)]);
      const photo = await fetchImage(ig.profilePicUrlHD ?? ig.profilePicUrl);
      people.set(id, {
        raw_linkedin: JSON.stringify(li), raw_instagram: JSON.stringify(ig),
        name: ig.fullName || [li.firstName, li.lastName].filter(Boolean).join(" "),
        photo: photo ? `data:${photo.type};base64,${photo.data}` : null,
      });
      raw = people.raw(id);
    }
    const li = JSON.parse(raw!.raw_linkedin!), ig = JSON.parse(raw!.raw_instagram!) as Instagram;

    people.set(id, { status: "reading" });
    events.log(`Agent is reading ${people.get(id)!.name}: ${ig.latestPosts?.length ?? 0} posts, ${(li.experience as unknown[])?.length ?? 0} roles`, id);
    const imgs = (await Promise.all([ig.profilePicUrlHD ?? ig.profilePicUrl, ...(ig.latestPosts ?? []).slice(0, 10).map((x) => x.displayUrl)]
      .map(fetchImage))).filter((x) => x !== null);
    const profile = await analyze(people.get(id)!, li, ig, imgs);
    people.set(id, { profile: JSON.stringify(profile), name: profile.name, status: "screening" });
    events.log(`Profile ready: ${profile.name} — ${profile.headline}`, id);

    // Screening both ways: my agent rates the pool, every other agent rates me.
    const me = people.get(id)!;
    const others = people.ready().filter((o) => o.id !== id);
    await screen(me, others);
    await pool(others, 4, (o) => screen(o, [me]));
    events.log(`${profile.name}'s agent swiped through ${others.length} people`, id);

    if (withDates) {
      people.set(id, { status: "dating" });
      await pool(pickDates([id], DATES_PER_PERSON), 3, ([a, b]) => goOnDate(people.get(a)!, people.get(b)!));
    }
    people.set(id, { status: "ready" });
  } catch (e) {
    people.set(id, { status: "error", error: (e as Error).message });
    events.log(`Failed for ${igUser}: ${(e as Error).message}`, id);
  }
}

// Full round across everyone: used after bulk-seeding the demo cohort.
export function runRound(perPerson = DATES_PER_PERSON) {
  enqueue(async () => {
    const ids = people.ready().map((p) => p.id);
    const pairs = pickDates(ids, perPerson);
    events.log(`Dating round: ${pairs.length} dates across ${ids.length} agents`);
    await pool(pairs, 4, ([a, b]) => goOnDate(people.get(a)!, people.get(b)!));
    events.log("Dating round complete — rankings updated");
  });
}

export function resume() {
  if (g.__resumed) return;
  g.__resumed = true;
  for (const p of people.all()) if (!["ready", "error"].includes(p.status)) enqueue(() => ingest(p.id, true));
}
