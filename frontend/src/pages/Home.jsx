import { Link } from "react-router-dom";
import { Zap, Flame, Skull, ArrowRight, BarChart3, Store } from "lucide-react";
import { motion } from "framer-motion";
import RangeSelector from "@/components/RangeSelector";
import { getState, subscribe } from "@/lib/storage";
import { useEffect, useState } from "react";

const modes = [
  {
    key: "quickfire",
    to: "/play/quickfire",
    title: "Quick-Fire",
    blurb: "60 seconds. Stack as many correct answers as possible.",
    accent: "bg-blue-600 text-white",
    Icon: Zap,
    badge: "TIMED",
  },
  {
    key: "streak",
    to: "/play/streak",
    title: "Streak",
    blurb: "Build a combo. One wrong answer ends the run.",
    accent: "bg-amber-300 text-zinc-950",
    Icon: Flame,
    badge: "ENDLESS",
  },
  {
    key: "boss",
    to: "/play/boss",
    title: "Boss Levels",
    blurb: "Progressive difficulty. Clear levels, earn rewards.",
    accent: "bg-zinc-950 text-white",
    Icon: Skull,
    badge: "PROGRESSION",
  },
];

const Home = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="lg:col-span-8 bg-white brut-border brut-shadow-lg p-8 sm:p-12 relative overflow-hidden"
          data-testid="hero-card"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold mb-4">
            Times Tables · For people who want to actually get faster
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tighter leading-[0.95] text-zinc-950">
            Drill it. <span className="text-blue-600">Master it.</span>
            <br /> No glitter, no nonsense.
          </h1>
          <p className="mt-6 text-zinc-600 text-base sm:text-lg max-w-2xl leading-relaxed">
            A focused, gamified arena for multiplication. Pick your tables, choose a mode, and
            stack reps. Coins, XP, and powerups — built for grown-ups who just need the speed.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/play/quickfire"
              data-testid="cta-start-quickfire"
              className="bg-zinc-950 text-white brut-border brut-shadow font-bold text-base px-6 py-4 hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 uppercase tracking-wider"
            >
              Start Quick-Fire <ArrowRight size={18} />
            </Link>
            <Link
              to="/stats"
              data-testid="cta-stats"
              className="bg-white brut-border brut-shadow font-bold text-base px-6 py-4 hover:bg-zinc-100 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all flex items-center gap-2 uppercase tracking-wider"
            >
              <BarChart3 size={18} /> View Stats
            </Link>
          </div>

          <div className="absolute -right-12 -bottom-12 hidden md:block opacity-[0.06] pointer-events-none">
            <div className="font-mono font-black text-[260px] leading-none">×</div>
          </div>
        </motion.div>

        {/* Stats card */}
        <div className="lg:col-span-4 grid grid-cols-2 lg:grid-cols-1 gap-4">
          <div className="bg-white brut-border brut-shadow p-5" data-testid="stat-best-streak">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
              Best Streak
            </div>
            <div className="font-mono font-black text-4xl sm:text-5xl mt-2 tabular-nums">
              {state.bestStreak}
            </div>
            <div className="mt-2 text-xs text-zinc-500 font-mono">consecutive correct</div>
          </div>
          <div className="bg-white brut-border brut-shadow p-5" data-testid="stat-best-quickfire">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
              Quick-Fire High
            </div>
            <div className="font-mono font-black text-4xl sm:text-5xl mt-2 tabular-nums">
              {state.bestQuickFire}
            </div>
            <div className="mt-2 text-xs text-zinc-500 font-mono">in 60 seconds</div>
          </div>
          <div className="bg-zinc-950 text-white brut-border brut-shadow p-5 col-span-2 lg:col-span-1" data-testid="stat-boss-level">
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-400 font-bold">
              Boss Progression
            </div>
            <div className="font-mono font-black text-4xl sm:text-5xl mt-2 tabular-nums">
              LV {state.bossLevel}
            </div>
            <div className="mt-2 text-xs text-zinc-400 font-mono">
              {state.bossLevelsCleared} cleared
            </div>
          </div>
        </div>
      </section>

      {/* Range Selector */}
      <RangeSelector />

      {/* Modes */}
      <section data-testid="modes-section">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
              02 · Choose a mode
            </div>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">Game Modes</h2>
          </div>
          <Link
            to="/shop"
            className="hidden sm:flex items-center gap-2 px-4 py-2 brut-border bg-white font-bold text-sm hover:bg-zinc-100"
            data-testid="link-shop"
          >
            <Store size={14} /> Powerup Shop
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {modes.map((m, i) => {
            const Icon = m.Icon;
            return (
              <motion.div
                key={m.key}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 }}
              >
                <Link
                  to={m.to}
                  data-testid={`mode-${m.key}`}
                  className="block bg-white brut-border brut-shadow p-6 hover:-translate-x-1 hover:-translate-y-1 hover:brut-shadow-lg transition-all group"
                >
                  <div className="flex items-start justify-between mb-6">
                    <div className={`w-14 h-14 brut-border grid place-items-center ${m.accent}`}>
                      <Icon size={26} strokeWidth={2.5} />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.25em] font-bold bg-zinc-100 brut-border px-2 py-1">
                      {m.badge}
                    </div>
                  </div>
                  <h3 className="text-2xl font-black tracking-tight mb-2">{m.title}</h3>
                  <p className="text-sm text-zinc-600 leading-relaxed">{m.blurb}</p>
                  <div className="mt-6 flex items-center gap-2 font-bold text-sm uppercase tracking-wider group-hover:text-blue-600">
                    Play <ArrowRight size={16} />
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>
    </div>
  );
};

export default Home;
