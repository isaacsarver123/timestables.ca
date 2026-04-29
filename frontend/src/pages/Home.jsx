import { Link } from "react-router-dom";
import {
  Zap,
  Flame,
  Skull,
  ArrowRight,
  BookOpen,
  CalendarCheck,
  Grid3x3,
  Divide,
} from "lucide-react";
import { motion } from "framer-motion";
import RangeSelector from "@/components/RangeSelector";
import OpPicker from "@/components/OpPicker";
import { getState, subscribe } from "@/lib/storage";
import { useEffect, useState } from "react";

const modes = [
  {
    key: "quickfire",
    to: "/play/quickfire",
    title: "Quick-Fire",
    blurb: "60 seconds. Stack correct answers.",
    Icon: Zap,
    accent: "bg-blue-600 text-white",
  },
  {
    key: "streak",
    to: "/play/streak",
    title: "Streak",
    blurb: "One wrong answer ends the run.",
    Icon: Flame,
    accent: "bg-amber-300 text-zinc-950",
  },
  {
    key: "boss",
    to: "/play/boss",
    title: "Boss",
    blurb: "Levels with lives and a clock.",
    Icon: Skull,
    accent: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950",
  },
];

const Home = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  return (
    <div className="space-y-8">
      {/* Quiet header */}
      <section>
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Times Tables
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-1">
          Practice multiplication and division.
        </h1>
        <p className="text-muted text-sm mt-2 max-w-xl">
          Pick the tables you want, choose a mode, and go. Progress saves to this device.
        </p>
      </section>

      {/* Operation */}
      <OpPicker />

      {/* Tables */}
      <RangeSelector />

      {/* Modes */}
      <section data-testid="modes-section" className="space-y-3">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Modes
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {modes.map((m, i) => {
            const Icon = m.Icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.05 }}
              >
                <Link
                  to={m.to}
                  data-testid={`mode-${m.key}`}
                  className="block surface brut-border brut-shadow p-5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div className={`w-11 h-11 brut-border grid place-items-center ${m.accent}`}>
                      <Icon size={20} strokeWidth={2.5} />
                    </div>
                    <ArrowRight size={16} className="text-muted group-hover:text-fg transition-colors" />
                  </div>
                  <h3 className="text-lg font-bold tracking-tight text-fg">{m.title}</h3>
                  <p className="text-sm text-muted mt-1">{m.blurb}</p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      {/* Long-form */}
      <section data-testid="long-section" className="space-y-3">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Long-form practice
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            to="/play/long-mul"
            data-testid="mode-long-mul"
            className="group surface brut-border brut-shadow p-5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all flex items-center gap-4"
          >
            <div className="w-11 h-11 brut-border bg-violet-300 text-zinc-950 grid place-items-center">
              <Grid3x3 size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-fg">Long Multiplication</div>
              <div className="text-xs text-muted">
                Multi-digit × multi-digit. 2×1, 2×2, or 3×2 difficulty.
              </div>
            </div>
            <ArrowRight size={16} className="text-muted group-hover:text-fg" />
          </Link>
          <Link
            to="/play/long-div"
            data-testid="mode-long-div"
            className="group surface brut-border brut-shadow p-5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all flex items-center gap-4"
          >
            <div className="w-11 h-11 brut-border bg-rose-300 text-zinc-950 grid place-items-center">
              <Divide size={20} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <div className="text-base font-bold text-fg">Long Division</div>
              <div className="text-xs text-muted">
                Whole-number quotients. Choose your difficulty.
              </div>
            </div>
            <ArrowRight size={16} className="text-muted group-hover:text-fg" />
          </Link>
        </div>
      </section>

      {/* Learn + Daily */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/learn"
          data-testid="link-learn"
          className="group surface brut-border brut-shadow p-5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all flex items-center gap-4"
        >
          <div className="w-11 h-11 brut-border bg-blue-600 text-white grid place-items-center">
            <BookOpen size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-fg">Learn a table</div>
            <div className="text-xs text-muted">
              See the full table, get tips, then drill it.
            </div>
          </div>
          <ArrowRight size={16} className="text-muted group-hover:text-fg" />
        </Link>
        <Link
          to="/play/daily"
          data-testid="link-daily"
          className="group surface brut-border brut-shadow p-5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all flex items-center gap-4"
        >
          <div className="w-11 h-11 brut-border bg-emerald-500 text-zinc-950 grid place-items-center">
            <CalendarCheck size={20} strokeWidth={2.5} />
          </div>
          <div className="flex-1">
            <div className="text-base font-bold text-fg">Daily Challenge</div>
            <div className="text-xs text-muted">
              {state.daily?.completed && state.daily?.date === new Date().toISOString().slice(0, 10)
                ? `Today's score: ${state.daily.score}/${state.daily.total}`
                : "Same 30 questions for everyone, today only."}
            </div>
          </div>
          <ArrowRight size={16} className="text-muted group-hover:text-fg" />
        </Link>
      </section>

      {/* Compact stats */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Best streak" value={state.bestStreak} testid="stat-best-streak" />
        <Stat label="QF high" value={state.bestQuickFire} testid="stat-best-quickfire" />
        <Stat label="Boss level" value={state.bossLevel} testid="stat-boss-level" />
        <Stat label="Coins" value={state.coins} testid="stat-coins" accent />
      </section>
    </div>
  );
};

const Stat = ({ label, value, testid, accent }) => (
  <div
    className={`p-3.5 brut-border-soft ${accent ? "bg-amber-50 dark:bg-amber-500/10" : "surface"}`}
    data-testid={testid}
  >
    <div className="text-[10px] uppercase tracking-widest text-muted font-medium">
      {label}
    </div>
    <div className={`font-mono text-2xl font-bold mt-1 tabular-nums ${accent ? "text-amber-700 dark:text-amber-300" : "text-fg"}`}>
      {value}
    </div>
  </div>
);

export default Home;
