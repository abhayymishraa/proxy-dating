import type { BetaContentBlockParam, BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { askJSON, askText } from "./llm";
import { dates, events, people, screens, type Line, type PersonRow } from "./db";
import { DebriefSchema, ProfileSchema, ReplySchema, ScreenSchema, VenueSchema, type Profile } from "./schemas";
import type { Instagram } from "./scrape";

// ---------- 1. Reading: the agent studies its person from exactly two sources ----------

const READER = `You are a personal dating agent about to represent one human. Your ONLY sources are their public LinkedIn profile and public Instagram profile (data + photos below). Nothing else exists.

Read like a perceptive friend, not a recruiter: career choices reveal values and pace of life; captions reveal humour and voice; photos reveal hobbies, social life, travel, pets, aesthetics.
Rules:
- Every claim must trace to something in the sources. Put the concrete evidence in the evidence/why fields and tag the source.
- Infer needs (what they need from a partner) from patterns, e.g. long hours + solo travel photos -> needs an independent partner who respects their ambition.
- Be calibrated. If a source is thin, say so in data_quality and keep lists short rather than inventing.
- Never guess religion, ethnicity, health, sexual orientation, or politics.
- identity_check: judge whether both accounts plausibly belong to the same person (names, faces, location, bio, employer mentions).`;

function trimLinkedin(li: Record<string, unknown>) {
  const pick = ["firstName", "lastName", "headline", "about", "location", "experience", "education", "skills",
    "certifications", "projects", "volunteering", "languages", "honorsAndAwards", "publications", "courses", "followerCount"];
  return Object.fromEntries(pick.filter((k) => li[k] != null).map((k) => [k, li[k]]));
}

export async function analyze(person: PersonRow, li: Record<string, unknown>, ig: Instagram,
  images: { type: "image/jpeg"; data: string }[]) {
  const posts = (ig.latestPosts ?? []).map((p, i) => ({
    n: i + 1, type: p.type, date: p.timestamp?.slice(0, 10), location: p.locationName,
    caption: p.caption?.slice(0, 600), hashtags: p.hashtags,
  }));
  const content: BetaContentBlockParam[] = [
    { type: "text", text: `LINKEDIN (${person.linkedin_url}):\n${JSON.stringify(trimLinkedin(li))}` },
    { type: "text", text: `INSTAGRAM (${person.instagram_url}):\n${JSON.stringify({
      username: ig.username, fullName: ig.fullName, bio: ig.biography, category: ig.businessCategoryName,
      link: ig.externalUrl, followers: ig.followersCount, following: ig.followsCount, totalPosts: ig.postsCount, posts,
    })}` },
    { type: "text", text: `INSTAGRAM PHOTOS (first is profile picture, then recent posts in order):` },
    ...images.map((img) => ({ type: "image" as const, source: { type: "base64" as const, media_type: img.type, data: img.data } })),
    { type: "text", text: "Read everything, then write the dating profile." },
  ];
  return askJSON({ system: READER, messages: [{ role: "user", content }], schema: ProfileSchema, effort: "high", maxTokens: 32000 });
}

// ---------- 2. Screening: each agent swipes through the pool for its person ----------

export const card = (id: string, p: Profile) => ({
  id, name: p.name, headline: p.headline, location: p.location, age_range: p.age_range,
  interests: p.interests.map((x) => x.interest), hobbies: p.hobbies.map((x) => x.hobby),
  values: p.values.map((x) => x.value), looking_for: p.looking_for, pace: p.lifestyle.pace,
});

const persona = (p: Profile) => `You are the dating agent for ${p.name}. Everything you know about ${p.name} comes from their LinkedIn and Instagram, analysed here:
${JSON.stringify(p)}`;

export async function screen(me: PersonRow, candidates: PersonRow[]) {
  if (!candidates.length) return;
  const { ratings } = await askJSON({
    system: persona(me.profile!),
    messages: [{ role: "user", content: `Here are dating-app cards for people in the pool. For each, rate 0-100 how promising they are for ${me.profile!.name} specifically (needs, values, lifestyle, shared interests, complementary traits). One sentence reason each, from ${me.profile!.name}'s point of view. Use the full range.\n${JSON.stringify(candidates.map((c) => card(c.id, c.profile!)))}` }],
    schema: ScreenSchema, effort: "low",
  });
  const ids = new Set(candidates.map((c) => c.id));
  for (const r of ratings) if (ids.has(r.id)) screens.put(me.id, r.id, clamp(r.score, 0, 100), r.reason);
}

// ---------- 3. The date: two independent agents, each only knows its own person ----------

const TWISTS = [
  "The server announces they're out of the first thing both of you wanted to order.",
  "A street musician starts playing right next to your table.",
  "It starts raining and you both have to decide where to go next.",
  "Someone at the next table recognises one of you from Instagram.",
  "The bill arrives earlier than expected.",
  "A power cut dims the lights for a minute.",
  "A dog runs over and demands attention from both of you.",
  "The playlist switches to a song that is very divisive.",
];

const DATER = (me: Profile, other: ReturnType<typeof card>, venue: string) => `${persona(me)}

You are now ON A DATE with ${other.name} at ${venue}, going on it on ${me.name}'s behalf. You speak in first person AS ${me.name} (their stand-in), in their voice as seen in their captions and bio.
What you know about ${other.name} is only their dating-app card: ${JSON.stringify(other)}

How to date well:
- Be warm, specific and a bit playful. Short turns: 1-3 sentences, like real talk. Optional *brief action in asterisks*.
- Represent ${me.name} honestly: only claim facts that are in the analysis. If asked something you don't know, deflect naturally or say you'd have to ask.
- Your job is to find out if ${other.name} fits ${me.name}'s needs and dealbreakers. Ask real questions, probe gently, react to answers, notice red flags.
- React to [Narrator] events in the scene.
- Never mention being an AI or an agent while on the date.`;

const say = (line: Line, names: Record<string, string>) =>
  line.speaker === "narrator" ? `[Narrator: ${line.text}]` : `${names[line.speaker]}: ${line.text}`;

// Build the conversation from one side's point of view: own lines = assistant, everything else = user.
function view(side: "a" | "b", opening: string, lines: Line[], names: Record<string, string>): BetaMessageParam[] {
  const msgs: BetaMessageParam[] = [{ role: "user", content: opening }];
  for (const l of lines) {
    const role = l.speaker === side ? "assistant" : "user";
    const text = l.speaker === side ? l.text : say(l, names);
    const last = msgs[msgs.length - 1];
    if (last.role === role) last.content = `${last.content}\n${text}`;
    else msgs.push({ role, content: text });
  }
  return msgs;
}

const TURNS = Number(process.env.DATE_TURNS ?? 12);

export async function goOnDate(a: PersonRow, b: PersonRow) {
  const id = crypto.randomUUID();
  const A = a.profile!, B = b.profile!;
  dates.insert(id, a.id, b.id);
  events.log(`${A.name}'s agent asked ${B.name}'s agent out`, a.id, id);
  try {
    // Plan: A's agent proposes, B's agent accepts or counters.
    const cardA = card(a.id, A), cardB = card(b.id, B);
    const prop = await askJSON({
      system: persona(A),
      messages: [{ role: "user", content: `You're asking ${B.name} out on a first date tonight on ${A.name}'s behalf. Their card: ${JSON.stringify(cardB)}\nPropose a specific venue + activity that suits BOTH people, and write the invite in first person as ${A.name} ("I", never "${A.name} would").` }],
      schema: VenueSchema, effort: "low",
    });
    const reply = await askJSON({
      system: persona(B),
      messages: [{ role: "user", content: `${A.name} (card: ${JSON.stringify(cardA)}) invites ${B.name} out: "${prop.message}" — venue: ${prop.venue}, ${prop.activity}.\nOn ${B.name}'s behalf: accept, or counter with something that fits ${B.name} better. Reply in their voice.` }],
      schema: ReplySchema, effort: "low",
    });
    const plan = !reply.accept && reply.counter ? reply.counter : prop;
    const venue = { venue: plan.venue, activity: plan.activity, why: plan.why };
    const lines: Line[] = [
      { speaker: "a", text: prop.message },
      { speaker: "b", text: reply.message },
      { speaker: "narrator", text: `They meet: ${plan.venue}. ${plan.activity}` },
    ];
    dates.set(id, { status: "live", venue: JSON.stringify(venue), transcript: JSON.stringify(lines) });
    events.log(`${A.name} × ${B.name} are on a date: ${plan.venue}`, a.id, id);

    const names = { a: A.name, b: B.name };
    const sys = { a: DATER(A, cardB, plan.venue), b: DATER(B, cardA, plan.venue) };
    const opening = `[Narrator: You arrive at ${plan.venue}. The plan: ${plan.activity}. ${B.name} is there. The date begins — you speak first.]`;
    const twistAt = Math.floor(TURNS / 2);
    const twist = TWISTS[(A.name.length * 7 + B.name.length) % TWISTS.length];

    for (let t = 0; t < TURNS; t++) {
      if (t === twistAt) lines.push({ speaker: "narrator", text: twist });
      const side = t % 2 === 0 ? "a" : "b";
      const date = lines.slice(3);
      const open = side === "a" ? opening : `[Narrator: You arrive at ${plan.venue}. The plan: ${plan.activity}. ${A.name} walks in.]`;
      const text = await askText({ system: sys[side], messages: view(side, open, date, names) });
      lines.push({ speaker: side, text: text.replace(new RegExp(`^${names[side]}:\\s*`), "") });
      dates.set(id, { transcript: JSON.stringify(lines) });
    }
    lines.push({ speaker: "narrator", text: "The evening winds down. Each agent heads home to report back." });
    dates.set(id, { status: "debrief", transcript: JSON.stringify(lines) });

    // Private debriefs: each agent reports to its own human, blind to the other's verdict.
    const transcript = lines.map((l) => say(l, names)).join("\n");
    const debrief = (me: Profile, other: Profile) => askJSON({
      system: persona(me),
      messages: [{ role: "user", content: `You just went on this date with ${other.name} on ${me.name}'s behalf:\n\n${transcript}\n\nNow, privately and honestly, debrief for ${me.name}. Judge fit against ${me.name}'s needs and dealbreakers, not just whether it was pleasant.` }],
      schema: DebriefSchema, effort: "medium",
    });
    const [da, db_] = await Promise.all([debrief(A, B), debrief(B, A)]);
    dates.set(id, { status: "done", transcript: JSON.stringify(lines), debrief_a: JSON.stringify(da), debrief_b: JSON.stringify(db_) });
    events.log(`Date over: ${A.name} ${da.would_see_again ? "💚" : "✖"} ${da.score} · ${B.name} ${db_.would_see_again ? "💚" : "✖"} ${db_.score}`, a.id, id);
  } catch (e) {
    dates.set(id, { status: "error" });
    events.log(`Date ${A.name} × ${B.name} failed: ${(e as Error).message}`, a.id, id);
  }
}

// ---------- 4. Ranking: date verdicts beat screening guesses; mutual interest counts ----------

export type Match = { id: string; name: string; photo: string | null; headline: string; fit: number;
  mine: number; theirs: number | null; dated: boolean; date_id?: string; reason: string };

export function rankingFor(meId: string): Match[] {
  const pool = people.ready().filter((p) => p.id !== meId);
  const sc = new Map(screens.all().map((s) => [`${s.from_id}>${s.to_id}`, s]));
  const myDates = dates.forPerson(meId).filter((d) => d.status === "done");
  return pool.map((o) => {
    const d = myDates.find((x) => x.a_id === o.id || x.b_id === o.id);
    if (d) {
      const iAmA = d.a_id === meId;
      const mine = (iAmA ? d.debrief_a : d.debrief_b)!, theirs = (iAmA ? d.debrief_b : d.debrief_a)!;
      return { id: o.id, name: o.profile!.name, photo: o.photo, headline: o.profile!.headline,
        fit: Math.round(0.6 * mine.score + 0.4 * theirs.score), mine: mine.score, theirs: theirs.score,
        dated: true, date_id: d.id, reason: mine.note_to_person };
    }
    const m = sc.get(`${meId}>${o.id}`), t = sc.get(`${o.id}>${meId}`);
    const mine = m?.score ?? 0;
    return { id: o.id, name: o.profile!.name, photo: o.photo, headline: o.profile!.headline,
      fit: Math.round(t ? 0.6 * mine + 0.4 * t.score : mine), mine, theirs: t?.score ?? null,
      dated: false, reason: m?.reason ?? "Not screened yet" };
  }).sort((x, y) => y.fit - x.fit || Number(y.dated) - Number(x.dated));
}

// Who each agent should take out: highest mutual screening score, not yet dated.
export function pickDates(ids: string[], perPerson: number) {
  const sc = new Map(screens.all().map((s) => [`${s.from_id}>${s.to_id}`, s.score]));
  const ready = people.ready().map((p) => p.id);
  const pairs = new Map<string, [string, string]>();
  for (const me of ids) {
    const ranked = ready.filter((o) => o !== me)
      .map((o) => ({ o, s: ((sc.get(`${me}>${o}`) ?? 0) + (sc.get(`${o}>${me}`) ?? 0)) / 2 }))
      .sort((x, y) => y.s - x.s);
    let n = 0;
    for (const { o } of ranked) {
      if (n >= perPerson) break;
      if (dates.exists(me, o)) { n++; continue; }
      const key = [me, o].sort().join("|");
      if (!pairs.has(key)) pairs.set(key, [me, o]);
      n++;
    }
  }
  return [...pairs.values()];
}

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
