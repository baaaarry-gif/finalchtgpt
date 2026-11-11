import { Copy, Check } from "lucide-react";
import { useState } from "react";
import { Duration, TotalDuration, formatNumber, pad2 } from "@/lib/dates";

interface CounterPanelProps {
  title: string;
  subtitle?: string;
  start: Date;
  now: Date;
  accent?: string;
}

const UNITS: { key: keyof Duration; label: string }[] = [
  { key: "years", label: "Years" },
  { key: "months", label: "Months" },
  { key: "days", label: "Days" },
  { key: "hours", label: "Hours" },
  { key: "minutes", label: "Minutes" },
  { key: "seconds", label: "Seconds" },
];

export function CounterPanel({
  title,
  subtitle,
  start,
  now,
  accent = "pink",
}: CounterPanelProps) {
  const [copied, setCopied] = useState(false);

  // Recompute each render (parent passes fresh `now` every second).
  const calc = (() => {
    const from = start;
    const to = now;
    const ms = Math.max(0, to.getTime() - from.getTime());
    const totalDays = Math.floor(ms / 86400000);
    const totalHours = Math.floor(ms / 3600000);
    const totalMinutes = Math.floor(ms / 60000);
    const totalSeconds = Math.floor(ms / 1000);
    const totalWeeks = Math.floor(totalDays / 7);

    // Calendar-precise diff via the from->to walk.
    let f = new Date(from);
    let t = new Date(to);
    if (f > t) {
      const tmp = f;
      f = t;
      t = tmp;
    }
    let years = t.getFullYear() - f.getFullYear();
    let months = t.getMonth() - f.getMonth();
    let days = t.getDate() - f.getDate();
    let hours = t.getHours() - f.getHours();
    let minutes = t.getMinutes() - f.getMinutes();
    let seconds = t.getSeconds() - f.getSeconds();

    if (seconds < 0) {
      seconds += 60;
      minutes -= 1;
    }
    if (minutes < 0) {
      minutes += 60;
      hours -= 1;
    }
    if (hours < 0) {
      hours += 24;
      days -= 1;
    }
    if (days < 0) {
      const prevYear = t.getMonth() === 0 ? t.getFullYear() - 1 : t.getFullYear();
      const prevMonth = t.getMonth() === 0 ? 12 : t.getMonth();
      days += new Date(prevYear, prevMonth, 0).getDate();
      months -= 1;
    }
    if (months < 0) {
      months += 12;
      years -= 1;
    }
    return {
      years,
      months,
      days,
      hours,
      minutes,
      seconds,
      totalDays,
      totalHours,
      totalMinutes,
      totalSeconds,
      totalWeeks,
    };
  })();

  const totals: TotalDuration = {
    totalDays: calc.totalDays,
    totalHours: calc.totalHours,
    totalMinutes: calc.totalMinutes,
    totalSeconds: calc.totalSeconds,
    totalWeeks: calc.totalWeeks,
  };

  const handleCopy = async () => {
    const text = [
      `${title}`,
      subtitle ? subtitle : "",
      "",
      `• ${calc.years} years, ${calc.months} months, ${calc.days} days`,
      `• ${formatNumber(totals.totalDays)} total days`,
      `• ${formatNumber(totals.totalWeeks)} weeks`,
      `• ${pad2(calc.hours)}:${pad2(calc.minutes)}:${pad2(calc.seconds)} today`,
      "",
      `Generated ${now.toLocaleString()}`,
    ]
      .filter(Boolean)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — silent */
    }
  };

  const accentRing =
    accent === "pink"
      ? "from-pink-400/20 to-rose-500/5 border-pink-400/20"
      : "from-sky-400/20 to-blue-500/5 border-sky-400/20";

  return (
    <section
      className={`relative rounded-3xl border bg-gradient-to-br ${accentRing} bg-[#0a0a12]/80 p-5 sm:p-8 backdrop-blur`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl sm:text-3xl text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-1 text-sm text-white/50">{subtitle}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleCopy}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-white/70 transition hover:border-pink-400/40 hover:text-white"
          aria-label="Copy counter to clipboard"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-pink-300" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copy
            </>
          )}
        </button>
      </div>

      {/* Big breakdown grid */}
      <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-3 sm:grid-cols-6">
        {UNITS.map((u) => {
          const value = calc[u.key];
          return (
            <div
              key={u.key}
              className="rounded-2xl border border-white/10 bg-black/30 px-2 py-3 sm:px-3 sm:py-4 text-center"
            >
              <div className="font-serif text-2xl sm:text-4xl tabular-nums text-white leading-none">
                {pad2(value)}
              </div>
              <div className="mt-1.5 text-[10px] sm:text-xs uppercase tracking-wider text-white/40">
                {u.label}
              </div>
            </div>
          );
        })}
      </div>

      {/* Totals row */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <TotalCell label="Total Days" value={totals.totalDays} />
        <TotalCell label="Total Weeks" value={totals.totalWeeks} />
        <TotalCell label="Total Hours" value={totals.totalHours} />
        <TotalCell label="Total Seconds" value={totals.totalSeconds} />
      </div>
    </section>
  );
}

function TotalCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
      <div className="font-serif text-lg sm:text-xl tabular-nums text-pink-200/90 leading-none">
        {formatNumber(value)}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wider text-white/35">
        {label}
      </div>
    </div>
  );
}
