import Link from "next/link";
import { Avatar } from "@/components/ui";
import { rankingFor } from "@/lib/agents";
import { people } from "@/lib/db";

export const dynamic = "force-dynamic";

export default function RankingsPage() {
  const all = people.ready();
  return (
    <>
      <div className="pt-10 pb-6 border-b rule">
        <h1 className="display text-6xl">The rankings</h1>
        <p className="text-ink-soft mt-2 max-w-2xl">For every person, who fits them best. Fit = 60% their own agent&apos;s verdict + 40% the other agent&apos;s — after a real date when they had one, otherwise from both agents&apos; swipes.</p>
      </div>
      <ul className="divide-y divide-[var(--rule)]">
        {all.map((p) => {
          const top = rankingFor(p.id).slice(0, 5);
          return (
            <li key={p.id} className="py-5 grid md:grid-cols-[16rem_1fr] gap-4 items-center">
              <Link href={`/p/${p.id}`} className="flex items-center gap-3 hover:text-wine">
                <Avatar src={p.photo} name={p.profile!.name} size={48} />
                <div className="min-w-0"><div className="display text-2xl truncate">{p.profile!.name}</div><div className="text-xs text-ink-soft truncate">{p.profile!.headline}</div></div>
              </Link>
              <ol className="flex gap-3 overflow-x-auto pb-1">
                {top.map((m, i) => (
                  <li key={m.id} className="shrink-0">
                    <Link href={m.date_id ? `/date/${m.date_id}` : `/p/${m.id}`} className="flex items-center gap-2 border border-ink/15 px-3 py-2 hover:border-wine bg-paper">
                      <span className="display text-xl text-ink-soft">{i + 1}</span>
                      <Avatar src={m.photo} name={m.name} size={28} />
                      <span className="text-sm">{m.name.split(" ")[0]}</span>
                      <span className="display text-xl text-wine">{m.fit}</span>
                      {m.dated && <span title="went on a date">♥</span>}
                    </Link>
                  </li>
                ))}
              </ol>
            </li>
          );
        })}
      </ul>
      {!all.length && <p className="italic text-ink-soft mt-6">No one ranked yet.</p>}
    </>
  );
}
