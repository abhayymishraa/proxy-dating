import { MODEL } from "@/lib/llm";

export const dynamic = "force-dynamic";

const STEPS = (model: string) => [
  ["Two links in", "A LinkedIn URL and a public Instagram URL. Nothing else is ever used — no names typed, no questionnaires."],
  ["Scrape", "Apify actors fetch the public data: harvestapi/linkedin-profile-scraper (no login, no cookies) for roles, education, skills, about; apify/instagram-profile-scraper for bio, the last 12 posts, captions, hashtags, locations and the photos themselves. Private Instagram accounts are rejected."],
  ["The agent reads", `${model} gets the LinkedIn JSON, the Instagram JSON and up to 11 actual photos (vision). It writes reading notes as it goes, then a structured profile: needs, hobbies, interests, values, Big-Five estimates, lifestyle, green flags, dealbreakers — every item tagged with its source and the evidence behind it. It also checks both accounts belong to the same person.`],
  ["The agent swipes", "Each person's agent rates every card in the pool for its own person (0–100 + reason), and every other agent rates the newcomer. That gives a two-way screening matrix."],
  ["The agents date", "For each person, the top mutual prospects get a date. Agent A proposes a venue that suits both; agent B accepts or counters. Then two independent model instances — each seeing ONLY its own person's full profile and the other's dating card — talk turn by turn in their person's voice. Midway a narrator throws in a twist (rain, a divisive song, the bill) to see how they react."],
  ["Private debriefs", "After the date each agent reports back to its own human, blind to the other side: score, chemistry, values and lifestyle fit, red/green flags, would-see-again."],
  ["Rankings", "For every person, everyone else is ranked. Fit = 60% own agent's verdict + 40% the other agent's — using the post-date debrief when they dated, otherwise the two-way swipe scores. Dated results are grounded; screened ones are the agent's best guess."],
];

export default function HowPage() {
  return (
    <div className="max-w-3xl pt-10">
      <h1 className="display text-6xl">How Proxy works</h1>
      <ol className="mt-8 space-y-8">
        {STEPS(MODEL).map(([t, d], i) => (
          <li key={t} className="grid grid-cols-[3rem_1fr] gap-4 border-t rule pt-4">
            <span className="display text-5xl text-wine">{i + 1}</span>
            <div><h2 className="display text-3xl">{t}</h2><p className="text-lg text-ink-soft leading-relaxed mt-1">{d}</p></div>
          </li>
        ))}
      </ol>
      <p className="mt-12 text-sm text-ink-soft border-t rule pt-4">
        Stack: Next.js 16 (App Router) · {MODEL} (Anthropic, Gemini or OpenAI SDK, structured outputs) · Apify · SQLite (node:sqlite). Only public data is used; ask to be removed and you will be.
      </p>
    </div>
  );
}
