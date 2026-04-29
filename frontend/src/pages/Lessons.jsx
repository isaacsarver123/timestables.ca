import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  X,
  CheckCircle2,
  XCircle,
  Sparkles,
  ArrowRight,
  Lightbulb,
  Gem,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import Question from "@/components/Question";
import ConfirmLeaveModal from "@/components/ConfirmLeaveModal";
import { useNavGuard } from "@/lib/leaveGuard";
import { generateQuestion, tableTips } from "@/lib/game";
import { addCoinsAndXp, recordAnswer, getState } from "@/lib/storage";
import { sfx } from "@/lib/sound";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ───────── Topic + difficulty config ─────────
const TOPICS = [
  { key: "multiplication", label: "Multiplication", op: "mul", icon: "×" },
  { key: "division",       label: "Division",       op: "div", icon: "÷" },
  { key: "long_mul",       label: "Long Mult.",     op: "mul", icon: "××" }, // long mode just uses 2-digit factors
  { key: "long_div",       label: "Long Div.",      op: "div", icon: "÷÷" },
];

const DIFF = {
  easy:   { label: "Easy",   tables: [2, 3, 4, 5, 10], maxFactor: 10, timePerQ: 9 },
  medium: { label: "Medium", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxFactor: 12, timePerQ: 6 },
  hard:   { label: "Hard",   tables: [3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], maxFactor: 18, timePerQ: 4 },
};

const TOTAL = 20;
const HARD_DOTS = 3;

// ───────── Build the run ─────────
function buildRun(selectedTopics, diff) {
  const cfg = DIFF[diff];
  const ops = [];
  selectedTopics.forEach((t) => {
    const topic = TOPICS.find((x) => x.key === t);
    if (!topic) return;
    const isLong = topic.key === "long_mul" || topic.key === "long_div";
    ops.push({ op: topic.op, isLong });
  });
  if (ops.length === 0) ops.push({ op: "mul", isLong: false });
  const out = [];
  for (let i = 0; i < TOTAL; i++) {
    const pick = ops[i % ops.length];
    const minFactor = pick.isLong ? 11 : 2;
    const maxFactor = pick.isLong ? Math.max(cfg.maxFactor, 19) : cfg.maxFactor;
    const q = generateQuestion(cfg.tables, { minFactor, maxFactor, op: pick.op });
    out.push({ ...q, isHard: pick.isLong });
  }
  // Deterministically pick HARD_DOTS positions to be flagged "hard" (last 6 quarter)
  const hardIdx = new Set();
  for (let i = TOTAL - 1; hardIdx.size < HARD_DOTS && i >= 0; i--) {
    hardIdx.add(i);
  }
  return out.map((q, i) => ({ ...q, isHard: q.isHard || hardIdx.has(i) }));
}

// ───────── Wrong-answer Duolingo-style explanation ─────────
function explain(q) {
  // Use the typed tableTips library — pull a "trick" or "formula".
  const factor = q.op === "mul" ? Math.max(q.a, q.b) : q.a;
  const tips = tableTips(factor);
  const explanation =
    tips.find((t) => t.kind === "trick") ||
    tips.find((t) => t.kind === "formula") ||
    tips[0];
  return explanation?.text || `${q.a} ${q.op === "mul" ? "×" : "÷"} ${q.b} = ${q.answer}.`;
}

// ───────── Page ─────────
export default function Lessons() {
  const [phase, setPhase] = useState("lobby"); // lobby | play | result
  const [topics, setTopics] = useState(["multiplication"]);
  const [difficulty, setDifficulty] = useState("medium");
  const [run, setRun] = useState([]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle"); // idle | correct | wrong | reviewing
  const [correct, setCorrect] = useState(0);
  const [hardCorrect, setHardCorrect] = useState(0);
  const [time, setTime] = useState(DIFF.medium.timePerQ);
  const [explanation, setExplanation] = useState(null);
  const [result, setResult] = useState(null); // { xp_earned, gems_earned, ... }
  const startedAt = useRef(0);
  const tickRef = useRef(null);

  const { refresh } = useAuth();
  const guard = useNavGuard(phase === "play");
  const nav = useNavigate();

  const cfg = DIFF[difficulty];
  const q = run[idx];

  // ── lobby helpers ─────────────────────────────────────────────────────────
  const toggleTopic = (key) => {
    if (key === "all") {
      // tap "All" → run all four; tap again to clear back to multiplication.
      const allKeys = TOPICS.map((t) => t.key);
      const isAllOn = topics.length === TOPICS.length;
      setTopics(isAllOn ? ["multiplication"] : allKeys);
      return;
    }
    const has = topics.includes(key);
    if (has) {
      const next = topics.filter((t) => t !== key);
      setTopics(next.length === 0 ? ["multiplication"] : next);
    } else {
      setTopics([...topics, key]);
    }
  };
  const isAllOn = topics.length === TOPICS.length;

  const startLesson = () => {
    const built = buildRun(topics, difficulty);
    setRun(built);
    setIdx(0);
    setValue("");
    setCorrect(0);
    setHardCorrect(0);
    setStatus("idle");
    setExplanation(null);
    setTime(DIFF[difficulty].timePerQ);
    setPhase("play");
    startedAt.current = performance.now();
  };

  // ── per-question timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (phase !== "play" || status !== "idle") return;
    if (time <= 0) { onWrong(); return; }
    tickRef.current = setTimeout(() => setTime((t) => t - 1), 1000);
    return () => clearTimeout(tickRef.current);
  }, [time, status, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── submit / advance ──────────────────────────────────────────────────────
  const submit = () => {
    if (status !== "idle") return;
    if (value === "" || value === "-") return;
    const guess = parseInt(value, 10);
    if (guess === q.answer) onCorrect();
    else onWrong(true);
  };

  const onCorrect = () => {
    sfx.correct(); sfx.coin();
    setCorrect((c) => c + 1);
    if (q.isHard) setHardCorrect((c) => c + 1);
    addCoinsAndXp(1, 3);
    recordAnswer({ a: q.a, b: q.b, op: q.op, correct: true, ms: 0 });
    setStatus("correct");
    setTimeout(advance, 600);
  };

  const onWrong = (typed = false) => {
    if (typed) sfx.wrong();
    recordAnswer({ a: q.a, b: q.b, op: q.op, correct: false, ms: 0 });
    setStatus("reviewing");
    setExplanation(explain(q));
  };

  const advance = () => {
    setExplanation(null);
    if (idx + 1 >= TOTAL) finishRun();
    else {
      setIdx(idx + 1);
      setValue("");
      setStatus("idle");
      setTime(DIFF[difficulty].timePerQ);
    }
  };

  const finishRun = async () => {
    const seconds = Math.round((performance.now() - startedAt.current) / 1000);
    setPhase("result");
    try {
      const { data } = await api.post("/lessons/finish", {
        topics, difficulty,
        questions_total: TOTAL,
        correct,
        hard_correct: hardCorrect,
        seconds_taken: seconds,
      });
      setResult(data);
      if (data.xp_earned > 0) addCoinsAndXp(0, data.xp_earned);
      if (data.gems_earned > 0) {
        // bump gems on the auth user
        await api.post("/gems/grant", { delta: data.gems_earned, reason: "perfect_lesson" })
          .catch(() => {/* server already credited via lessons/finish; this is just to refresh */});
        await refresh();
        toast.success(`Perfect lesson! +${data.gems_earned} gems`);
      }
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Could not save result");
    }
  };

  // ── render ────────────────────────────────────────────────────────────────
  if (phase === "lobby") {
    return (
      <div className="max-w-3xl mx-auto" data-testid="lessons-page">
        <Link to="/" className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1" data-testid="lessons-back">
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="mt-2 mb-7">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Mode</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Lesson</h1>
          <p className="text-sm text-muted mt-1.5">
            Pick what you want to practise — 20 questions, mistakes get a Duolingo-style explanation.
          </p>
        </div>

        {/* Topic chips */}
        <section className="mb-6">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">Topics</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {TOPICS.map((t) => {
              const on = !isAllOn && topics.includes(t.key);
              return (
                <button
                  key={t.key}
                  onClick={() => toggleTopic(t.key)}
                  data-testid={`lessons-topic-${t.key.replace("_", "-")}`}
                  className={`brut-border p-3 text-left transition-colors ${
                    on
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "surface-2 text-fg hover:surface"
                  }`}
                >
                  <div className="font-mono font-black text-xl">{t.icon}</div>
                  <div className="text-xs font-bold mt-1">{t.label}</div>
                </button>
              );
            })}
          </div>
          <button
            onClick={() => toggleTopic("all")}
            data-testid="lessons-topic-all"
            className={`mt-2 w-full brut-border-soft px-3 py-2 text-xs font-bold uppercase tracking-wider ${
              isAllOn
                ? "bg-amber-300 text-zinc-950"
                : "surface-2 text-muted hover:text-fg"
            }`}
          >
            All {isAllOn && "· on"}
          </button>
        </section>

        {/* Difficulty */}
        <section className="mb-7">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">Difficulty</h2>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(DIFF).map(([k, v]) => (
              <button
                key={k}
                onClick={() => setDifficulty(k)}
                data-testid={`lessons-difficulty-${k}`}
                className={`brut-border px-3 py-2.5 text-xs font-bold uppercase tracking-wider ${
                  difficulty === k
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                    : "surface-2 text-fg hover:surface"
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </section>

        <button
          onClick={startLesson}
          data-testid="lessons-start"
          className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-sm py-3.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all flex items-center justify-center gap-2"
        >
          Start lesson <ArrowRight size={16} />
        </button>
      </div>
    );
  }

  if (phase === "play") {
    const pct = ((idx + (status === "idle" ? 0 : 1)) / TOTAL) * 100;
    return (
      <div className="max-w-3xl mx-auto" data-testid="lessons-page">
        <ConfirmLeaveModal
          open={guard.open}
          onCancel={guard.cancel}
          onConfirm={guard.confirm}
          title="Quit the lesson?"
          body={
            <>
              Your XP for the <span className="font-bold text-fg">{idx}</span> question
              {idx === 1 ? "" : "s"} you've finished is saved, but you won't get the
              perfect-lesson <span className="font-bold text-fg">+25 XP</span> +
              <span className="font-bold text-fg"> 5 gems</span> bonus.
            </>
          }
          confirmLabel="Yes, leave"
          cancelLabel="No, keep going"
        />
        {/* Top bar: progress + hard dots + quit */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => guard.tryGo("/")}
            data-testid="exit-game"
            className="brut-border-soft surface p-1.5 hover:bg-rose-500 hover:text-white text-fg"
            aria-label="Quit lesson"
          >
            <X size={14} />
          </button>
          <div className="flex-1 h-3 brut-border surface overflow-hidden" data-testid="lesson-progress-bar">
            <motion.div
              className="h-full bg-emerald-500"
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <div className="flex items-center gap-1" data-testid="lesson-hard-dots">
            {Array.from({ length: HARD_DOTS }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full brut-border-soft ${
                  hardCorrect > i ? "bg-amber-400" : "surface-2"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Per-question timer pill */}
        <div className="mb-3 text-center">
          <span className="font-mono text-xs text-muted tabular-nums" data-testid="lesson-timer">
            {time}s
          </span>
        </div>

        {/* Explanation overlay */}
        <AnimatePresence>
          {status === "reviewing" && explanation && (
            <motion.div
              key="explanation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="surface brut-border brut-shadow p-5 sm:p-6 mb-4"
              data-testid="lesson-explanation"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 brut-border bg-rose-500 text-white grid place-items-center shrink-0">
                  <XCircle size={20} />
                </div>
                <div>
                  <div className="font-bold text-fg text-base">No, this isn't the answer.</div>
                  <div className="text-sm text-muted mt-0.5">
                    The answer is{" "}
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400 text-lg">
                      {q.answer}
                    </span>
                    .
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2 brut-border-soft surface-2 p-3 mb-4">
                <Lightbulb size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-sm text-fg leading-relaxed">{explanation}</p>
              </div>
              <button
                onClick={advance}
                data-testid="lesson-explanation-continue"
                className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs py-3 hover:bg-blue-600 hover:text-white"
              >
                Got it — continue
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Question */}
        {status !== "reviewing" && q && (
          <Question
            question={q}
            value={value}
            onChange={setValue}
            onSubmit={submit}
            status={status}
            disabled={status !== "idle"}
            correctAnswer={q.answer}
          />
        )}

        <div className="text-center mt-3 text-xs text-muted font-mono" data-testid="lesson-progress-text">
          Q{idx + 1} / {TOTAL}
        </div>
      </div>
    );
  }

  // result phase
  const accuracy = Math.round((correct / TOTAL) * 100);
  const isPerfect = correct === TOTAL;
  return (
    <div className="max-w-2xl mx-auto" data-testid="lessons-page">
      <div className="surface brut-border brut-shadow p-6 sm:p-8 text-center space-y-5" data-testid="lesson-end-screen">
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: [0.7, 1.15, 1], opacity: 1 }}
          transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
          className="inline-flex items-center gap-2 brut-border bg-emerald-500 text-white px-3 py-1.5 font-bold text-xs uppercase tracking-wider"
        >
          <CheckCircle2 size={14} /> Lesson complete
        </motion.div>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-fg">
          {isPerfect ? "Perfect." : accuracy >= 70 ? "Nicely done." : "Keep at it."}
        </h2>

        <div className="grid grid-cols-3 gap-2.5 max-w-md mx-auto">
          <Stat label="Correct" value={`${correct}/${TOTAL}`} />
          <Stat label="Accuracy" value={`${accuracy}%`} />
          <Stat label="Hard" value={`${hardCorrect}/${HARD_DOTS}`} />
        </div>

        <div className="grid grid-cols-2 gap-2.5 max-w-md mx-auto">
          <div className="brut-border-soft surface-2 p-3 text-left flex items-center gap-3" data-testid="lesson-xp-earned">
            <Zap size={20} className="text-blue-600" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">XP</div>
              <div className="font-bold text-fg text-xl tabular-nums">+{result?.xp_earned ?? 0}</div>
            </div>
          </div>
          <div className="brut-border-soft surface-2 p-3 text-left flex items-center gap-3" data-testid="lesson-gems-earned">
            <Gem size={20} className="text-cyan-500" />
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Gems</div>
              <div className="font-bold text-fg text-xl tabular-nums">+{result?.gems_earned ?? 0}</div>
            </div>
          </div>
        </div>

        {isPerfect && (
          <div className="flex items-center justify-center gap-2 text-amber-600 dark:text-amber-400 text-sm font-bold">
            <Sparkles size={14} /> Perfect bonus included
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <button
            onClick={() => setPhase("lobby")}
            data-testid="lesson-end-newlesson"
            className="flex-1 brut-border surface-2 text-fg px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white"
          >
            New lesson
          </button>
          <button
            onClick={() => nav("/")}
            data-testid="lesson-end-home"
            className="flex-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs px-3 py-2.5 hover:bg-blue-600 hover:text-white"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

const Stat = ({ label, value }) => (
  <div className="brut-border-soft surface-2 p-3">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">{label}</div>
    <div className="font-bold text-fg text-xl tabular-nums mt-0.5">{value}</div>
  </div>
);
