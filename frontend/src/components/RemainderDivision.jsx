import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/sound";

const CELL = 38;

// Visual long-division-with-remainder.
// Mirrors StepDivision's bracket style but accepts both quotient + remainder inputs.
// problem = { dividend, divisor, answer: { quotient, remainder }, key }
export const RemainderDivision = ({ problem, onCorrect, onWrong }) => {
  const dividend = problem.a;
  const divisor = problem.b;
  const { quotient, remainder } = problem.answer;
  const dividendDigits = String(dividend).split("").map(Number);
  const cols = dividendDigits.length;

  const [qVal, setQVal] = useState("");
  const [rVal, setRVal] = useState("");
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    setQVal("");
    setRVal("");
    setDone(false);
    setShowHint(false);
  }, [problem.key]);

  const submit = () => {
    if (done) return;
    if (qVal === "" || rVal === "") return;
    if (parseInt(qVal, 10) === quotient && parseInt(rVal, 10) === remainder) {
      sfx.correct();
      sfx.coin();
      setDone(true);
      onCorrect?.();
    } else {
      sfx.wrong();
      setShowHint(true);
      onWrong?.();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const Cell = ({ children }) => (
    <div
      style={{ width: CELL, height: CELL }}
      className="grid place-items-center font-mono text-2xl sm:text-3xl font-bold leading-none text-fg"
    >
      {children}
    </div>
  );
  const Spacer = ({ count }) => (
    <div style={{ width: CELL * count, height: CELL }} />
  );

  return (
    <div className="space-y-3" data-testid="remainder-division">
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* Quotient row */}
          <div className="flex items-end justify-start">
            <Spacer count={2} />
            <motion.input
              animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
              autoFocus
              inputMode="numeric"
              value={qVal}
              onChange={(e) => setQVal(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="q"
              data-testid="rem-q-input"
              disabled={done}
              className="brut-border bg-blue-50 dark:bg-blue-900/30 text-fg font-mono text-xl sm:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              style={{ width: CELL * Math.max(2, String(quotient).length), height: CELL - 4 }}
            />
            <span className="ml-3 font-mono text-base font-bold text-muted">remainder</span>
            <motion.input
              animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
              transition={{ duration: 0.3 }}
              inputMode="numeric"
              value={rVal}
              onChange={(e) => setRVal(e.target.value.replace(/[^0-9]/g, ""))}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder="r"
              data-testid="rem-r-input"
              disabled={done}
              className="ml-2 brut-border bg-blue-50 dark:bg-blue-900/30 text-fg font-mono text-xl sm:text-2xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              style={{ width: CELL * 2, height: CELL - 4 }}
            />
          </div>

          {/* Bar */}
          <div className="flex items-center" style={{ height: 6 }}>
            <Spacer count={2} />
            <div className="border-t-2 border-fg" style={{ width: CELL * cols, height: 6 }} />
          </div>

          {/* Divisor ⟍ Dividend row */}
          <div className="flex items-center">
            <div
              style={{ width: CELL * 1.5 }}
              className="font-mono text-2xl sm:text-3xl font-bold text-fg text-right pr-2"
            >
              {divisor}
            </div>
            <div
              style={{ width: CELL * 0.5, height: CELL }}
              className="font-mono text-2xl sm:text-3xl font-bold text-fg flex items-center"
            >
              ⟍
            </div>
            {dividendDigits.map((d, i) => (
              <Cell key={i}>{d}</Cell>
            ))}
          </div>

          {done && (
            <div
              className="mt-2 text-center text-emerald-600 dark:text-emerald-400 font-bold text-sm"
              data-testid="rem-done"
            >
              ✓ {dividend} ÷ {divisor} = {quotient} remainder {remainder}
            </div>
          )}
        </div>
      </div>

      {showHint && !done && (
        <div className="text-xs text-muted font-mono text-center">
          {dividend} ÷ {divisor} = {quotient} r {remainder}
        </div>
      )}

      <div className="flex justify-center pt-1">
        <button
          onClick={submit}
          disabled={done}
          data-testid="rem-submit"
          className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold text-sm px-6 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Enter ↵
        </button>
      </div>
    </div>
  );
};

export default RemainderDivision;
