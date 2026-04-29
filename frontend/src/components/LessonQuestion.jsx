// Brilliant-style in-lesson question UI — designed to fit a single viewport
// (no scroll). Picks one of several visualizations per question:
//   • dotGrid       – a×b grid of dots (multiplication, small factors)
//   • stackedBars   – b vertical bars of height a (multiplication, medium)
//   • clusters      – `b` round clusters each holding `a` dots (multiplication)
//   • numberLine    – horizontal number line with a marker (division, small)
//   • divGroups     – `quotient` rows of `divisor` (division, small/medium)
//   • bigNumber     – just the equation, for huge values
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle } from "lucide-react";

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

const NUM_WORDS = ["zero","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","fifteen","sixteen","seventeen","eighteen","nineteen","twenty"];
const wordsFor = (n) => (n <= 20 ? NUM_WORDS[n] : String(n));
const plainPrompt = (q) =>
  q.op === "×"
    ? `What is ${wordsFor(q.a)} times ${wordsFor(q.b)}?`
    : q.op === "÷"
    ? `What is ${wordsFor(q.a)} divided by ${wordsFor(q.b)}?`
    : `Solve ${q.prompt}`;

// Pick which visual to show. Deterministic per-question (stable on re-renders)
// but varies across questions thanks to q.key.
function visualKindFor(q) {
  // Hash q.key into [0..7] for a consistent rotation.
  let h = 0;
  for (const c of String(q.key || `${q.a}-${q.b}-${q.op}`)) h = (h * 31 + c.charCodeAt(0)) | 0;
  const variant = Math.abs(h) % 4;
  const product = q.a * q.b;
  if (q.op === "×") {
    if (q.a > 12 || q.b > 12 || product > 200) return "bigNumber";
    if (variant === 0) return "dotGrid";
    if (variant === 1) return "stackedBars";
    if (variant === 2) return "clusters";
    return "dotGrid";
  }
  if (q.op === "÷") {
    if (q.a > 80) return "bigNumber";
    if (q.a <= 30 && variant % 2 === 0) return "numberLine";
    return "divGroups";
  }
  return "bigNumber";
}

// ── Visualizations ────────────────────────────────────────────────────────
function DotGrid({ a, b }) {
  const rows = b, cols = a;
  return (
    <svg viewBox={`0 0 ${cols * 14} ${rows * 14}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: rows * cols }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <motion.circle
            key={i}
            cx={c * 14 + 7} cy={r * 14 + 7} r={5}
            fill="#10b981"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.012, duration: 0.18 }}
          />
        );
      })}
    </svg>
  );
}

function StackedBars({ a, b }) {
  // b columns, each a tall.
  const cols = b, rows = a;
  return (
    <svg viewBox={`0 0 ${cols * 26} ${rows * 18 + 6}`} preserveAspectRatio="xMidYMax meet" className="w-full h-full">
      {Array.from({ length: cols }).map((_, c) => (
        <g key={c}>
          {Array.from({ length: rows }).map((_, r) => {
            const y = (rows - 1 - r) * 18 + 4;
            return (
              <motion.rect
                key={r}
                x={c * 26 + 5}
                y={y}
                width={16}
                height={14}
                rx={2}
                fill={r === 0 ? "#06b6d4" : "#10b981"}
                initial={{ scaleY: 0, opacity: 0, originY: 1 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: (c * rows + r) * 0.02, duration: 0.18 }}
                style={{ transformOrigin: `${c * 26 + 13}px ${y + 14}px` }}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

function Clusters({ a, b }) {
  // b clusters arranged in a row, each cluster shows `a` small dots in a tight grid.
  const cols = Math.min(b, 6);
  const rows = Math.ceil(b / cols);
  const cellW = 56, cellH = 56;
  const innerCols = Math.ceil(Math.sqrt(a));
  const innerRows = Math.ceil(a / innerCols);
  return (
    <svg viewBox={`0 0 ${cols * cellW} ${rows * cellH}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: b }).map((_, i) => {
        const cx = (i % cols) * cellW + cellW / 2;
        const cy = Math.floor(i / cols) * cellH + cellH / 2;
        return (
          <g key={i}>
            <motion.circle
              cx={cx} cy={cy} r={cellW / 2 - 4}
              fill="none" stroke="#10b981" strokeWidth={2} strokeDasharray="3,3"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.03, duration: 0.2 }}
            />
            {Array.from({ length: a }).map((_, j) => {
              const ic = j % innerCols;
              const ir = Math.floor(j / innerCols);
              const x = cx - (innerCols - 1) * 5 + ic * 10;
              const y = cy - (innerRows - 1) * 5 + ir * 10;
              return (
                <motion.circle
                  key={j} cx={x} cy={y} r={3} fill="#10b981"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.03 + j * 0.01, duration: 0.15 }}
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

function NumberLine({ dividend, divisor }) {
  // Tick marks 0..dividend; highlight every `divisor`-th step + a marker at dividend.
  const max = dividend;
  const w = 380, h = 70;
  const margin = 14;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {/* Axis */}
      <line x1={margin} x2={w - margin} y1={h / 2} y2={h / 2} stroke="#52525b" strokeWidth={2} />
      {/* Ticks */}
      {Array.from({ length: max + 1 }).map((_, i) => {
        const x = margin + (i / max) * (w - margin * 2);
        const isStep = i > 0 && i % divisor === 0;
        return (
          <g key={i}>
            <motion.line
              x1={x} x2={x} y1={h / 2 - (isStep ? 12 : 5)} y2={h / 2 + (isStep ? 12 : 5)}
              stroke={isStep ? "#06b6d4" : "#71717a"}
              strokeWidth={isStep ? 2.5 : 1.5}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.025, duration: 0.18 }}
            />
            {isStep && (
              <motion.text
                x={x} y={h / 2 + 26} fontSize="10" fill="#06b6d4" textAnchor="middle"
                fontFamily="ui-monospace,monospace" fontWeight="700"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ delay: i * 0.025 + 0.15, duration: 0.2 }}
              >
                {i}
              </motion.text>
            )}
          </g>
        );
      })}
      {/* End markers */}
      <motion.circle
        cx={margin} cy={h / 2} r={5} fill="#52525b"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.2 }}
      />
      <motion.circle
        cx={w - margin} cy={h / 2} r={6} fill="#10b981"
        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: max * 0.025, duration: 0.2 }}
      />
      <text x={w - margin} y={h / 2 - 12} fontSize="11" fill="#10b981" textAnchor="middle"
        fontFamily="ui-monospace,monospace" fontWeight="700">
        {dividend}
      </text>
    </svg>
  );
}

function DivGroups({ dividend, divisor }) {
  // Show `dividend` dots arranged in rows of `divisor` (rows = quotient).
  const cols = divisor;
  const rows = Math.ceil(dividend / cols);
  return (
    <svg viewBox={`0 0 ${cols * 14} ${rows * 14}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: dividend }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <motion.circle
            key={i}
            cx={c * 14 + 7} cy={r * 14 + 7} r={5} fill="#06b6d4"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.012, duration: 0.18 }}
          />
        );
      })}
    </svg>
  );
}

function BigNumber({ a, b, symbol }) {
  return (
    <div className="grid place-items-center w-full h-full">
      <div className="font-mono font-black text-emerald-400 tabular-nums tracking-tight text-[clamp(2.5rem,8vw,5rem)]">
        {a} {symbol} {b}
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────
export default function LessonQuestion({ question, onAnswer, status }) {
  const [chosen, setChosen] = useState(null);
  const choices = useMemo(() => makeChoices(question.answer), [question.key]);
  const kind = useMemo(() => visualKindFor(question), [question.key]);
  useEffect(() => { setChosen(null); }, [question.key]);

  const submit = (n) => {
    if (status !== "idle") return;
    setChosen(n);
    setTimeout(() => onAnswer(n), 80);
  };

  const symbol = question.op;
  let visual;
  if (kind === "dotGrid")        visual = <DotGrid a={question.a} b={question.b} />;
  else if (kind === "stackedBars") visual = <StackedBars a={question.a} b={question.b} />;
  else if (kind === "clusters")  visual = <Clusters a={question.a} b={question.b} />;
  else if (kind === "numberLine") visual = <NumberLine dividend={question.a} divisor={question.b} />;
  else if (kind === "divGroups") visual = <DivGroups dividend={question.a} divisor={question.b} />;
  else visual = <BigNumber a={question.a} b={question.b} symbol={symbol} />;

  return (
    <div className="flex flex-col w-full h-full min-h-0" data-testid="lesson-question-card">
      {/* Plain-English prompt — compact */}
      <div className="text-fg text-base sm:text-lg font-medium leading-snug mb-2 px-1 shrink-0">
        {plainPrompt(question)}
      </div>

      {/* Visual canvas — fills remaining vertical space. */}
      <div className="brut-border bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-3 sm:p-4 mb-2 grid place-items-center flex-1 min-h-0 overflow-hidden" data-testid="lesson-question-visual">
        <div className="w-full h-full max-w-md mx-auto">
          {visual}
        </div>
      </div>

      {/* Drop slot — fixed height */}
      <div className="brut-border-soft surface-2 rounded-md py-1.5 mb-2 grid place-items-center shrink-0" data-testid="lesson-answer-slot">
        <AnimatePresence mode="wait">
          {chosen != null ? (
            <motion.div
              key={chosen}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className={`brut-border ${
                status === "correct"
                  ? "bg-emerald-500 text-white"
                  : status === "wrong"
                  ? "bg-rose-500 text-white"
                  : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
              } px-4 py-1 font-mono font-black text-2xl tabular-nums rounded-md`}
            >
              {chosen}
              {status === "correct" && <CheckCircle2 size={16} className="inline ml-1.5 -mt-1" />}
              {status === "wrong" && <XCircle size={16} className="inline ml-1.5 -mt-1" />}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-muted px-6 py-1 font-mono text-xl"
            >?</motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tile choices — fixed height */}
      <div className="grid grid-cols-3 gap-2 shrink-0" data-testid="lesson-answer-choices">
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
              className={`brut-border brut-shadow-sm py-3 px-2 font-mono font-black text-2xl tabular-nums transition-all rounded-md ${
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
  );
}
