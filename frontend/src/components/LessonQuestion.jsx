// Brilliant-style in-lesson UI: compact, proportional visualizations + a drop
// slot + 3 multiple-choice tiles. Designed to fit a single viewport.
//
// Visualizations rotate per-question (deterministic from q.key):
//   • dotGrid       — a × b dots with subtle cursor-repulsion
//   • stackedBars   — b columns of height a (animated rise)
//   • clusters      — b small groupings, each of size a  (NO outer ring)
//   • numberLine    — DRAGGABLE marker the user slides to the answer
//   • divGroups     — `dividend` dots in rows of `divisor`
//   • bigNumber     — equation only (for product > 200 / dividend > 80)
//
// Canvas is hard-capped (`max-w-sm max-h-[42vh] aspect-[5/4]`) so 2×1 looks
// proportional — not the screen-filling block we had before.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, MoveHorizontal } from "lucide-react";

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

function visualKindFor(q) {
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
    // Number line for tidy small ones; div groups otherwise.
    if (q.a <= 30 && q.b <= 10) return "numberLine";
    return "divGroups";
  }
  return "bigNumber";
}

// ── Dot grid with cursor-repulsion ────────────────────────────────────────
// Dots near the pointer drift gently away (max ~6px) to feel alive.
function DotGrid({ a, b }) {
  const rows = b, cols = a;
  const total = rows * cols;
  const dotR = total > 100 ? 4 : total > 40 ? 5 : 6;
  const gap = dotR * 2 + 8;
  const W = cols * gap, H = rows * gap;
  const svgRef = useRef(null);
  const [pointer, setPointer] = useState(null);

  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const py = ((e.clientY - rect.top) / rect.height) * H;
    setPointer({ x: px, y: py });
  };
  const onLeave = () => setPointer(null);

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {Array.from({ length: total }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cx = c * gap + gap / 2;
        const cy = r * gap + gap / 2;
        let dx = 0, dy = 0;
        if (pointer) {
          const ddx = cx - pointer.x;
          const ddy = cy - pointer.y;
          const dist = Math.sqrt(ddx * ddx + ddy * ddy);
          const range = gap * 2.5;
          if (dist < range && dist > 0.001) {
            const force = (1 - dist / range) * 7; // up to 7px push
            dx = (ddx / dist) * force;
            dy = (ddy / dist) * force;
          }
        }
        return (
          <motion.circle
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, cx: cx + dx, cy: cy + dy }}
            transition={{
              scale:   { delay: i * 0.012, duration: 0.18 },
              opacity: { delay: i * 0.012, duration: 0.18 },
              cx:      { type: "spring", stiffness: 220, damping: 22 },
              cy:      { type: "spring", stiffness: 220, damping: 22 },
            }}
            r={dotR}
            fill="#10b981"
          />
        );
      })}
    </svg>
  );
}

// ── Stacked bars: b columns, each a tall ──────────────────────────────────
function StackedBars({ a, b }) {
  // Cap visible columns to keep small-count cases from stretching.
  const cols = b, rows = a;
  const cellW = 22, cellH = 16, pad = 4;
  const W = cols * cellW + pad * 2;
  const H = rows * cellH + pad * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" className="w-full h-full">
      {Array.from({ length: cols }).map((_, c) => (
        <g key={c}>
          {Array.from({ length: rows }).map((_, r) => {
            const y = pad + (rows - 1 - r) * cellH;
            return (
              <motion.rect
                key={r}
                x={pad + c * cellW + 3}
                y={y}
                width={cellW - 6}
                height={cellH - 2}
                rx={2}
                fill={r === rows - 1 ? "#06b6d4" : "#10b981"}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={{ scaleY: 1, opacity: 1 }}
                transition={{ delay: (c * rows + r) * 0.025, duration: 0.18 }}
                style={{ transformOrigin: `${pad + c * cellW + cellW / 2}px ${y + cellH - 1}px` }}
              />
            );
          })}
        </g>
      ))}
    </svg>
  );
}

// ── Clusters: b small groups of a dots — NO outer ring (per UX feedback) ──
function Clusters({ a, b }) {
  const cols = Math.min(b, 5);
  const rows = Math.ceil(b / cols);
  const cellW = 56, cellH = 56;
  const innerCols = Math.max(1, Math.ceil(Math.sqrt(a)));
  const innerRows = Math.ceil(a / innerCols);
  const W = cols * cellW;
  const H = rows * cellH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: b }).map((_, i) => {
        const cx = (i % cols) * cellW + cellW / 2;
        const cy = Math.floor(i / cols) * cellH + cellH / 2;
        return (
          <motion.g
            key={i}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.04, duration: 0.22 }}
            style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "fill-box" }}
          >
            {/* Subtle backdrop tile (no border ring). */}
            <rect
              x={cx - cellW / 2 + 4} y={cy - cellH / 2 + 4}
              width={cellW - 8} height={cellH - 8} rx={8}
              fill="rgba(16,185,129,0.08)"
            />
            {Array.from({ length: a }).map((_, j) => {
              const ic = j % innerCols;
              const ir = Math.floor(j / innerCols);
              const x = cx - (innerCols - 1) * 5 + ic * 10;
              const y = cy - (innerRows - 1) * 5 + ir * 10;
              return (
                <motion.circle
                  key={j} cx={x} cy={y} r={3.5} fill="#10b981"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: i * 0.04 + j * 0.012, duration: 0.18 }}
                />
              );
            })}
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Draggable number-line: user slides a marker to the answer position ────
// The marker snaps to integer ticks and reports back via onPick when released
// at the correct value. Rendered SVG with pointer events (no extra deps).
function DraggableNumberLine({ dividend, divisor, onPick, locked }) {
  const max = dividend;
  const W = 380, H = 90;
  const margin = 18;
  const svgRef = useRef(null);
  const [val, setVal] = useState(0);
  const [dragging, setDragging] = useState(false);

  const xForVal = (v) => margin + (v / max) * (W - margin * 2);
  const valForX = (x) => {
    const t = Math.max(0, Math.min(1, (x - margin) / (W - margin * 2)));
    return Math.round(t * max);
  };
  const handlePointer = (e) => {
    if (locked) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    setVal(valForX(x));
  };
  const onDown = (e) => { setDragging(true); handlePointer(e); e.target.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (dragging) handlePointer(e); };
  const onUp = () => {
    if (!dragging) return;
    setDragging(false);
    if (val > 0) onPick?.(val);
  };

  const stepEvery = divisor; // highlighted tick every divisor units
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
      <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-bold flex items-center gap-1.5">
        <MoveHorizontal size={11} /> drag the marker · {dividend} ÷ {divisor}
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-auto select-none touch-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        style={{ cursor: locked ? "default" : "grab" }}
      >
        <line x1={margin} x2={W - margin} y1={H / 2} y2={H / 2} stroke="#52525b" strokeWidth={2} />
        {Array.from({ length: max + 1 }).map((_, i) => {
          const x = xForVal(i);
          const isStep = i > 0 && i % stepEvery === 0;
          return (
            <g key={i}>
              <line
                x1={x} x2={x}
                y1={H / 2 - (isStep ? 11 : 5)}
                y2={H / 2 + (isStep ? 11 : 5)}
                stroke={isStep ? "#06b6d4" : "#71717a"}
                strokeWidth={isStep ? 2.5 : 1.5}
              />
              {isStep && (
                <text
                  x={x} y={H / 2 + 26} fontSize="10" fill="#06b6d4" textAnchor="middle"
                  fontFamily="ui-monospace,monospace" fontWeight="700"
                >{i}</text>
              )}
            </g>
          );
        })}
        {/* Marker */}
        <motion.g
          animate={{ x: xForVal(val) }}
          transition={{ type: "spring", stiffness: 320, damping: 26 }}
          style={{ x: xForVal(val) }}
        >
          <circle cx={0} cy={H / 2} r={11} fill="#10b981" stroke="#fff" strokeWidth={2} />
          <text x={0} y={H / 2 - 18} fontSize="12" fill="#10b981" textAnchor="middle"
            fontFamily="ui-monospace,monospace" fontWeight="800">
            {val}
          </text>
        </motion.g>
      </svg>
    </div>
  );
}

// ── Division groups (dividend dots arranged in rows of divisor) ───────────
function DivGroups({ dividend, divisor }) {
  const cols = divisor;
  const rows = Math.ceil(dividend / cols);
  const dotR = dividend > 60 ? 4 : 5;
  const gap = dotR * 2 + 6;
  const W = cols * gap;
  const H = rows * gap;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: dividend }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        return (
          <motion.circle
            key={i}
            cx={c * gap + gap / 2} cy={r * gap + gap / 2} r={dotR} fill="#06b6d4"
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
      <div className="font-mono font-black text-emerald-400 tabular-nums tracking-tight text-[clamp(2.25rem,7vw,4.5rem)]">
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

  let visual;
  if (kind === "dotGrid")        visual = <DotGrid a={question.a} b={question.b} />;
  else if (kind === "stackedBars") visual = <StackedBars a={question.a} b={question.b} />;
  else if (kind === "clusters")  visual = <Clusters a={question.a} b={question.b} />;
  else if (kind === "numberLine") visual = (
    <DraggableNumberLine
      dividend={question.a}
      divisor={question.b}
      locked={status !== "idle"}
      onPick={(v) => submit(v)}
    />
  );
  else if (kind === "divGroups") visual = <DivGroups dividend={question.a} divisor={question.b} />;
  else visual = <BigNumber a={question.a} b={question.b} symbol={question.op} />;

  return (
    <div className="flex flex-col w-full h-full min-h-0" data-testid="lesson-question-card">
      {/* Plain-English prompt — compact */}
      <div className="text-fg text-base sm:text-lg font-medium leading-snug mb-2 px-1 shrink-0">
        {plainPrompt(question)}
      </div>

      {/* Visual canvas — capped so small a × b values stay proportional. */}
      <div className="flex-1 min-h-0 grid place-items-center mb-2">
        <div
          className="brut-border bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-4 sm:p-5 grid place-items-center w-full max-w-sm aspect-[5/4] max-h-[40vh] overflow-hidden"
          data-testid="lesson-question-visual"
        >
          <div className="w-full h-full">{visual}</div>
        </div>
      </div>

      {/* Drop slot */}
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

      {/* Tile choices */}
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
