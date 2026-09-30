"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

// Server pages read SQLite directly; this just re-renders them while agents are working.
export function AutoRefresh({ active, ms = 2500 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}

export function AddForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const f = new FormData(e.currentTarget);
    const r = await fetch("/api/people", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ linkedin: f.get("linkedin"), instagram: f.get("instagram") }),
    });
    const data = await r.json().catch(() => ({ error: "Server error" }));
    setBusy(false);
    if (!r.ok) return setErr(data.error);
    router.push(`/p/${data.id}`);
  }

  const input = "w-full bg-transparent border-b-2 border-ink/70 focus:border-wine outline-none py-2 font-mono text-sm placeholder:text-ink-soft/60";
  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block">
        <span className="kicker">LinkedIn</span>
        <input name="linkedin" required type="url" placeholder="https://www.linkedin.com/in/…" className={input} />
      </label>
      <label className="block">
        <span className="kicker">Instagram (public)</span>
        <input name="instagram" required type="url" placeholder="https://www.instagram.com/…" className={input} />
      </label>
      <button disabled={busy} className="w-full bg-wine text-paper py-3 display text-2xl hover:bg-ink transition-colors disabled:opacity-60">
        {busy ? "Sending your agent…" : "Send in an agent →"}
      </button>
      {err && <p role="alert" className="text-wine text-sm font-mono">{err}</p>}
      <p className="text-xs text-ink-soft leading-relaxed">
        The agent uses only these two public profiles. It reads them, writes a profile, swipes through the pool,
        goes on a few dates, then ranks everyone. Takes ~3–6 minutes.
      </p>
    </form>
  );
}

// Plays a finished date back line by line so it reads like it's happening.
export function Replay({ count, children }: { count: number; children: React.ReactNode[] }) {
  const [shown, setShown] = useState(count);
  const playing = shown < count;
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setShown((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [playing, shown]);
  return (
    <div>
      <button onClick={() => setShown(0)} className="kicker border border-ink px-3 py-1 hover:bg-ink hover:text-paper mb-6">
        ▶ Replay the date
      </button>
      <div className="space-y-5">{children.slice(0, shown)}</div>
    </div>
  );
}
