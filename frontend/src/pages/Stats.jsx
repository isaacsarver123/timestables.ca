import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getState, subscribe, resetAll, progressToNextLevel } from "@/lib/storage";

const TABLES = Array.from({ length: 20 }, (_, i) => i + 1);

const Stats = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const totalAnswered = state.totalCorrect + state.totalWrong;
  const overallAcc = totalAnswered ? Math.round((state.totalCorrect / totalAnswered) * 100) : 0;
  const { level, current, needed, pct } = progressToNextLevel(state.xp);

  const handleReset = () => {
    if (window.confirm("Reset all coins, XP, and stats? This cannot be undone.")) {
      resetAll();
    }
  };

  return (
    <div className="space-y-7" data-testid="stats-page">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
            data-testid="back-link"
          >
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2">Stats</h1>
        </div>
        <button
          onClick={handleReset}
          data-testid="reset-progress"
          className="brut-border-soft surface px-3 py-1.5 font-semibold text-xs uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-950/30 text-fg flex items-center gap-2"
        >
          <RotateCcw size={13} /> Reset
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Coins" value={state.coins} accent="bg-amber-300 text-zinc-950" />
        <StatCard label="Level" value={level} accent="bg-blue-600 text-white" />
        <StatCard label="Best Streak" value={`x${state.bestStreak}`} />
        <StatCard label="Boss Level" value={state.bossLevel} accent="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950" />
      </div>

      <div className="surface brut-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
              Progression
            </div>
            <div className="font-bold text-base text-fg">Level {level}</div>
          </div>
          <div className="font-mono text-xs text-muted">
            {current} / {needed} XP
          </div>
        </div>
        <div className="h-3 surface-2 brut-border-soft overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="surface brut-border p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
            Total Correct
          </div>
          <div className="font-mono font-bold text-3xl mt-1 text-emerald-600">
            {state.totalCorrect}
          </div>
        </div>
        <div className="surface brut-border p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
            Total Wrong
          </div>
          <div className="font-mono font-bold text-3xl mt-1 text-red-600">{state.totalWrong}</div>
        </div>
        <div className="surface brut-border p-4">
          <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
            Accuracy
          </div>
          <div className="font-mono font-bold text-3xl mt-1 text-fg">{overallAcc}%</div>
        </div>
      </div>

      <div className="surface brut-border p-5">
        <div className="text-[10px] uppercase tracking-widest text-muted font-medium mb-1">
          Per Table
        </div>
        <h2 className="text-lg font-bold tracking-tight mb-4 text-fg">Where you stand</h2>
        <div className="space-y-1.5">
          {TABLES.map((n) => {
            const s = state.stats[String(n)] || { correct: 0, wrong: 0, totalMs: 0 };
            const total = s.correct + s.wrong;
            const acc = total ? Math.round((s.correct / total) * 100) : 0;
            const avgMs = s.correct ? Math.round(s.totalMs / s.correct) : 0;
            if (total === 0) return null;
            return (
              <div
                key={n}
                className="grid grid-cols-12 items-center gap-3 brut-border-soft p-2.5"
                data-testid={`stat-row-${n}`}
              >
                <div className="col-span-2 sm:col-span-1 font-mono font-bold text-lg text-fg">×{n}</div>
                <div className="col-span-5 sm:col-span-7">
                  <div className="h-2.5 surface-2 brut-border-soft overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: total ? `${acc}%` : "0%" }}
                    />
                  </div>
                </div>
                <div className="col-span-2 font-mono text-sm font-bold text-right tabular-nums text-fg">
                  {acc}%
                </div>
                <div className="col-span-3 sm:col-span-2 font-mono text-xs text-right tabular-nums text-muted">
                  {total} qs · {avgMs ? `${(avgMs / 1000).toFixed(1)}s` : "—"}
                </div>
              </div>
            );
          })}
          {!TABLES.some((n) => state.stats[String(n)]) && (
            <div className="text-center py-8 text-muted text-sm">
              No data yet — play a round to populate this.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, accent = "" }) => (
  <div className={`brut-border p-4 ${accent || "surface text-fg"}`}>
    <div className="text-[10px] uppercase tracking-widest font-medium opacity-70">{label}</div>
    <div className="font-mono font-bold text-3xl mt-1 tabular-nums">{value}</div>
  </div>
);

export default Stats;
