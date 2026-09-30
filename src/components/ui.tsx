/* eslint-disable @next/next/no-img-element -- photos are stored data: URLs */
import type { Status } from "@/lib/db";

export function Avatar({ src, name, size = 56 }: { src: string | null; name: string; size?: number }) {
  return src ? (
    <img src={src} alt={name} width={size} height={size} className="rounded-full object-cover border border-ink/20 shrink-0" style={{ width: size, height: size }} />
  ) : (
    <div className="rounded-full bg-paper-2 border border-ink/20 grid place-items-center display shrink-0" style={{ width: size, height: size, fontSize: size / 2.4 }}>
      {name.slice(0, 1)}
    </div>
  );
}

const LABEL: Record<Status, string> = {
  queued: "In line", scraping: "Fetching profiles", reading: "Agent reading", screening: "Swiping",
  dating: "On dates", ready: "Ranked", error: "Failed",
};

export function StatusPill({ status }: { status: Status }) {
  const busy = !["ready", "error"].includes(status);
  return (
    <span className={`kicker inline-flex items-center gap-1.5 ${status === "error" ? "!text-wine" : status === "ready" ? "!text-moss" : ""}`}>
      {busy && <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-wine" />}
      {LABEL[status]}
    </span>
  );
}

export function Src({ s }: { s: "linkedin" | "instagram" | "both" }) {
  const c = s === "linkedin" ? "bg-[#1f4e79] text-white" : s === "instagram" ? "bg-wine-soft text-white" : "bg-ink text-paper";
  return <span className={`font-mono text-[10px] uppercase tracking-wider px-1.5 py-0.5 ${c}`}>{s === "linkedin" ? "in" : s === "instagram" ? "ig" : "in+ig"}</span>;
}

export function Meter({ label, v, max = 10 }: { label: string; v: number; max?: number }) {
  return (
    <div>
      <div className="flex justify-between kicker"><span>{label}</span><span>{Math.round(v)}/{max}</span></div>
      <div className="h-1.5 bg-paper-2 mt-1"><div className="h-full bg-wine" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div>
    </div>
  );
}

export const ago = (ts: number) => {
  const s = Math.round((Date.now() - ts) / 1000);
  return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : `${Math.round(s / 3600)}h ago`;
};
