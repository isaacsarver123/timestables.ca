import { forwardRef, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Question = forwardRef(function Question(
  { question, value, onChange, onSubmit, status, autoFocus = true, disabled = false, hint, correctAnswer },
  ref
) {
  const localRef = useRef(null);
  const inputRef = ref || localRef;

  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.key, disabled]);

  const handleKey = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onSubmit?.();
    }
  };

  return (
    <div className="w-full" data-testid="question-card">
      <AnimatePresence mode="wait">
        <motion.div
          key={question?.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.16 }}
          className="text-center"
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">
            Solve
          </div>
          <div
            className="font-mono text-6xl sm:text-7xl font-black tracking-tight text-fg leading-none"
            data-testid="question-text"
          >
            {question?.prompt} <span className="opacity-30">=</span>
          </div>
          {hint && <div className="mt-3 text-xs text-muted font-mono">{hint}</div>}
        </motion.div>
      </AnimatePresence>

      <motion.div
        animate={
          status === "wrong"
            ? { x: [-8, 8, -6, 6, -3, 3, 0] }
            : status === "correct"
            ? { scale: [1, 1.04, 1] }
            : { x: 0, scale: 1 }
        }
        transition={{ duration: 0.32 }}
        className="mt-7 mx-auto max-w-sm"
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9.-]/g, ""))}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder="?"
          data-testid="answer-input"
          className={`w-full brut-border surface font-mono text-4xl sm:text-5xl font-bold text-center py-4 placeholder:opacity-30 text-fg focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-colors ${
            status === "correct"
              ? "bg-emerald-100 border-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-500"
              : status === "wrong"
              ? "bg-red-100 border-red-700 dark:bg-red-950/40 dark:border-red-500"
              : ""
          }`}
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {status === "wrong" && correctAnswer != null && (
          <motion.div
            key="reveal"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="mt-4 mx-auto max-w-sm brut-border bg-emerald-50 dark:bg-emerald-950/30 border-emerald-500 px-4 py-3 flex items-center justify-center gap-3 text-center"
            data-testid="wrong-answer-reveal"
          >
            <span className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Answer was</span>
            <motion.span
              initial={{ scale: 0.9 }}
              animate={{ scale: [0.9, 1.15, 1] }}
              transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1], times: [0, 0.45, 1] }}
              className="font-mono font-black text-3xl sm:text-4xl text-emerald-600 dark:text-emerald-400 tabular-nums"
            >
              {correctAnswer}
            </motion.span>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onSubmit}
        disabled={disabled}
        data-testid="submit-answer"
        className="mt-4 mx-auto block bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold text-sm px-6 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        Enter ↵
      </button>
    </div>
  );
});

export default Question;
