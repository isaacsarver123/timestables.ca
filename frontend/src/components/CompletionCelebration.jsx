// Unified end-of-activity celebration: animated XP count-up, optional
// streak fire-lit reveal (if this completion was the first today), and a
// gem-reward popup at streak milestones (1, 3, 7, 14, 25, 50, 100, 200, 365).
//
// Usage:
//   <CompletionCelebration
//     xp={42}
//     streakInfo={info}   // returned from markCompletedActivityToday()
//   />
//
// streakInfo: { wasFirst, streak, gemsAwarded, isStreakStart }
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Zap, Gem } from "lucide-react";
import { sfx } from "@/lib/sound";

function useCountUp(target, durationMs = 900, start = 0, runKey = 0) {
  const [v, setV] = useState(start);
  useEffect(() => {
    if (target === start) { setV(start); return; }
    let raf = 0;
    const t0 = performance.now();
    const step = (now) => {
      const p = Math.min(1, (now - t0) / durationMs);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(start + (target - start) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, runKey]);
  return v;
}

export default function CompletionCelebration({ xp = 0, streakInfo = null, gems = 0 }) {
  const xpVal = useCountUp(xp, 950, 0, 1);
  const showStreak = !!streakInfo?.wasFirst;
  const showGems = !!streakInfo?.gemsAwarded || gems > 0;
  const streakReward = streakInfo?.gemsAwarded || 0;
  const totalGems = (gems || 0) + streakReward;
  const [streakLit, setStreakLit] = useState(false);

  // Fire SFX when the streak lights up.
  useEffect(() => {
    if (!showStreak) return;
    const t = setTimeout(() => {
      setStreakLit(true);
      try { sfx.coin?.(); } catch (_) {}
    }, 700);
    return () => clearTimeout(t);
  }, [showStreak]);

  return (
    <div className="space-y-4" data-testid="completion-celebration">
      {/* XP count-up — always shown */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="brut-border surface-2 p-4 flex items-center gap-4 rounded-md"
        data-testid="celebration-xp"
      >
        <div className="w-12 h-12 brut-border bg-blue-600 text-white grid place-items-center shrink-0">
          <Zap size={20} strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold">XP earned</div>
          <div className="font-mono font-black text-fg text-3xl tabular-nums">+{xpVal}</div>
        </div>
      </motion.div>

      {/* Streak fire reveal — only on the first completion of the day */}
      <AnimatePresence>
        {showStreak && (
          <motion.div
            key="streak"
            initial={{ opacity: 0, scale: 0.85, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }}
            className={`brut-border ${streakLit ? "bg-amber-300" : "surface-2"} p-4 flex items-center gap-4 rounded-md transition-colors`}
            data-testid="celebration-streak"
          >
            <div className={`w-12 h-12 brut-border grid place-items-center shrink-0 ${streakLit ? "bg-rose-500 text-white" : "surface text-muted"}`}>
              <motion.div
                animate={streakLit ? { scale: [1, 1.25, 1], rotate: [0, -8, 6, 0] } : { scale: 1 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              >
                <Flame size={22} strokeWidth={2.5} fill={streakLit ? "currentColor" : "none"} />
              </motion.div>
            </div>
            <div className="flex-1">
              <div className={`text-[10px] uppercase tracking-[0.25em] font-bold ${streakLit ? "text-zinc-900" : "text-muted"}`}>
                {streakInfo.isStreakStart ? "New streak" : "Streak"}
              </div>
              <div className="font-bold text-zinc-900 dark:text-fg text-base">
                {streakLit
                  ? streakInfo.streak === 1
                    ? "Day-1 streak — let's go!"
                    : `${streakInfo.streak}-day streak. Keep it going.`
                  : "Lighting your streak…"}
              </div>
            </div>
            {streakLit && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
                className="brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-1.5 font-mono font-black text-2xl tabular-nums"
                data-testid="celebration-streak-count"
              >
                {streakInfo.streak}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gem milestone — only at thresholds {1, 3, 7, 14, 25, 50, 100, 200, 365} */}
      <AnimatePresence>
        {showGems && (
          <motion.div
            key="gems"
            initial={{ opacity: 0, scale: 0.85, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1], delay: 1.4 }}
            className="brut-border bg-cyan-100 dark:bg-cyan-950/40 p-4 flex items-center gap-4 rounded-md"
            data-testid="celebration-gems"
          >
            <motion.div
              initial={{ rotate: 0 }}
              animate={{ rotate: [0, -10, 12, -6, 0] }}
              transition={{ duration: 0.7, delay: 1.6 }}
              className="w-12 h-12 brut-border bg-cyan-500 text-white grid place-items-center shrink-0"
            >
              <Gem size={22} strokeWidth={2.5} />
            </motion.div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold">
                {streakReward ? `${streakInfo.streak}-day milestone` : "Gems earned"}
              </div>
              <div className="font-bold text-fg text-base">
                {streakReward
                  ? `Bonus +${streakReward} gem${streakReward === 1 ? "" : "s"} for keeping the streak going.`
                  : "Nice work."}
              </div>
            </div>
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1], delay: 1.7 }}
              className="font-mono font-black text-cyan-600 dark:text-cyan-400 text-3xl tabular-nums"
              data-testid="celebration-gems-count"
            >
              +{totalGems}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
