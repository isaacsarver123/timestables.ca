// Pre-lesson splash: "Did you know?" tip + progress bar that fills over ~1.8s
// then auto-advances the parent. Brilliant-style intermission.
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Sparkles, Lightbulb } from "lucide-react";
import { tableTips } from "@/lib/game";

const KIND_LABEL = {
  trick: "Trick",
  formula: "Formula",
  rule: "Rule",
  pattern: "Pattern",
  anchor: "Anchor",
};

function pickTip(spec) {
  // Pick a representative table from the spec to source a tip from.
  let factor = 7;
  if (spec?.tables?.length) {
    factor = spec.tables[Math.floor(Math.random() * spec.tables.length)];
  }
  const tips = tableTips(factor);
  const tip = tips[Math.floor(Math.random() * tips.length)] || tips[0];
  return { factor, tip };
}

export default function LessonLoading({ spec, durationMs = 1800, onDone, title = "Loading lesson" }) {
  const [{ factor, tip }] = useState(() => pickTip(spec));
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now) => {
      const p = Math.min(1, (now - start) / durationMs);
      setPct(p * 100);
      if (p < 1) raf = requestAnimationFrame(step);
      else onDone?.();
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, onDone]);

  return (
    <div className="max-w-2xl mx-auto" data-testid="lesson-loading">
      <div className="surface brut-border brut-shadow p-7 sm:p-10 rounded-xl">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={14} className="text-amber-500" />
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold">
            {title}
          </div>
        </div>

        <div className="text-[11px] uppercase tracking-[0.25em] text-blue-600 dark:text-blue-400 font-bold mb-2">
          Did you know?
        </div>
        <h2 className="text-fg text-xl sm:text-2xl font-medium leading-snug mb-5" data-testid="lesson-loading-tip">
          {tip.text}
        </h2>

        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted mb-6">
          <Lightbulb size={12} className="text-amber-500" />
          <span className="font-bold">{KIND_LABEL[tip.kind] || "Tip"}</span>
          <span>·</span>
          <span className="font-mono">×{factor} table</span>
        </div>

        <div className="h-2.5 brut-border-soft surface-2 overflow-hidden rounded-full" data-testid="lesson-loading-bar">
          <motion.div
            className="h-full bg-emerald-500"
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0 }}
          />
        </div>

        <div className="mt-3 text-xs text-muted font-mono text-right tabular-nums">
          {Math.floor(pct)}%
        </div>
      </div>
    </div>
  );
}
