// Brilliant-style in-lesson UI. Compact, deterministic, fits a single viewport.
// Two-phase answer flow: tap a tile to SELECT (blue), then tap CHECK to commit.
// Parent handles the wrong-answer explanation card.
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, MoveHorizontal } from "lucide-react";
import { sfx } from "@/lib/sound";
import { getLessonMotionSettings, subscribeCms } from "@/lib/cms";

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
    if (q.a <= 20 && q.b <= 5) return "numberLine";
    return "divGroups";
  }
  return "bigNumber";
}

// Gentle repulsion — about 1/4 of the previous strength.
function repulsion(cx, cy, pointer, range, force) {
  if (!pointer) return { dx: 0, dy: 0 };
  const ddx = cx - pointer.x, ddy = cy - pointer.y;
  const dist = Math.sqrt(ddx * ddx + ddy * ddy);
  if (dist >= range || dist < 0.01) return { dx: 0, dy: 0 };
  const f = (1 - dist / range) * force;
  return { dx: (ddx / dist) * f, dy: (ddy / dist) * f };
}

function idleDrift(i, amp = 1.0) {
  const angleA = ((i * 47) % 360) * (Math.PI / 180);
  const angleB = angleA + 1.9;
  return {
    x1: Math.cos(angleA) * amp,
    y1: Math.sin(angleA) * amp,
    x2: Math.cos(angleB) * amp,
    y2: Math.sin(angleB) * amp,
    duration: 4.2 + (i % 5) * 0.45,
  };
}

const PUSH_FORCE = 0.75;
const PUSH_RANGE_MULT = 1.8;

// ── GroupedDots — `b` groups of `a` dots.
function GroupedDots({ a, b, motion }) {
  let rows = a, cols = b;
  if (rows > cols * 1.6) {
    [rows, cols] = [cols, rows];
  }
  const total = rows * cols;
  const dotR = total > 80 ? 2.5 : total > 40 ? 3.25 : total > 16 ? 4 : 6;
  const inGap = dotR * 2 + 6;
  const colGap = inGap + 12;
  const pad = dotR + 10;
  const W = (cols - 1) * colGap + inGap + pad * 2;
  const H = rows * inGap + pad * 2;

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
        const cx = pad + col * colGap + inGap / 2;
        const cy = pad + row * inGap + inGap / 2;
        const { dx, dy } = repulsion(cx, cy, pointer, inGap * (motion?.mouseRadius ?? PUSH_RANGE_MULT), motion?.mouseForce ?? PUSH_FORCE);
        const drift = idleDrift(i, motion?.driftAmount ?? 1.0);
        return (
          <motion.g
            key={i}
            animate={{ x: [drift.x1, drift.x2, drift.x1], y: [drift.y1, drift.y2, drift.y1] }}
            transition={{ duration: drift.duration, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.g
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
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── DotGrid — flat `rows × cols` grid
function DotGrid({ a, b, motion }) {
  let rows = b, cols = a;
  if (rows > cols * 1.6) [rows, cols] = [cols, rows];
  const total = rows * cols;
  const dotR = total > 80 ? 2.5 : total > 40 ? 3.25 : total > 16 ? 4 : 6;
  const gap = dotR * 2 + 8;
  const pad = dotR + 10;
  const W = cols * gap + pad * 2;
  const H = rows * gap + pad * 2;
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
        const cx = pad + c * gap + gap / 2;
        const cy = pad + r * gap + gap / 2;
        const { dx, dy } = repulsion(cx, cy, pointer, gap * (motion?.mouseRadius ?? PUSH_RANGE_MULT), motion?.mouseForce ?? PUSH_FORCE);
        const drift = idleDrift(i, motion?.driftAmount ?? 1.0);
        return (
          <motion.g
            key={i}
            animate={{ x: [drift.x1, drift.x2, drift.x1], y: [drift.y1, drift.y2, drift.y1] }}
            transition={{ duration: drift.duration, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.g
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
          </motion.g>
        );
      })}
    </svg>
  );
}

// ── Draggable number-line
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
      <div className="text-[10px] uppercase tracking-[0.25em] text-emerald-400 font-bold flex items-center gap-1.5 text-center">
        <MoveHorizontal size={11} /> drag the marker to where {dividend} ÷ {divisor} lands
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

function DivGroups({ dividend, divisor, motion }) {
  const cols = divisor;
  const rows = Math.ceil(dividend / cols);
  const dotR = dividend > 60 ? 3.25 : 4;
  const gap = dotR * 2 + 6;
  const pad = dotR + 8;
  const W = cols * gap + pad * 2;
  const H = rows * gap + pad * 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" className="w-full h-full">
      {Array.from({ length: dividend }).map((_, i) => {
        const drift = idleDrift(i, (motion?.driftAmount ?? 1.0) * 0.75);
        return (
          <motion.g
            key={i}
            animate={{ x: [drift.x1, drift.x2, drift.x1], y: [drift.y1, drift.y2, drift.y1] }}
            transition={{ duration: drift.duration, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.circle
              cx={pad + (i % cols) * gap + gap / 2}
              cy={pad + Math.floor(i / cols) * gap + gap / 2}
              r={dotR} fill="#06b6d4"
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.015, duration: 0.18 }}
            />
          </motion.g>
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
// Flow:
//   user taps a tile  → selected = n       (blue outline, not committed)
//   user taps CHECK   → committed = true   (reveal colours, sfx plays)
//       correct → brief green flash, ~900ms later call onAnswer(true)
//       wrong   → red flash + highlight the correct tile, call onAnswer(false)
// The parent is responsible for whatever comes next (explanation card, next Q).
export default function LessonQuestion({ question, onAnswer }) {
  const [selected, setSelected] = useState(null);
  const [committed, setCommitted] = useState(false);
  const [motion, setMotion] = useState(() => getLessonMotionSettings());
  const advanceTimer = useRef(null);
  const questionId = `${question.key ?? "no-key"}:${question.op}:${question.a}:${question.b}:${question.answer}`;
  const choices = useMemo(() => makeChoices(question.answer), [question.answer]);
  const kind = useMemo(() => visualKindFor(question), [question.a, question.b, question.op, question.key]);

  useEffect(() => {
    setSelected(null);
    setCommitted(false);
    if (advanceTimer.current) {
      clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }, [questionId]);

  useEffect(() => () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  useEffect(() => subscribeCms((doc) => {
    setMotion({
      driftAmount: Number(doc?.lesson_drift_amount ?? getLessonMotionSettings().driftAmount),
      mouseForce: Number(doc?.lesson_mouse_force ?? getLessonMotionSettings().mouseForce),
      mouseRadius: Number(doc?.lesson_mouse_radius ?? getLessonMotionSettings().mouseRadius),
    });
  }), []);

  const isCorrect = selected === question.answer;

  const pick = (n) => {
    if (committed) return;
    setSelected(n);
  };

  const check = () => {
    if (selected == null || committed) return;
    setCommitted(true);
    if (isCorrect) {
      sfx.correct();
      sfx.coin();
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
      advanceTimer.current = setTimeout(() => {
        advanceTimer.current = null;
        onAnswer(true, selected);
      }, 900);
    } else {
      if (advanceTimer.current) {
        clearTimeout(advanceTimer.current);
        advanceTimer.current = null;
      }
      sfx.wrong();
      onAnswer(false, selected);
    }
  };

  let visual;
  if (kind === "groupedDots")    visual = <GroupedDots a={question.a} b={question.b} motion={motion} />;
  else if (kind === "dotGrid")   visual = <DotGrid a={question.a} b={question.b} motion={motion} />;
  else if (kind === "numberLine") visual = (
    <DraggableNumberLine dividend={question.a} divisor={question.b}
      locked={committed}
      onPick={(v) => { if (!committed) { setSelected(v); } }} />
  );
  else if (kind === "divGroups") visual = <DivGroups dividend={question.a} divisor={question.b} motion={motion} />;
  else visual = <BigNumber a={question.a} b={question.b} symbol={question.op} />;

  // Slot colour: neutral while selecting, green/rose once committed.
  const slotColor = committed
    ? (isCorrect ? "bg-emerald-500 text-white" : "bg-rose-500 text-white")
    : selected != null
      ? "bg-blue-600 text-white"
      : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950";

  return (
    <div className="flex flex-col w-full h-full min-h-0" data-testid="lesson-question-card">
      <div className="text-fg text-base sm:text-lg font-medium leading-snug mb-2 px-1 shrink-0" data-testid="lesson-question-prompt">
        {plainPrompt(question)}
      </div>

      <div className="flex-1 min-h-0 grid place-items-center mb-2">
        <div
          className="brut-border bg-zinc-900 dark:bg-zinc-950 rounded-2xl p-4 sm:p-5 grid place-items-center w-full max-w-sm aspect-[4/3] max-h-[38vh] overflow-hidden"
          data-testid="lesson-question-visual"
        >
          <div className="w-full h-full">{visual}</div>
        </div>
      </div>

      <div className="brut-border-soft surface-2 rounded-md py-1.5 mb-2 grid place-items-center shrink-0" data-testid="lesson-answer-slot">
        <AnimatePresence mode="wait">
          {selected != null ? (
            <motion.div
              key={`${selected}-${committed}-${isCorrect}`}
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: committed && isCorrect ? [1, 1.18, 1] : 1, opacity: 1 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ duration: committed && isCorrect ? 0.45 : 0.18, ease: [0.34, 1.56, 0.64, 1] }}
              className={`brut-border ${slotColor} px-4 py-1 font-mono font-black text-2xl tabular-nums rounded-md`}
            >
              {selected}
              {committed && isCorrect && <CheckCircle2 size={16} className="inline ml-1.5 -mt-1" />}
              {committed && !isCorrect && <XCircle size={16} className="inline ml-1.5 -mt-1" />}
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
          const isPicked = selected === c;
          const isCorrectChoice = c === question.answer;
          let cls;
          if (!committed) {
            cls = isPicked
              ? "bg-blue-600 text-white ring-2 ring-blue-300"
              : "surface text-fg hover:-translate-y-0.5 hover:bg-blue-100 dark:hover:bg-blue-950/30";
          } else if (isPicked && isCorrect) {
            cls = "bg-emerald-500 text-white";
          } else if (isPicked && !isCorrect) {
            cls = "bg-rose-500 text-white";
          } else if (!isCorrect && isCorrectChoice) {
            cls = "bg-emerald-500 text-white";
          } else {
            cls = "surface text-muted opacity-60";
          }
          return (
            <motion.button
              key={c}
              onClick={() => pick(c)}
              disabled={committed}
              data-testid={`lesson-answer-tile-${c}`}
              animate={
                committed && isPicked && isCorrect ? { scale: [1, 1.08, 1] }
                : committed && isPicked && !isCorrect ? { x: [0, -6, 6, -4, 4, 0] }
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

      {/* CHECK button — committed state is owned by this component; parent
          only hears the commit through onAnswer(). On a correct answer we
          auto-advance after ~900ms so the user sees the green flash. */}
      <div className="mt-2 shrink-0">
        <button
          onClick={check}
          disabled={selected == null || committed}
          data-testid="lesson-check"
          className={`w-full brut-border brut-shadow font-bold uppercase tracking-wider text-xs py-3 rounded-md transition-colors ${
            selected != null && !committed
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-blue-600 hover:text-white"
              : committed && isCorrect
                ? "bg-emerald-500 text-white"
                : committed && !isCorrect
                  ? "bg-rose-500 text-white"
                  : "surface-2 text-muted cursor-not-allowed"
          }`}
        >
          {!committed ? "Check" : isCorrect ? "Correct!" : "See why →"}
        </button>
      </div>
    </div>
  );
}
