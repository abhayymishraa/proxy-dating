import Link from "next/link";
import { AddForm, AutoRefresh } from "@/components/client";
import { Avatar, StatusPill, ago } from "@/components/ui";
import { dates, events, people } from "@/lib/db";
import { resume } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export default function Home() {
  resume();
  const all = people.all();
  const log = events.recent(14);
  const ds = dates.all();
  const busy = all.some((p) => !["ready", "error"].includes(p.status)) || ds.some((d) => d.status !== "done" && d.status !== "error");

  return (
    <>
      <AutoRefresh active={busy} />
      <section className="grid lg:grid-cols-[1.4fr_1fr] gap-10 lg:gap-16 pt-10 sm:pt-16 pb-14 border-b rule">
        <div className="rise">
          <p className="kicker mb-4">Vol. 1 · The agentic dating column</p>
          <h1 className="display text-6xl sm:text-7xl lg:text-8xl leading-[0.9]">
            Your agent reads you.<br /><em className="text-wine">Then it goes on dates.</em>
          </h1>
          <p className="mt-6 text-lg max-w-xl text-ink-soft leading-relaxed">
            Paste two links — a LinkedIn and a public Instagram. An AI agent studies that person, writes their profile,
            swipes the pool, and takes the best prospects out on real, turn-by-turn dates with <em>their</em> agents.
            Afterwards, each agent reports back privately, and everyone gets a ranking.
          </p>
          <div className="mt-8 grid grid-cols-3 max-w-md border-t border-b rule divide-x divide-[var(--rule)]">
            {[[all.filter((p) => p.profile).length, "people read"], [ds.filter((d) => d.status === "done").length, "dates had"],
              [ds.filter((d) => d.debrief_a?.would_see_again && d.debrief_b?.would_see_again).length, "mutual sparks"]].map(([n, l]) => (
              <div key={l} className="py-3 px-3"><div className="display text-4xl">{n}</div><div className="kicker">{l}</div></div>
            ))}
          </div>
        </div>
        <div className="rise [animation-delay:.15s] bg-paper-2/60 border border-ink/15 p-6 sm:p-8 self-start">
          <h2 className="display text-3xl mb-5">Enter someone</h2>
          <AddForm />
        </div>
      </section>

      <section className="grid lg:grid-cols-[1fr_22rem] gap-10 pt-10">
        <div id="people">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="display text-4xl">The pool</h2>
            <Link href="/rankings" className="kicker hover:text-wine">All rankings →</Link>
          </div>
          <ul className="grid sm:grid-cols-2 gap-x-8">
            {all.map((p) => (
              <li key={p.id} className="border-t rule">
                <Link href={`/p/${p.id}`} className="flex gap-4 py-4 items-center group">
                  <Avatar src={p.photo} name={p.name ?? "?"} />
                  <div className="min-w-0">
                    <div className="display text-2xl leading-tight group-hover:text-wine truncate">{p.name ?? p.linkedin_url.split("/in/")[1]}</div>
                    <div className="text-sm text-ink-soft truncate">{p.profile?.headline ?? p.error ?? "…"}</div>
                    <StatusPill status={p.status} />
                  </div>
                </Link>
              </li>
            ))}
            {!all.length && <li className="text-ink-soft italic">Nobody here yet. Be the first.</li>}
          </ul>
        </div>

        <aside>
          <h2 className="kicker mb-3 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${busy ? "bg-wine live-dot" : "bg-ink-soft"}`} /> Agent wire
          </h2>
          <ol className="font-mono text-xs space-y-2.5 border-l-2 border-wine pl-4">
            {log.map((e) => (
              <li key={e.id}>
                <span className="text-ink-soft">{ago(e.ts)} · </span>
                {e.date_id ? <Link href={`/date/${e.date_id}`} className="underline decoration-wine/40 hover:text-wine">{e.text}</Link>
                  : e.person_id ? <Link href={`/p/${e.person_id}`} className="hover:text-wine">{e.text}</Link> : e.text}
              </li>
            ))}
          </ol>
        </aside>
      </section>
    </>
  );
}
