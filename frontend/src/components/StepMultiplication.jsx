import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { sfx } from "@/lib/sound";

const CELL = 38;

// Visual long-multiplication walkthrough.
// problem = { a, b, partials, total, key }
export const StepMultiplication = ({ problem, onComplete, onWrong }) => {
  const { a, b, partials, total } = problem;
  const aStr = String(a);
  const bStr = String(b);
  // Layout width: enough columns to fit the total
  const cols = Math.max(String(total).length, aStr.length, bStr.length, ...partials.map((p) => String(p.shifted).length));

  // Steps: each partial is a step (user enters smallProduct), then a final step for the sum if multiple partials
  const stepCount = partials.length + (partials.length > 1 ? 1 : 0);
  const [revealed, setRevealed] = useState(0);
  const [value, setValue] = useState("");
  const [shake, setShake] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setRevealed(0);
    setValue("");
    setDone(false);
  }, [problem.key]);

  const currentStep = revealed; // index into "steps" 0..stepCount-1
  const isSumStep = partials.length > 1 && currentStep === partials.length;
  const expected = isSumStep ? total : partials[currentStep]?.smallProduct;
  const promptText = isSumStep
    ? `Add the partial products: ${partials.map((p) => p.shifted).join(" + ")}`
    : (() => {
        const p = partials[currentStep];
        if (!p) return "";
        const placeName =
          p.offset === 0
            ? "ones"
            : p.offset === 1
            ? "tens"
            : p.offset === 2
            ? "hundreds"
            : `place ${p.offset}`;
        return `Multiply ${a} × ${p.digit} (${placeName} digit of ${b})`;
      })();

  const submit = () => {
    if (currentStep >= stepCount) return;
    if (value === "") return;
    if (parseInt(value, 10) === expected) {
      sfx.correct();
      sfx.coin();
      const next = revealed + 1;
      setRevealed(next);
      setValue("");
      if (next >= stepCount) {
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

  // Render helpers
  const Cell = ({ children, faded = false }) => (
    <div
      style={{ width: CELL, height: CELL }}
      className={`grid place-items-center font-mono text-2xl sm:text-3xl font-bold leading-none ${
        faded ? "text-zinc-400 dark:text-zinc-500" : "text-fg"
      }`}
    >
      {children}
    </div>
  );

  const rightAligned = (str, width) => {
    const padded = String(str).padStart(width, " ");
    return padded.split("").map((ch, i) => (
      <Cell key={i}>{ch === " " ? "" : ch}</Cell>
    ));
  };

  const renderTopRow = () => (
    <div className="flex items-center">
      <div style={{ width: CELL }} />
      {rightAligned(a, cols)}
    </div>
  );

  const renderBottomRow = () => (
    <div className="flex items-center">
      <div
        style={{ width: CELL, height: CELL }}
        className="grid place-items-center font-mono text-2xl sm:text-3xl font-bold text-fg"
      >
        ×
      </div>
      {rightAligned(b, cols)}
    </div>
  );

  const renderBar = () => (
    <div className="flex items-center" style={{ height: 6 }}>
      <div style={{ width: CELL }} />
      <div
        className="border-t-2 border-fg"
        style={{ width: CELL * cols, height: 6 }}
      />
    </div>
  );

  const renderPartial = (p, idx) => {
    // For revealed partials we show the full shifted number (e.g. 920),
    // For the active step we show an input slot at the position of the smallProduct
    const shiftedStr = String(p.shifted);
    const isRevealed = idx < revealed;
    const isActive = idx === revealed && !done;

    if (isRevealed) {
      return (
        <div className="flex items-center" key={idx}>
          {idx === 0 ? (
            <div style={{ width: CELL }} />
          ) : (
            <div
              style={{ width: CELL, height: CELL }}
              className="grid place-items-center font-mono text-xl sm:text-2xl font-bold text-fg"
            >
              +
            </div>
          )}
          {rightAligned(shiftedStr, cols)}
        </div>
      );
    }

    if (isActive) {
      // Place the input where the smallProduct's rightmost digit sits at column (cols - 1 - p.offset)
      const smallStr = String(p.smallProduct);
      const smallLen = smallStr.length;
      // The shifted number's rightmost digit is at column (cols - 1) shifted by p.offset zeroes.
      // smallProduct rightmost is at column (cols - 1 - p.offset).
      const rightCol = cols - 1 - p.offset;
      const leftCol = rightCol - smallLen + 1;
      return (
        <div className="flex items-center" key={idx}>
          {idx === 0 ? (
            <div style={{ width: CELL }} />
          ) : (
            <div
              style={{ width: CELL, height: CELL }}
              className="grid place-items-center font-mono text-xl sm:text-2xl font-bold text-fg"
            >
              +
            </div>
          )}
          {Array.from({ length: cols }).map((_, i) => {
            if (i === leftCol) {
              return (
                <motion.input
                  key={i}
                  animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
                  transition={{ duration: 0.3 }}
                  autoFocus
                  inputMode="numeric"
                  value={value}
                  onChange={(e) =>
                    setValue(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  placeholder={"?".repeat(smallLen)}
                  data-testid={`mul-partial-input-${idx}`}
                  className="brut-border bg-blue-50 dark:bg-blue-900/30 text-fg font-mono text-lg sm:text-xl font-bold p-0 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  style={{ width: CELL * smallLen - 4, height: CELL - 4 }}
                />
              );
            }
            // skip cells that the input occupies
            if (i > leftCol && i <= rightCol) return null;
            // Show "0" placeholders to the right of smallProduct (the shift padding)
            if (i > rightCol && p.offset > 0 && i <= cols - 1) {
              return (
                <Cell key={i} faded>
                  0
                </Cell>
              );
            }
            return <Cell key={i} />;
          })}
        </div>
      );
    }

    // not revealed yet: empty row
    return (
      <div className="flex items-center" key={idx} style={{ height: CELL }}>
        {idx === 0 ? (
          <div style={{ width: CELL }} />
        ) : (
          <div
            style={{ width: CELL, height: CELL }}
            className="grid place-items-center text-muted"
          >
            +
          </div>
        )}
        {Array.from({ length: cols }).map((_, i) => (
          <Cell key={i} />
        ))}
      </div>
    );
  };

  const renderTotal = () => {
    const sumRevealed = isSumStep && false; // total only revealed when done
    if (partials.length === 1) {
      // single partial: total IS that partial; no sum step
      return null;
    }
    if (done) {
      return (
        <>
          {renderBar()}
          <div className="flex items-center">
            <div style={{ width: CELL }} />
            {rightAligned(total, cols)}
          </div>
        </>
      );
    }
    if (isSumStep) {
      const totalStr = String(total);
      const totalLen = totalStr.length;
      const leftCol = cols - totalLen;
      return (
        <>
          {renderBar()}
          <div className="flex items-center">
            <div style={{ width: CELL }} />
            {Array.from({ length: cols }).map((_, i) => {
              if (i === leftCol) {
                return (
                  <motion.input
                    key={i}
                    animate={shake ? { x: [-6, 6, -4, 4, 0] } : { x: 0 }}
                    transition={{ duration: 0.3 }}
                    autoFocus
                    inputMode="numeric"
                    value={value}
                    onChange={(e) =>
                      setValue(e.target.value.replace(/[^0-9]/g, ""))
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submit();
                    }}
                    placeholder={"?".repeat(totalLen)}
                    data-testid={`mul-total-input`}
                    className="brut-border bg-blue-50 dark:bg-blue-900/30 text-fg font-mono text-lg sm:text-xl font-bold p-0 text-center focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    style={{ width: CELL * totalLen - 4, height: CELL - 4 }}
                  />
                );
              }
              if (i > leftCol && i <= cols - 1) return null;
              return <Cell key={i} />;
            })}
          </div>
        </>
      );
    }
    return null;
  };

  return (
    <div className="space-y-2" data-testid="step-multiplication">
      <div className="overflow-x-auto pb-2">
        <div className="inline-block min-w-full">
          {renderTopRow()}
          {renderBottomRow()}
          {renderBar()}
          {partials.map((p, idx) => renderPartial(p, idx))}
          {renderTotal()}
        </div>
      </div>

      {!done && (
        <div
          className="surface brut-border-soft p-3 text-sm text-fg"
          data-testid="mul-step-prompt"
        >
          <span className="text-muted">
            Step {revealed + 1} of {stepCount}:
          </span>{" "}
          <span className="font-bold">{promptText}</span>
        </div>
      )}

      <div className="flex justify-center pt-2">
        <button
          onClick={submit}
          disabled={done}
          data-testid="mul-step-submit"
          className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold text-sm px-6 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Enter ↵
        </button>
      </div>

      {done && (
        <div
          className="text-center mt-2 text-emerald-600 dark:text-emerald-400 font-bold text-sm"
          data-testid="mul-step-done"
        >
          ✓ {a} × {b} = {total}
        </div>
      )}
    </div>
  );
};

export default StepMultiplication;
