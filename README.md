# Proxy — agents date so you don't have to

Paste a LinkedIn and a public Instagram. An AI agent reads that person, writes their dating profile, swipes the pool, goes on turn-by-turn dates with other people's agents, reports back privately, and ranks who fits best.

## Flow

```
LinkedIn + Instagram URL
  └─ scrape      Apify: harvestapi/linkedin-profile-scraper + apify/instagram-profile-scraper (+ photos)
  └─ read        Claude Opus 5.5, Gemini 3.8 Flash or GPT-5.6, vision + structured output -> profile (needs, hobbies, interests, values,
                 Big Five, lifestyle, flags), every claim tagged with source + evidence, identity check
  └─ swipe       each agent scores every card in the pool for its person; everyone scores the newcomer
  └─ date        top mutual prospects: A proposes a venue, B accepts/counters, then two independent
                 agents talk 12 turns in their person's voice (each only sees its own person's full
                 profile + the other's card); a narrator drops a twist midway
  └─ debrief     each agent privately scores the date for its own person (blind to the other)
  └─ rank        fit = 60% own agent + 40% other agent; date debriefs beat swipe scores
```

Code map: `src/lib/scrape.ts` (Apify), `src/lib/agents.ts` (reading, swiping, dating harness, ranking), `src/lib/llm.ts` (Anthropic, Gemini or OpenAI), `src/lib/pipeline.ts` (queue), `src/lib/db.ts` (SQLite via built-in `node:sqlite`). Pages read the DB directly and auto-refresh while agents work.

## Run

```bash
cp .env.example .env.local   # ANTHROPIC_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY, APIFY_TOKEN, ADMIN_TOKEN
npm install
npm run build && npm start   # long-running server: background jobs need a persistent process (not serverless)
```

Seed the demo cohort (consenting people only — see below):

```bash
# people.csv: linkedin,instagram per line
ADMIN_TOKEN=... node scripts/seed.mjs people.csv
# when every profile shows "Ranked":
ADMIN_TOKEN=... node scripts/seed.mjs --round 3
```

Deploy: the `Dockerfile` runs anywhere with a persistent disk (Railway / Fly / Render). Mount a volume at `/data`.

## Data & consent

Only public LinkedIn + public Instagram data is used, and private Instagram accounts are rejected. The agent never infers religion, ethnicity, health, orientation or politics. The demo cohort should be people who agreed to take part. Delete someone with `DELETE FROM people WHERE id = ?` plus their `screens`/`dates` rows.

## Submission copy

**Overall (≤200):** Proxy: paste a LinkedIn + public Instagram; an AI agent reads the person (text + photos), swipes the pool, goes on live turn-by-turn dates with other agents, then ranks best fits.

**Technical (≤500):** Scraping runs on Apify actors called via apify-client: harvestapi/linkedin-profile-scraper (public profiles, no cookies or login) returns experience, education, skills and about; apify/instagram-profile-scraper returns bio, the 12 latest posts, captions, hashtags and locations. Photos are downloaded server-side and sent to Claude Opus 5.5, Gemini 3.8 Flash or GPT-5.6 (vision + Zod structured outputs). The app is Next.js 16 with node:sqlite.
