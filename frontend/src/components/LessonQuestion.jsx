// Brilliant-style in-lesson question UI.
// Full-bleed dark immersive canvas with a visual aid (dot grid) and tap-to-answer
// tiles. Distinct from the QuickFire / Streak / Boss / Daily UIs.
import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, RotateCcw, Lightbulb } from "lucide-react";

// Picks 2 plausible distractors near the correct answer.
function makeChoices(correct) {
  const set = new Set([correct]);
  let guard = 0;
  while (set.size < 3 && guard++ < 40) {
    let delta = Math.floor(Math.random() * 11) - 5;
    if (delta === 0) delta = 1;
    const c = correct + delta;
    if (c > 0 && Number.isFinite(c)) set.add(c);
  }
  return Array.from(set).sort(() => Math.random() - 0.5);
}

// ── Visual aids ───────────────────────────────────────────────────────────
// Multiplication: a×b dot grid. Division: cohort of `dividend` dots arranged
// into rows of `divisor` (so the answer is the count of rows).
function MulDotGrid({ a, b }) {
  const rows = b, cols = a;
  // Cap the rendered grid at ~400 dots to keep it readable.
  if (rows * cols > 400) return <BigNumberOnly a={a} b={b} symbol="×" />;
  const dotR = rows * cols > 144 ? 5 : rows * cols > 80 ? 7 : 9;
  const gap = dotR * 2 + 6;
  const w = cols * gap + dotR * 2;
  const h = rows * gap + dotR * 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((_, c) => (
          <motion.circle
            key={`${r}-${c}`}
            cx={dotR + c * gap + dotR}
            cy={dotR + r * gap + dotR}
            r={dotR}
            fill="#10b981"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: (r * cols + c) * 0.008, duration: 0.18 }}
          />
        ))
      )}
    </svg>
  );
}

function DivDotGrid({ dividend, divisor }) {
  // Show `dividend` dots arranged into rows of `divisor`. Total rows = quotient.
  if (dividend > 200) return <BigNumberOnly a={dividend} b={divisor} symbol="÷" />;
  const cols = divisor;
  const rows = Math.ceil(dividend / divisor);
  const dotR = dividend > 100 ? 5 : dividend > 50 ? 7 : 9;
  const gap = dotR * 2 + 6;
  const groupGap = 14;
  const w = cols * gap + dotR * 2 + groupGap;
  const h = rows * gap + dotR * 2;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-full">
      {Array.from({ length: dividend }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <motion.circle
            key={i}
            cx={dotR + c * gap + dotR}
            cy={dotR + r * gap + dotR}
            r={dotR}
            fill="#06b6d4"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.01, duration: 0.18 }}
          />
        );
      })}
    </svg>
  );
}

function BigNumberOnly({ a, b, symbol }) {
  return (
    <div className="grid place-items-center w-full h-full">
      <div className="font-mono font-black text-6xl sm:text-8xl text-emerald-400 tracking-tight tabular-nums">
        {a} {symbol} {b}
      </div>
    </div>
  );
}

// ── Plain-English prompts ─────────────────────────────────────────────────
const NUM_WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];
function wordsFor(n) { return n <= 20 ? NUM_WORDS[n] : String(n); }
function plainPrompt(q) {
  if (q.op === "×") return `What is ${wordsFor(q.a)} times ${wordsFor(q.b)}?`;
  if (q.op === "÷") return `What is ${wordsFor(q.a)} divided by ${wordsFor(q.b)}?`;
  return `Solve ${q.prompt}`;
}

// ── Component ─────────────────────────────────────────────────────────────
export default function LessonQuestion({ question, onAnswer, status, hint }) {
  const [chosen, setChosen] = useState(null);
  const choices = useMemo(() => makeChoices(question.answer), [question.key]);
  useEffect(() => { setChosen(null); }, [question.key]);

  const submit = (n) => {
    if (status !== "idle") return;
    setChosen(n);
    setTimeout(() => onAnswer(n), 80);
  };

  const isMul = question.op === "×";
  const isDiv = question.op === "÷";

  return (
    <div className="w-full" data-testid="lesson-question-card">
      {/* Plain-English prompt */}
      <div className="text-fg text-xl sm:text-2xl font-medium leading-snug mb-6 px-2">
        {plainPrompt(question)}
      </div>

      {/* Visual canvas */}
      <div className="brut-border bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-6 sm:p-10 mb-6 grid place-items-center min-h-[260px] sm:min-h-[340px]" data-testid="lesson-question-visual">
        <div className="w-full max-w-md aspect-[4/3]">
          {isMul ? (
            <MulDotGrid a={question.a} b={question.b} />
          ) : isDiv ? (
            <DivDotGrid dividend={question.a} divisor={question.b} />
          ) : (
            <BigNumberOnly a={question.a} b={question.b} symbol={question.op} />
          )}
        </div>
      </div>

      {/* Drop slot — shows the chosen tile (or empty dashed box) */}
      <div className="brut-border-soft surface-2 rounded-xl p-4 mb-3 grid place-items-center min-h-[88px]" data-testid="lesson-answer-slot">
        <AnimatePresence mode="wait">
          {chosen != null ? (
            <motion.div
              key={chosen}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className={`brut-border ${
                status === "correct"
                  ? "bg-emerald-500 text-white"
                  : status === "wrong"
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              } px-6 py-3 font-mono font-black text-3xl tabular-nums rounded-md`}
            >
              {chosen}
              {status === "correct" && <CheckCircle2 size={20} className="inline ml-2 -mt-1" />}
              {status === "wrong" && <XCircle size={20} className="inline ml-2 -mt-1" />}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="brut-border-soft border-dashed text-muted px-8 py-3 rounded-md font-mono"
            >
              ?
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tile choices */}
      <div className="brut-border-soft surface-2 rounded-xl p-4">
        <div className="grid grid-cols-3 gap-3" data-testid="lesson-answer-choices">
          {choices.map((c) => {
            const isPicked = chosen === c;
            const isCorrectChoice = c === question.answer;
            const showState = status !== "idle" && (isPicked || (status === "wrong" && isCorrectChoice));
            return (
              <button
                key={c}
                onClick={() => submit(c)}
                disabled={status !== "idle"}
                data-testid={`lesson-answer-tile-${c}`}
                className={`brut-border brut-shadow-sm py-4 sm:py-5 px-2 font-mono font-black text-2xl sm:text-3xl tabular-nums transition-all rounded-md ${
                  showState && isCorrectChoice
                    ? "bg-emerald-500 text-white"
                    : showState && isPicked
                    ? "bg-rose-500 text-white"
                    : isPicked
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "surface text-fg hover:-translate-y-0.5 hover:bg-blue-100 dark:hover:bg-blue-950/30"
                } disabled:cursor-not-allowed`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      {hint && (
        <div className="mt-4 flex items-start gap-2 brut-border-soft surface-2 p-3 rounded-md">
          <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-fg leading-relaxed">{hint}</p>
        </div>
      )}
    </div>
  );
}

// ── Sibling: "Start over" small button (purely cosmetic linkage; lobby owns the real exit) ──
export const StartOverHint = ({ onClick }) => (
  <button
    onClick={onClick}
    className="text-xs text-muted hover:text-fg flex items-center gap-1.5 mx-auto mt-6"
    data-testid="lesson-start-over"
  >
    <RotateCcw size={12} /> Start over
  </button>
);
