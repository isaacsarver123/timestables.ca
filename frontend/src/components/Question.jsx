import { forwardRef, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

export const Question = forwardRef(function Question(
  { question, value, onChange, onSubmit, status, autoFocus = true, disabled = false },
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
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.18 }}
          className="text-center"
        >
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold mb-3">
            Solve
          </div>
          <div
            className="font-mono text-7xl sm:text-8xl font-black tracking-tight text-zinc-950 leading-none"
            data-testid="question-text"
          >
            {question?.a} <span className="text-zinc-400">×</span> {question?.b}{" "}
            <span className="text-zinc-400">=</span>
          </div>
        </motion.div>
      </AnimatePresence>

      <motion.div
        animate={
          status === "wrong"
            ? { x: [-12, 12, -8, 8, -4, 4, 0] }
            : status === "correct"
            ? { scale: [1, 1.05, 1] }
            : { x: 0, scale: 1 }
        }
        transition={{ duration: 0.35 }}
        className="mt-8 mx-auto max-w-sm"
      >
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^0-9-]/g, ""))}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder="?"
          data-testid="answer-input"
          className={`w-full brut-border bg-white font-mono text-5xl sm:text-6xl font-black text-center py-5 placeholder:text-zinc-300 focus:outline-none focus:ring-4 focus:ring-blue-500/20 transition-colors ${
            status === "correct"
              ? "bg-emerald-100 border-emerald-700"
              : status === "wrong"
              ? "bg-red-100 border-red-700"
              : ""
          }`}
        />
      </motion.div>

      <button
        onClick={onSubmit}
        disabled={disabled}
        data-testid="submit-answer"
        className="mt-5 mx-auto block bg-zinc-950 text-white brut-border brut-shadow font-bold text-base px-8 py-3 hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all uppercase tracking-wider"
      >
        Enter ↵
      </button>
    </div>
  );
});

export default Question;
