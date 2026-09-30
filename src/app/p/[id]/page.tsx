import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/client";
import { Avatar, Meter, Src, StatusPill } from "@/components/ui";
import { rankingFor } from "@/lib/agents";
import { dates, people } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function PersonPage({ params }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const person = people.get(id);
  if (!person) notFound();
  const p = person.profile;
  const busy = !["ready", "error"].includes(person.status);
  const ranking = p ? rankingFor(id) : [];
  const myDates = dates.forPerson(id);

  return (
    <>
      <AutoRefresh active={busy} />
      <section className="pt-10 pb-8 border-b rule flex flex-col sm:flex-row gap-6 sm:items-end rise">
        <Avatar src={person.photo} name={person.name ?? "?"} size={120} />
        <div className="flex-1 min-w-0">
          <StatusPill status={person.status} />
          <h1 className="display text-5xl sm:text-7xl leading-none mt-1">{p?.name ?? person.name ?? "Reading…"}</h1>
          {p && <p className="text-xl mt-2 italic text-ink-soft">{p.headline}</p>}
          <p className="kicker mt-3 flex flex-wrap gap-x-4">
            {p && <span>{p.location}</span>}{p && <span>Age {p.age_range}</span>}
            <a href={person.linkedin_url} target="_blank" rel="noreferrer" className="underline hover:text-wine">LinkedIn ↗</a>
            <a href={person.instagram_url} target="_blank" rel="noreferrer" className="underline hover:text-wine">Instagram ↗</a>
          </p>
        </div>
      </section>

      {person.status === "error" && <p className="mt-8 font-mono text-wine">Agent couldn&apos;t finish: {person.error}</p>}
      {!p && person.status !== "error" && (
        <p className="mt-10 display text-3xl italic text-ink-soft">The agent is {person.status === "scraping" ? "fetching both profiles" : "reading this person"}… this page updates by itself.</p>
      )}

      {p && (
        <div className="grid lg:grid-cols-[1fr_24rem] gap-12 pt-10">
          <article className="space-y-12 min-w-0">
            <section className="rise">
              <p className="kicker mb-2">The agent&apos;s portrait</p>
              <p className="display text-3xl leading-snug first-letter:text-6xl first-letter:float-left first-letter:mr-2 first-letter:leading-none first-letter:text-wine">{p.summary}</p>
            </section>

            <section>
              <h2 className="display text-3xl mb-3">How the agent read them</h2>
              <ol className="font-mono text-sm space-y-2 border-l-2 border-ink pl-4">
                {p.reading_notes.map((n, i) => (
                  <li key={i} className="rise" style={{ animationDelay: `${i * 60}ms` }}><Src s={n.source} /> {n.observation}</li>
                ))}
              </ol>
              <p className="text-sm text-ink-soft mt-3 italic">Source check: {p.identity_check.same_person ? "✓ same person" : "⚠ may not be the same person"} ({Math.round(p.identity_check.confidence * 100)}%) — {p.identity_check.reason}</p>
            </section>

            <section>
              <h2 className="display text-4xl mb-4">Needs</h2>
              <ul className="space-y-3">
                {p.needs.map((n, i) => (
                  <li key={i} className="border-t rule pt-3"><div className="text-lg font-semibold">{n.need}</div><div className="text-ink-soft"><Src s={n.source} /> {n.why}</div></li>
                ))}
              </ul>
            </section>

            <div className="grid sm:grid-cols-2 gap-10">
              {([["Hobbies", p.hobbies.map((h) => ({ t: h.hobby, e: h.evidence, s: h.source }))],
                ["Interests", p.interests.map((h) => ({ t: h.interest, e: h.evidence, s: h.source }))],
                ["Values", p.values.map((h) => ({ t: h.value, e: h.evidence, s: h.source }))]] as const).map(([title, items]) => (
                <section key={title}>
                  <h2 className="display text-3xl mb-3">{title}</h2>
                  <ul className="space-y-2.5">
                    {items.map((x, i) => <li key={i}><span className="font-semibold">{x.t}</span> <Src s={x.s} /><div className="text-sm text-ink-soft">{x.e}</div></li>)}
                  </ul>
                </section>
              ))}
              <section>
                <h2 className="display text-3xl mb-3">Personality</h2>
                <div className="space-y-2.5">
                  <Meter label="Openness" v={p.personality.openness} />
                  <Meter label="Conscientiousness" v={p.personality.conscientiousness} />
                  <Meter label="Extraversion" v={p.personality.extraversion} />
                  <Meter label="Agreeableness" v={p.personality.agreeableness} />
                  <Meter label="Emotional stability" v={p.personality.emotional_stability} />
                </div>
                <p className="text-sm text-ink-soft mt-3">{p.personality.notes}</p>
              </section>
            </div>

            <section className="grid sm:grid-cols-2 gap-x-10 gap-y-6 border-t-4 border-double rule pt-6">
              {[["Pace of life", p.lifestyle.pace], ["Social style", p.lifestyle.social_style], ["Ideal weekend", p.lifestyle.ideal_weekend],
                ["Work / life", p.lifestyle.work_life_balance], ["Communication", p.communication_style], ["Looking for", p.looking_for]].map(([k, v]) => (
                <div key={k}><p className="kicker">{k}</p><p>{v}</p></div>
              ))}
            </section>

            <section className="grid sm:grid-cols-2 gap-10">
              <div><h3 className="display text-2xl text-moss">Green flags</h3><ul className="list-disc pl-5">{p.green_flags.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3 className="display text-2xl text-wine">Dealbreakers</h3><ul className="list-disc pl-5">{p.dealbreakers.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3 className="display text-2xl">Date ideas</h3><ul className="list-disc pl-5">{p.date_ideas.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3 className="display text-2xl">Openers</h3><ul className="list-disc pl-5">{p.conversation_starters.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </section>
            <p className="text-xs text-ink-soft font-mono">Data quality: {p.data_quality}</p>
          </article>

          <aside className="space-y-10">
            <section>
              <h2 className="display text-4xl">Ranking</h2>
              <p className="kicker mb-3">Who fits {p.name.split(" ")[0]} best</p>
              <ol className="space-y-1">
                {ranking.map((m, i) => (
                  <li key={m.id} className="border-t rule py-2.5">
                    <div className="flex items-center gap-3">
                      <span className="display text-2xl w-7 text-ink-soft">{i + 1}</span>
                      <Avatar src={m.photo} name={m.name} size={36} />
                      <Link href={`/p/${m.id}`} className="flex-1 min-w-0 hover:text-wine">
                        <div className="font-semibold truncate">{m.name}</div>
                        <div className="kicker">{m.dated ? "dated" : "screened"} · you {m.mine}{m.theirs != null && ` · them ${m.theirs}`}</div>
                      </Link>
                      <span className="display text-3xl text-wine">{m.fit}</span>
                    </div>
                    <p className="text-xs text-ink-soft mt-1 pl-10">{m.reason} {m.date_id && <Link href={`/date/${m.date_id}`} className="underline hover:text-wine">Read the date →</Link>}</p>
                  </li>
                ))}
              </ol>
              {!ranking.length && <p className="italic text-ink-soft">Ranking appears once there are others in the pool.</p>}
            </section>
            <section>
              <h2 className="display text-3xl mb-2">Dates</h2>
              <ul className="space-y-2">
                {myDates.map((d) => {
                  const other = people.get(d.a_id === id ? d.b_id : d.a_id);
                  return (
                    <li key={d.id}><Link href={`/date/${d.id}`} className="flex justify-between gap-3 border-t rule pt-2 hover:text-wine">
                      <span>with {other?.name} <span className="text-ink-soft text-sm">· {d.venue?.venue ?? "planning"}</span></span>
                      <span className="kicker shrink-0">{d.status}</span>
                    </Link></li>
                  );
                })}
                {!myDates.length && <li className="italic text-ink-soft">No dates yet.</li>}
              </ul>
            </section>
          </aside>
        </div>
      )}
    </>
  );
}
