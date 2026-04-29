import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/sound";

const CELL = 38;

// Visual long-division walkthrough.
// Props: problem = { dividend, divisor, steps, quotient, key },
//        onComplete (called when last quotient digit is correct),
//        onWrong (called on each incorrect attempt).
export const StepDivision = ({ problem, onComplete, onWrong }) => {
  const { dividend, divisor, steps } = problem;
  const dividendDigits = String(dividend).split("").map(Number);
  const cols = dividendDigits.length;

  const [revealed, setRevealed] = useState(0);
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setRevealed(0);
    setValue("");
    setDone(false);
  }, [problem.key]);

  // dividend col -> step index that produces a quotient digit at that column
  const stepByCol = {};
  steps.forEach((s, idx) => {
    stepByCol[s.i] = idx;
  });

  const allDone = revealed >= steps.length;

  const submit = () => {
    if (allDone) return;
    if (value === "") return;
    const expected = steps[revealed].quotientDigit;
    if (parseInt(value, 10) === expected) {
      sfx.correct();
      sfx.coin();
      const next = revealed + 1;
      setRevealed(next);
      setValue("");
      if (next >= steps.length) {
        setDone(true);
        onComplete?.();
      }
    } else {
      sfx.wrong();
      onWrong?.();
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const Cell = ({ children, faded = false, highlight = false, ...rest }) => (
    <div
      style={{ width: CELL, height: CELL }}
      className={`grid place-items-center font-mono text-2xl sm:text-3xl font-bold leading-none ${
        faded ? "text-zinc-400 dark:text-zinc-600" : "text-fg"
      } ${highlight ? "bg-blue-100 dark:bg-blue-900/30 brut-border-soft" : ""}`}
      {...rest}
    >
      {children}
    </div>
  );

  const Spacer = ({ count }) => (
    <div style={{ width: CELL * count, height: CELL }} />
  );

  // Render product row: minus sign, then the product digits aligned so rightmost lands at step.i
  const renderProductRow = (step) => {
    const productStr = String(step.product);
    const productLen = productStr.length;
    const productLeftCol = step.i - productLen + 1;
    return (
      <div className="flex items-center">
        <div
          style={{ width: CELL * 1.5 }}
          className="text-right pr-1 font-mono text-xl sm:text-2xl text-fg"
        >
          −
        </div>
        <div style={{ width: CELL * 0.5 }} />
        {dividendDigits.map((_, i) => {
          const offset = i - productLeftCol;
          const ch = offset >= 0 && offset < productLen ? productStr[offset] : "";
          return (
            <Cell key={i} faded>
              {ch}
            </Cell>
          );
        })}
      </div>
    );
  };

  // Bar under the product
  const renderBar = (step) => {
    const productLen = String(step.product).length;
    const leftCol = step.i - productLen + 1;
    return (
      <div className="flex items-center" style={{ height: 6 }}>
        <Spacer count={2} />
        {dividendDigits.map((_, i) => {
          const inside = i >= leftCol && i <= step.i;
          return (
            <div
              key={i}
              style={{ width: CELL, height: 6 }}
              className={inside ? "border-t-2 border-fg" : ""}
            />
          );
        })}
      </div>
    );
  };

  // Remainder row: number after subtraction, right-aligned to step.i
  const renderRemainderRow = (step) => {
    const remStr = String(step.remainder);
    const partialLen = String(step.partial).length;
    // Pad to partial length so leading-zero positions show empty, but rightmost lands at step.i
    const padded = remStr.padStart(partialLen, " ");
    const leftCol = step.i - partialLen + 1;
    return (
      <div className="flex items-center">
        <Spacer count={2} />
        {dividendDigits.map((_, i) => {
          const offset = i - leftCol;
          let ch = "";
          if (offset >= 0 && offset < partialLen) {
            ch = padded[offset];
            if (ch === " ") ch = "";
          }
          return <Cell key={i}>{ch}</Cell>;
        })}
      </div>
    );
  };

  return (
    <div className="space-y-2" data-testid="step-division">
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {/* Quotient row */}
          <div className="flex items-center">
            <Spacer count={2} />
            {dividendDigits.map((_, i) => {
              const stepIdx = stepByCol[i];
              const showInput = stepIdx === revealed && !allDone;
              const showAnswer = stepIdx !== undefined && stepIdx < revealed;
              return (
                <div
                  key={i}
                  style={{ width: CELL, height: CELL }}
                  className="grid place-items-center"
                >
                  {showInput ? (
                    <motion.input
                      animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
                      transition={{ duration: 0.3 }}
                      autoFocus
                      inputMode="numeric"
                      value={value}
                      onChange={(e) =>
                        setValue(e.target.value.replace(/[^0-9]/g, "").slice(0, 1))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submit();
                      }}
                      placeholder="?"
                      data-testid={`q-input-${stepIdx}`}
                      className="w-full h-full text-center brut-border bg-blue-50 dark:bg-blue-900/30 text-fg font-mono text-xl font-bold p-0 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                      style={{ width: CELL - 4, height: CELL - 4 }}
                    />
                  ) : showAnswer ? (
                    <span
                      className="font-mono text-2xl sm:text-3xl font-bold text-blue-600 dark:text-blue-400"
                      data-testid={`q-digit-${stepIdx}`}
                    >
                      {steps[stepIdx].quotientDigit}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Bar over dividend */}
          <div className="flex items-center" style={{ height: 6 }}>
            <Spacer count={2} />
            <div
              className="border-t-2 border-fg"
              style={{ width: CELL * cols, height: 6 }}
            />
          </div>

          {/* Divisor ) Dividend row */}
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

          {/* Step rows */}
          {steps.slice(0, revealed).map((step, idx) => (
            <div key={idx} className="mt-1">
              {renderProductRow(step)}
              {renderBar(step)}
              {renderRemainderRow(step)}
            </div>
          ))}
        </div>
      </div>

      {/* Prompt */}
      {!allDone && (
        <div
          className="surface brut-border-soft p-3 text-sm text-fg"
          data-testid="step-prompt"
        >
          <span className="text-muted">
            Step {revealed + 1} of {steps.length}:
          </span>{" "}
          <span className="font-bold">
            How many times does {divisor} go into {steps[revealed].partial}?
          </span>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={submit}
          disabled={allDone}
          data-testid="step-submit"
          className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold text-sm px-6 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Enter ↵
        </button>
      </div>

      {done && (
        <div
          className="text-center mt-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm"
          data-testid="step-done"
        >
          ✓ {dividend} ÷ {divisor} = {problem.quotient}
        </div>
      )}
    </div>
  );
};

export default StepDivision;
