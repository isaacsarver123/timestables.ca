import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { getState, subscribe, resetAll, progressToNextLevel } from "@/lib/storage";

const TABLES = Array.from({ length: 12 }, (_, i) => i + 1);

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
    <div className="space-y-8" data-testid="stats-page">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
            data-testid="back-link"
          >
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter mt-2">Stats</h1>
        </div>
        <button
          onClick={handleReset}
          data-testid="reset-progress"
          className="brut-border bg-white px-3 py-2 font-bold text-xs uppercase tracking-widest hover:bg-red-100 flex items-center gap-2"
        >
          <RotateCcw size={14} /> Reset
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Coins" value={state.coins} accent="bg-amber-300" />
        <StatCard label="Level" value={level} accent="bg-blue-600 text-white" />
        <StatCard label="Best Streak" value={`x${state.bestStreak}`} />
        <StatCard label="Boss Level" value={state.bossLevel} accent="bg-zinc-950 text-white" />
      </div>

      {/* XP bar */}
      <div className="bg-white brut-border brut-shadow p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
              Progression
            </div>
            <div className="font-black text-xl">Level {level}</div>
          </div>
          <div className="font-mono text-sm text-zinc-500">
            {current} / {needed} XP
          </div>
        </div>
        <div className="h-4 bg-zinc-200 brut-border overflow-hidden">
          <div className="h-full bg-blue-600" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>

      {/* Overall accuracy */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white brut-border brut-shadow p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            Total Correct
          </div>
          <div className="font-mono font-black text-4xl mt-2 text-emerald-600">
            {state.totalCorrect}
          </div>
        </div>
        <div className="bg-white brut-border brut-shadow p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            Total Wrong
          </div>
          <div className="font-mono font-black text-4xl mt-2 text-red-600">{state.totalWrong}</div>
        </div>
        <div className="bg-white brut-border brut-shadow p-5">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            Accuracy
          </div>
          <div className="font-mono font-black text-4xl mt-2">{overallAcc}%</div>
        </div>
      </div>

      {/* Per-table */}
      <div className="bg-white brut-border brut-shadow p-6">
        <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold mb-1">
          Per Table
        </div>
        <h2 className="text-2xl font-black tracking-tight mb-5">Where you stand</h2>
        <div className="space-y-2">
          {TABLES.map((n) => {
            const s = state.stats[String(n)] || { correct: 0, wrong: 0, totalMs: 0 };
            const total = s.correct + s.wrong;
            const acc = total ? Math.round((s.correct / total) * 100) : 0;
            const avgMs = s.correct ? Math.round(s.totalMs / s.correct) : 0;
            return (
              <div
                key={n}
                className="grid grid-cols-12 items-center gap-3 brut-border p-3 bg-white"
                data-testid={`stat-row-${n}`}
              >
                <div className="col-span-2 sm:col-span-1 font-mono font-black text-2xl">×{n}</div>
                <div className="col-span-5 sm:col-span-7">
                  <div className="h-3 bg-zinc-100 brut-border overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: total ? `${acc}%` : "0%" }}
                    />
                  </div>
                </div>
                <div className="col-span-2 font-mono text-sm font-bold text-right tabular-nums">
                  {acc}%
                </div>
                <div className="col-span-3 sm:col-span-2 font-mono text-xs text-right tabular-nums text-zinc-500">
                  {total} qs · {avgMs ? `${(avgMs / 1000).toFixed(1)}s` : "—"}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, accent = "bg-white" }) => (
  <div className={`brut-border brut-shadow p-5 ${accent}`}>
    <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
    <div className="font-mono font-black text-4xl mt-2 tabular-nums">{value}</div>
  </div>
);

export default Stats;
