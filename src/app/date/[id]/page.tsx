import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefresh, Replay } from "@/components/client";
import { Avatar, Meter } from "@/components/ui";
import { dates, people } from "@/lib/db";
import type { Debrief } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export default async function DatePage({ params }: PageProps<"/date/[id]">) {
  const { id } = await params;
  const d = dates.get(id);
  if (!d) notFound();
  const a = people.get(d.a_id)!, b = people.get(d.b_id)!;
  const name = { a: a.name ?? "A", b: b.name ?? "B" };
  const live = !["done", "error"].includes(d.status);

  const lines = d.transcript.map((l, i) =>
    l.speaker === "narrator" ? (
      <p key={i} className="rise text-center italic text-ink-soft font-mono text-sm max-w-lg mx-auto">— {l.text} —</p>
    ) : (
      <div key={i} className={`rise flex gap-3 ${l.speaker === "b" ? "flex-row-reverse text-right" : ""}`}>
        <Avatar src={(l.speaker === "a" ? a : b).photo} name={name[l.speaker]} size={40} />
        <div className="max-w-[80%]">
          <p className="kicker">{name[l.speaker]}&apos;s agent</p>
          <p className={`text-lg leading-snug mt-1 px-4 py-2.5 inline-block text-left ${l.speaker === "a" ? "bg-paper-2" : "bg-ink text-paper"}`}>{acted(l.text)}</p>
        </div>
      </div>
    ),
  );

  return (
    <>
      <AutoRefresh active={live} ms={2000} />
      <section className="pt-10 pb-8 border-b rule text-center rise">
        <p className="kicker">{live ? <span className="text-wine">● Live — agents are on this date now</span> : d.status === "error" ? "This date fell through" : "A date, on their behalf"}</p>
        <div className="flex items-center justify-center gap-4 sm:gap-8 mt-4">
          <Link href={`/p/${a.id}`} className="flex flex-col items-center hover:text-wine"><Avatar src={a.photo} name={name.a} size={84} /><span className="display text-2xl mt-2">{name.a}</span></Link>
          <span className="display text-5xl italic text-wine">&amp;</span>
          <Link href={`/p/${b.id}`} className="flex flex-col items-center hover:text-wine"><Avatar src={b.photo} name={name.b} size={84} /><span className="display text-2xl mt-2">{name.b}</span></Link>
        </div>
        {d.venue && (
          <div className="mt-6 max-w-xl mx-auto">
            <h1 className="display text-4xl sm:text-5xl leading-tight">{d.venue.venue}</h1>
            <p className="italic text-ink-soft mt-2">{d.venue.activity} — {d.venue.why}</p>
          </div>
        )}
      </section>

      <div className="grid lg:grid-cols-[1fr_22rem] gap-12 pt-10">
        <section className="min-w-0">
          {live ? <div className="space-y-5">{lines}<p className="kicker live-dot">typing…</p></div> : <Replay count={lines.length}>{lines}</Replay>}
        </section>
        <aside className="space-y-10">
          <h2 className="display text-3xl">Private debriefs</h2>
          {d.debrief_a && d.debrief_b ? (
            <>
              <DebriefCard who={name.a} about={name.b} r={d.debrief_a} />
              <DebriefCard who={name.b} about={name.a} r={d.debrief_b} />
            </>
          ) : <p className="italic text-ink-soft">Each agent reports back to its own person after the date — blind to the other&apos;s verdict.</p>}
        </aside>
      </div>
    </>
  );
}

// "*leans in* hi" -> italic stage direction
const acted = (t: string) => t.split(/(\*[^*]+\*)/).map((part, i) =>
  part.startsWith("*") && part.endsWith("*") ? <em key={i} className="opacity-70">{part.slice(1, -1)}</em> : part);

function DebriefCard({ who, about, r }: { who: string; about: string; r: Debrief }) {
  return (
    <div className="border-t-2 border-ink pt-3">
      <div className="flex justify-between items-baseline">
        <p className="kicker">{who}&apos;s agent on {about}</p>
        <span className="display text-4xl text-wine">{Math.round(r.score)}</span>
      </div>
      <p className={`font-mono text-xs mt-1 ${r.would_see_again ? "text-moss" : "text-wine"}`}>{r.would_see_again ? "WOULD SEE AGAIN" : "PASS"}</p>
      <div className="space-y-2 my-3">
        <Meter label="Chemistry" v={r.chemistry} /><Meter label="Values" v={r.values_fit} /><Meter label="Lifestyle" v={r.lifestyle_fit} />
      </div>
      <p className="italic">&ldquo;{r.note_to_person}&rdquo;</p>
      <p className="text-sm mt-2"><span className="kicker">Best moment</span><br />{r.best_moment}</p>
      <div className="text-sm mt-2 grid grid-cols-2 gap-3">
        <ul>{r.green_flags.map((x) => <li key={x} className="text-moss">+ {x}</li>)}</ul>
        <ul>{r.red_flags.map((x) => <li key={x} className="text-wine">− {x}</li>)}</ul>
      </div>
    </div>
  );
}
