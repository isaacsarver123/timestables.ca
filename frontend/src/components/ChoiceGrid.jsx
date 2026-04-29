import { useMemo } from "react";
import { motion } from "framer-motion";
import { generateChoices } from "@/lib/game";

// Multiple-choice answer grid for short mul/div modes.
// Mirrors Question.jsx behaviour but with click-to-answer instead of typed input.
export const ChoiceGrid = ({
  question,
  onAnswer,
  status,
  disabled = false,
  lastChoice = null,
}) => {
  const choices = useMemo(
    () => generateChoices(question, 4),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [question?.key]
  );

  return (
    <div className="w-full" data-testid="question-card">
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">
          Pick the answer
        </div>
        <div
          className="font-mono text-5xl sm:text-6xl font-black tracking-tight text-fg leading-none"
          data-testid="question-text"
        >
          {question?.prompt} <span className="opacity-30">=</span>
        </div>
      </div>
      <motion.div
        animate={status === "wrong" ? { x: [-8, 8, -6, 6, -3, 3, 0] } : { x: 0 }}
        transition={{ duration: 0.32 }}
        className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-7"
        data-testid="choices-grid"
      >
        {choices.map((c) => {
          const isCorrect = question?.answer === c;
          const isPicked = lastChoice === c;
          let style = "surface text-fg hover:surface-2";
          if (status !== "idle" && isCorrect)
            style = "bg-emerald-500 text-white";
          else if (status === "wrong" && isPicked)
            style = "bg-red-500 text-white";
          return (
            <button
              key={c}
              onClick={() => onAnswer(c)}
              disabled={disabled || status !== "idle"}
              data-testid={`choice-${c}`}
              className={`brut-border brut-shadow-sm py-5 sm:py-6 font-mono text-3xl sm:text-4xl font-bold transition-colors ${style} ${
                disabled || status !== "idle" ? "cursor-not-allowed" : ""
              }`}
            >
              {c}
            </button>
          );
        })}
      </motion.div>
    </div>
  );
};

export default ChoiceGrid;
