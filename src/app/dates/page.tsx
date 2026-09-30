import Link from "next/link";
import { AutoRefresh } from "@/components/client";
import { Avatar } from "@/components/ui";
import { dates, people } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function DatesPage() {
  const all = dates.all().filter((d) => d.status !== "error");
  const who = new Map(people.all().map((p) => [p.id, p]));
  return (
    <>
      <AutoRefresh active={all.some((d) => d.status !== "done")} />
      <h1 className="display text-6xl pt-10 pb-6 border-b rule">Tonight&apos;s dates</h1>
      <ul className="grid md:grid-cols-2 gap-x-10">
        {all.map((d) => {
          const a = who.get(d.a_id)!, b = who.get(d.b_id)!;
          const spark = d.debrief_a?.would_see_again && d.debrief_b?.would_see_again;
          return (
            <li key={d.id} className="border-b rule">
              <Link href={`/date/${d.id}`} className="flex items-center gap-4 py-4 group">
                <div className="flex -space-x-3"><Avatar src={a.photo} name={a.name ?? "?"} size={48} /><Avatar src={b.photo} name={b.name ?? "?"} size={48} /></div>
                <div className="min-w-0 flex-1">
                  <div className="display text-2xl group-hover:text-wine truncate">{a.name} &amp; {b.name}</div>
                  <div className="text-sm text-ink-soft truncate">{d.venue?.venue ?? "Agents are negotiating a venue…"}</div>
                </div>
                <div className="text-right shrink-0">
                  {d.status === "done"
                    ? <><div className="display text-2xl">{Math.round(d.debrief_a!.score)} · {Math.round(d.debrief_b!.score)}</div><div className={`kicker ${spark ? "!text-moss" : ""}`}>{spark ? "mutual spark" : "no match"}</div></>
                    : <span className="kicker !text-wine live-dot">● live</span>}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      {!all.length && <p className="italic text-ink-soft mt-6">No dates yet.</p>}
    </>
  );
}
