// Brilliant-style in-lesson UI. Compact, deterministic, fits a single viewport.
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
  const variant = Math.abs(h) % 2;
  const product = q.a * q.b;
  if (q.op === "×") {
    if (q.a > 12 || q.b > 12 || product > 200) return "bigNumber";
    return variant === 0 ? "groupedDots" : "dotGrid";
  }
  if (q.op === "÷") {
    if (q.a > 80) return "bigNumber";
    if (q.a <= 30 && q.b <= 10) return "numberLine";
    return "divGroups";
  }
  return "bigNumber";
}

// Repulsion helper — gentle, tightened ranges
function repulsion(cx, cy, pointer, range, force) {
  if (!pointer) return { dx: 0, dy: 0 };
  const ddx = cx - pointer.x, ddy = cy - pointer.y;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist >= range || dist < 0.01) return { dx: 0, dy: 0 };
  const f = (1 - dist / range) * force;
  return { dx: (ddx / dist) * f, dy: (ddy / dist) * f };
}

// ── GroupedDots — `b` groups of `a` dots. Auto-transposes when one factor
// is much larger than the other so the layout always stays close to the 5/4
// canvas aspect (no clipping). Dots scale down for higher counts.
function GroupedDots({ a, b }) {
  // Transpose when rows would be much taller than cols, to fit a 5/4 canvas.
  let rows = a, cols = b;
  if (rows > cols * 1.6) {
    [rows, cols] = [cols, rows];
  }
  const total = rows * cols;
  const dotR = total > 80 ? 3 : total > 40 ? 4 : total > 16 ? 5 : 7;
  const inGap = dotR * 2 + 6;
  const colGap = inGap + 12;
  const W = (cols - 1) * colGap + inGap;
  const H = rows * inGap;

  const svgRef = useRef(null);
  const [pointer, setPointer] = useState(null);
  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setPointer({ x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H });
  };

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      onMouseMove={onMove}
      onMouseLeave={() => setPointer(null)}
    >
      {Array.from({ length: total }).map((_, i) => {
        const col = Math.floor(i / rows);
        const row = i % rows;
        const cx = col * colGap + inGap / 2;
        const cy = row * inGap + inGap / 2;
        const { dx, dy } = repulsion(cx, cy, pointer, inGap * 1.6, 2.5);
        return (
          <motion.g
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: dx, y: dy }}
            transition={{
              scale:   { delay: i * 0.012, duration: 0.18 },
              opacity: { delay: i * 0.012, duration: 0.18 },
              x:       { type: "spring", stiffness: 240, damping: 26 },
              y:       { type: "spring", stiffness: 240, damping: 26 },
            }}
            style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "fill-box" }}
          >
            <circle cx={cx} cy={cy} r={dotR} fill="#10b981" />
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── DotGrid — flat `rows × cols` grid (auto-transposes for tall layouts) ─
function DotGrid({ a, b }) {
  let rows = b, cols = a;
  if (rows > cols * 1.6) [rows, cols] = [cols, rows];
  const total = rows * cols;
  const dotR = total > 80 ? 3 : total > 40 ? 4 : total > 16 ? 5 : 7;
  const gap = dotR * 2 + 8;
  const W = cols * gap, H = rows * gap;
  const svgRef = useRef(null);
  const [pointer, setPointer] = useState(null);
  const onMove = (e) => {
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setPointer({ x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H });
  };
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      onMouseMove={onMove}
      onMouseLeave={() => setPointer(null)}
    >
      {Array.from({ length: total }).map((_, i) => {
        const r = Math.floor(i / cols);
        const c = i % cols;
        const cx = c * gap + gap / 2;
        const cy = r * gap + gap / 2;
        const { dx, dy } = repulsion(cx, cy, pointer, gap * 1.6, 2.5);
        return (
          <motion.g
            key={i}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, x: dx, y: dy }}
            transition={{
              scale:   { delay: i * 0.012, duration: 0.18 },
              opacity: { delay: i * 0.012, duration: 0.18 },
              x:       { type: "spring", stiffness: 240, damping: 26 },
              y:       { type: "spring", stiffness: 240, damping: 26 },
            }}
            style={{ transformOrigin: `${cx}px ${cy}px`, transformBox: "fill-box" }}
          >
            <circle cx={cx} cy={cy} r={dotR} fill="#10b981" />
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Draggable number-line ─────────────────────────────────────────────────
function DraggableNumberLine({ dividend, divisor, onPick, locked }) {
  const max = dividend;
  const W = 380, H = 90;
  const margin = 18;
  const svgRef = useRef(null);
  const [val, setVal] = useState(0);
  const [dragging, setDragging] = useState(false);

  const xForVal = (v) => margin + (v / max) * (W - margin * 2);
  const valForX = (x) => Math.round(Math.max(0, Math.min(1, (x - margin) / (W - margin * 2))) * max);
  const handle = (e) => {
    if (locked) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    setVal(valForX(((e.clientX - r.left) / r.width) * W));
  };
  const onDown = (e) => { setDragging(true); handle(e); e.target.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (dragging) handle(e); };
  const onUp = () => { if (!dragging) return; setDragging(false); if (val > 0) onPick?.(val); };

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
          const isStep = i > 0 && i % divisor === 0;
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
                <text x={x} y={H / 2 + 26} fontSize="10" fill="#06b6d4" textAnchor="middle"
                      fontFamily="ui-monospace,monospace" fontWeight="700">{i}</text>
              )}
            </g>
          );
        })}
        <motion.g animate={{ x: xForVal(val) }} transition={{ type: "spring", stiffness: 320, damping: 26 }}>
          <circle cx={0} cy={H / 2} r={11} fill="#10b981" stroke="#fff" strokeWidth={2} />
          <text x={0} y={H / 2 - 18} fontSize="12" fill="#10b981" textAnchor="middle"
                fontFamily="ui-monospace,monospace" fontWeight="800">{val}</text>
        </motion.g>
      </svg>
    </div>
  );
}

function DivGroups({ dividend, divisor }) {
  const cols = divisor;
  const rows = Math.ceil(dividend / cols);
  const dotR = dividend > 60 ? 4 : 5;
  const gap = dotR * 2 + 6;
  const W = cols * gap, H = rows * gap;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: dividend }).map((_, i) => (
        <motion.circle
          key={i}
          cx={(i % cols) * gap + gap / 2} cy={Math.floor(i / cols) * gap + gap / 2}
          r={dotR} fill="#06b6d4"
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: i * 0.015, duration: 0.18 }}
        />
      ))}
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
  // Reset chosen whenever the question changes — guard against stale state.
  useEffect(() => { setChosen(null); }, [question.key]);

  // LOCAL correctness — used so the slot/tile flash green/rose IMMEDIATELY,
  // regardless of how fast the parent's `status` prop updates. Bulletproof
  // against any race condition.
  const localCorrect = chosen != null && chosen === question.answer;
  const localResolved = chosen != null;

  const submit = (n) => {
    if (chosen != null) return; // already answered locally — guard against double-submit only
    setChosen(n);
    onAnswer(n);
  };

  let visual;
  if (kind === "groupedDots")    visual = <GroupedDots a={question.a} b={question.b} />;
  else if (kind === "dotGrid")   visual = <DotGrid a={question.a} b={question.b} />;
  else if (kind === "numberLine") visual = (
    <DraggableNumberLine dividend={question.a} divisor={question.b}
      locked={chosen != null || status !== "idle"} onPick={submit} />
  );
  else if (kind === "divGroups") visual = <DivGroups dividend={question.a} divisor={question.b} />;
  else visual = <BigNumber a={question.a} b={question.b} symbol={question.op} />;

  // Slot / tile colour driven by LOCAL state first, parent status second.
  const slotColor = localResolved
    ? (localCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")
    : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950";

  return (
    <div className="flex flex-col w-full h-full min-h-0" data-testid="lesson-question-card">
      <div className="text-fg text-base sm:text-lg font-medium leading-snug mb-2 px-1 shrink-0">
        {plainPrompt(question)}
      </div>

      <div className="flex-1 min-h-0 grid place-items-center mb-2">
        <div
          className="brut-border bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-4 sm:p-5 grid place-items-center w-full max-w-sm aspect-[5/4] max-h-[42vh] overflow-hidden"
          data-testid="lesson-question-visual"
        >
          <div className="w-full h-full">{visual}</div>
        </div>
      </div>

      <div className="brut-border-soft surface-2 rounded-md py-1.5 mb-2 grid place-items-center shrink-0" data-testid="lesson-answer-slot">
        <AnimatePresence mode="wait">
          {chosen != null ? (
            <motion.div
              key={`${chosen}-${localCorrect}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: localCorrect ? [1, 1.18, 1] : 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: localCorrect ? 0.45 : 0.18, ease: [0.34, 1.56, 0.64, 1] }}
              className={`brut-border ${slotColor} px-4 py-1 font-mono font-black text-2xl tabular-nums rounded-md`}
            >
              {chosen}
              {localCorrect && <CheckCircle2 size={16} className="inline ml-1.5 -mt-1" />}
              {!localCorrect && <XCircle size={16} className="inline ml-1.5 -mt-1" />}
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

      <div className="grid grid-cols-3 gap-2 shrink-0" data-testid="lesson-answer-choices">
        {choices.map((c) => {
          const isPicked = chosen === c;
          const isCorrectChoice = c === question.answer;
          // Color from LOCAL state — instant feedback, no parent dependency.
          let cls = "surface text-fg hover:-translate-y-0.5 hover:bg-blue-100 dark:hover:bg-blue-950/30";
          if (localResolved && isPicked && localCorrect) cls = "bg-emerald-500 text-white";
          else if (localResolved && isPicked && !localCorrect) cls = "bg-rose-500 text-white";
          else if (localResolved && !localCorrect && isCorrectChoice) cls = "bg-emerald-500 text-white";
          return (
            <motion.button
              key={c}
              onClick={() => submit(c)}
              disabled={localResolved || status !== "idle"}
              data-testid={`lesson-answer-tile-${c}`}
              animate={
                localResolved && isPicked && localCorrect ? { scale: [1, 1.08, 1] }
                : localResolved && isPicked && !localCorrect ? { x: [0, -6, 6, -4, 4, 0] }
                : { scale: 1, x: 0 }
              }
              transition={{ duration: 0.4 }}
              className={`brut-border brut-shadow-sm py-3 px-2 font-mono font-black text-2xl tabular-nums transition-colors rounded-md ${cls} disabled:cursor-not-allowed`}
            >
              {c}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
