import { useEffect, useMemo, useRef, useState } from "react";
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
  Lock,
  Star,
  Trophy,
  Heart,
  Infinity as InfinityIcon,
  GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import Question from "@/components/Question";
import LessonQuestion from "@/components/LessonQuestion";
import LessonLoading from "@/components/LessonLoading";
import ConfirmLeaveModal from "@/components/ConfirmLeaveModal";
import { useNavGuard } from "@/lib/leaveGuard";
import { generateQuestion, tableTips } from "@/lib/game";
import { addCoinsAndXp, recordAnswer } from "@/lib/storage";
import { sfx } from "@/lib/sound";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { buildGiantPath, flattenPath, TOTAL_LESSONS_TARGET } from "@/lib/lessonPath";

const TOPICS = [
  { key: "multiplication", label: "Multiplication", op: "mul", icon: "×" },
  { key: "division",       label: "Division",       op: "div", icon: "÷" },
  { key: "long_mul",       label: "Long Mult.",     op: "mul", icon: "××" },
  { key: "long_div",       label: "Long Div.",      op: "div", icon: "÷÷" },
];
const DIFF = {
  easy:   { label: "Easy",   tables: [2, 3, 4, 5, 10], maxFactor: 10 },
  medium: { label: "Medium", tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], maxFactor: 12 },
  hard:   { label: "Hard",   tables: [3, 4, 6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], maxFactor: 18 },
};
const TOTAL = 20;
const HARD_DOTS = 3;
const TEST_HEARTS = 5;
const TEST_QUESTIONS = 20;

const PROGRESS_KEY = "tt_lesson_path_v2"; // bumped: schema now stores level state too
function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? JSON.parse(raw) : { completedLessons: {}, completedLevels: {} };
  } catch (_) {
    return { completedLessons: {}, completedLevels: {} };
  }
}
function saveProgress(p) {
  try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); } catch (_) {}
}

// Build a question from a lesson spec.
function questionFromSpec(spec) {
  // For "mixed", randomly pick mul or div per question.
  let op = spec.op === "mixed" ? (Math.random() < 0.5 ? "mul" : "div") : spec.op;
  const minFactor = spec.isLong ? 11 : 2;
  const maxFactor = spec.isLong ? Math.max(spec.maxFactor, 19) : spec.maxFactor;
  return generateQuestion(spec.tables, { minFactor, maxFactor, op });
}

function buildRunFromSpec(spec) {
  const out = [];
  for (let i = 0; i < TOTAL; i++) {
    out.push({ ...questionFromSpec(spec), isHard: spec.isLong || (spec.maxFactor >= 14) });
  }
  // Mark the last 3 as the "hard dots".
  const hardIdx = new Set();
  for (let i = TOTAL - 1; hardIdx.size < HARD_DOTS && i >= 0; i--) hardIdx.add(i);
  return out.map((q, i) => ({ ...q, isHard: q.isHard || hardIdx.has(i) }));
}

function buildCustomRun(selectedTopics, diffKey) {
  const cfg = DIFF[diffKey];
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
  const hardIdx = new Set();
  for (let i = TOTAL - 1; hardIdx.size < HARD_DOTS && i >= 0; i--) hardIdx.add(i);
  return out.map((q, i) => ({ ...q, isHard: q.isHard || hardIdx.has(i) }));
}

function buildEndlessRun() {
  // Random hardest spec: any topic + maxFactor 19 + long sometimes.
  const ops = [
    { op: "mul", isLong: false },
    { op: "div", isLong: false },
    { op: "mul", isLong: true },
    { op: "div", isLong: true },
  ];
  const out = [];
  for (let i = 0; i < TOTAL; i++) {
    const pick = ops[Math.floor(Math.random() * ops.length)];
    const minFactor = pick.isLong ? 11 : 2;
    const maxFactor = pick.isLong ? 25 : 19;
    out.push({ ...generateQuestion([6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], { minFactor, maxFactor, op: pick.op }), isHard: true });
  }
  return out;
}

function explain(q) {
  const factor = q.op === "mul" ? Math.max(q.a, q.b) : q.a;
  const tips = tableTips(factor);
  const explanation =
    tips.find((t) => t.kind === "trick") ||
    tips.find((t) => t.kind === "formula") ||
    tips[0];
  return explanation?.text || `${q.a} ${q.op === "mul" ? "×" : "÷"} ${q.b} = ${q.answer}.`;
}

// ─────────────────────────────────────────────────────────────────────────
export default function Lessons() {
  const path = useMemo(() => buildGiantPath(), []);
  const flatPath = useMemo(() => flattenPath(path), [path]);
  const [phase, setPhase] = useState("lobby"); // lobby | loading | play | test | result | testResult
  const [topics, setTopics] = useState(["multiplication"]);
  const [difficulty, setDifficulty] = useState("medium");
  const [activeLesson, setActiveLesson] = useState(null);
  const [activeLevel, setActiveLevel] = useState(null);
  const [loadingSpec, setLoadingSpec] = useState(null); // spec passed to LessonLoading for picking a tip
  const [pendingStart, setPendingStart] = useState(null); // () => void to run after the splash
  const [run, setRun] = useState([]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [correct, setCorrect] = useState(0);
  const [hardCorrect, setHardCorrect] = useState(0);
  const [hearts, setHearts] = useState(TEST_HEARTS);
  const [explanation, setExplanation] = useState(null);
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const [testTarget, setTestTarget] = useState(null); // level being tested out of
  const startedAt = useRef(0);

  const { refresh } = useAuth();
  const guard = useNavGuard(phase === "play" || phase === "test");
  const nav = useNavigate();

  const q = run[idx];

  // ── unlock logic ──────────────────────────────────────────────────────────
  // A lesson unlocks once the previous flat-path lesson is complete OR its
  // level has been "tested out" of.
  const isLessonUnlocked = (lessonId) => {
    const i = flatPath.findIndex((n) => n.id === lessonId);
    if (i <= 0) return true;
    const prev = flatPath[i - 1];
    if (progress.completedLessons[prev.id]) return true;
    if (progress.completedLevels[prev.levelIdx]) return true;
    return false;
  };
  const isLessonCompleted = (id) =>
    !!(progress.completedLessons[id] || progress.completedLevels[flatPath.find((l) => l.id === id)?.levelIdx]);
  const isLevelCompleted = (level) => {
    if (progress.completedLevels[level.idx]) return true;
    return level.lessons.every((l) => progress.completedLessons[l.id]);
  };
  const isLevelUnlocked = (level) => {
    if (level.idx === 0) return true;
    const prevLevel = path[level.idx - 1];
    if (!prevLevel) return false;
    return isLevelCompleted(prevLevel);
  };

  const pathDoneCount = flatPath.filter((l) => isLessonCompleted(l.id)).length;
  const allDone = pathDoneCount >= flatPath.length;

  // ── topic chips ───────────────────────────────────────────────────────────
  const toggleTopic = (key) => {
    const has = topics.includes(key);
    if (has) {
      const next = topics.filter((t) => t !== key);
      setTopics(next.length === 0 ? ["multiplication"] : next);
    } else {
      setTopics([...topics, key]);
    }
  };

  // ── start helpers ─────────────────────────────────────────────────────────
  // Each start runs through a loading-splash phase first (Brilliant-style
  // "Did you know?" tip + progress bar) and then transitions into the run.
  const enterLoading = (spec, runFn) => {
    setLoadingSpec(spec);
    setPendingStart(() => runFn);
    setPhase("loading");
  };
  const onLoadingDone = () => {
    if (pendingStart) {
      const fn = pendingStart;
      setPendingStart(null);
      fn();
    }
  };

  const startLessonFromPath = (lesson, level) => {
    if (!isLessonUnlocked(lesson.id)) return;
    enterLoading(lesson, () => {
      setActiveLesson(lesson);
      setActiveLevel(level);
      setRun(buildRunFromSpec(lesson));
      resetRunState();
      setPhase("play");
      startedAt.current = performance.now();
    });
  };
  const startCustomLesson = () => {
    const cfg = DIFF[difficulty];
    const spec = { tables: cfg.tables, maxFactor: cfg.maxFactor };
    enterLoading(spec, () => {
      setActiveLesson(null);
      setActiveLevel(null);
      setRun(buildCustomRun(topics, difficulty));
      resetRunState();
      setPhase("play");
      startedAt.current = performance.now();
    });
  };
  const startEndless = () => {
    enterLoading({ tables: [7, 8, 9, 11, 12, 13] }, () => {
      setActiveLesson({ id: "__endless__", label: "Endless", topic: "endless" });
      setActiveLevel(null);
      setRun(buildEndlessRun());
      resetRunState();
      setPhase("play");
      startedAt.current = performance.now();
    });
  };
  const startTestOut = (level) => {
    const specPool = level.lessons;
    const spec = specPool[0];
    enterLoading(spec, () => {
      setTestTarget(level);
      const out = [];
      for (let i = 0; i < TEST_QUESTIONS; i++) {
        const s = specPool[i % specPool.length];
        out.push(questionFromSpec(s));
      }
      setRun(out);
      setIdx(0);
      setValue("");
      setStatus("idle");
      setCorrect(0);
      setHardCorrect(0);
      setHearts(TEST_HEARTS);
      setExplanation(null);
      setPhase("test");
      startedAt.current = performance.now();
    });
  };

  function resetRunState() {
    setIdx(0);
    setValue("");
    setStatus("idle");
    setCorrect(0);
    setHardCorrect(0);
    setExplanation(null);
  }

  // ── submit / advance ──────────────────────────────────────────────────────
  // Path/custom lesson UI is multiple-choice (LessonQuestion). Test mode keeps
  // typed input via the original Question component. Both flow through here.
  const submitChoice = (n) => {
    if (status !== "idle") return;
    if (n === q.answer) onCorrect();
    else onWrong(true);
  };
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
    if (phase === "test") {
      // Test mode: lose a heart, advance immediately (no explanation card).
      setStatus("wrong");
      setHearts((h) => {
        const nh = h - 1;
        if (nh <= 0) {
          // Fail.
          setTimeout(() => finishTest(false), 700);
        } else {
          setTimeout(advance, 700);
        }
        return nh;
      });
    } else {
      setStatus("reviewing");
      setExplanation(explain(q));
    }
  };

  const advance = () => {
    setExplanation(null);
    if (phase === "test") {
      if (idx + 1 >= TEST_QUESTIONS) {
        finishTest(true);
        return;
      }
    } else if (idx + 1 >= TOTAL) {
      finishRun();
      return;
    }
    setIdx(idx + 1);
    setValue("");
    setStatus("idle");
  };

  const finishRun = async () => {
    const seconds = Math.round((performance.now() - startedAt.current) / 1000);
    setPhase("result");
    if (activeLesson && activeLesson.id !== "__endless__") {
      const next = {
        ...progress,
        completedLessons: {
          ...progress.completedLessons,
          [activeLesson.id]: { at: Date.now(), correct, total: TOTAL },
        },
      };
      setProgress(next);
      saveProgress(next);
    }
    try {
      const { data } = await api.post("/lessons/finish", {
        topics: activeLesson?.topic ? [activeLesson.topic] : topics,
        difficulty: activeLesson?.difficultyLabel?.toLowerCase().includes("hard") ? "hard"
                  : activeLesson?.difficultyLabel?.toLowerCase().includes("medium") ? "medium"
                  : difficulty,
        questions_total: TOTAL,
        correct,
        hard_correct: hardCorrect,
        seconds_taken: seconds,
      });
      setResult(data);
      if (data.xp_earned > 0) addCoinsAndXp(0, data.xp_earned);
      if (data.gems_earned > 0) {
        await refresh();
        toast.success(`Perfect lesson! +${data.gems_earned} gems`);
      }
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Could not save result");
    }
  };

  const finishTest = (passed) => {
    setPhase("testResult");
    if (passed && testTarget) {
      // Mark all lessons in the level complete + level complete.
      const nextCompletedLessons = { ...progress.completedLessons };
      testTarget.lessons.forEach((l) => {
        nextCompletedLessons[l.id] = { at: Date.now(), via: "test_out" };
      });
      const next = {
        ...progress,
        completedLessons: nextCompletedLessons,
        completedLevels: { ...progress.completedLevels, [testTarget.idx]: { at: Date.now() } },
      };
      setProgress(next);
      saveProgress(next);
      addCoinsAndXp(0, 60); // test-out reward
    }
    setResult({ passed, hearts });
  };

  // ── render: LOADING (Brilliant-style intermission) ────────────────────────
  if (phase === "loading") {
    return (
      <LessonLoading
        spec={loadingSpec}
        durationMs={1800}
        onDone={onLoadingDone}
        title={
          testTarget && pendingStart && testTarget.id === loadingSpec?.id
            ? "Loading test"
            : "Loading lesson"
        }
      />
    );
  }

  // ── render: PLAY ──────────────────────────────────────────────────────────
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
                    </span>.
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

        {status !== "reviewing" && q && (
          <LessonQuestion
            question={q}
            onAnswer={submitChoice}
            status={status}
          />
        )}

        <div className="text-center mt-3 text-xs text-muted font-mono" data-testid="lesson-progress-text">
          Q{idx + 1} / {TOTAL}
        </div>
      </div>
    );
  }

  // ── render: TEST (test-out) ───────────────────────────────────────────────
  if (phase === "test" && testTarget) {
    const pct = ((idx + (status === "idle" ? 0 : 1)) / TEST_QUESTIONS) * 100;
    return (
      <div className="max-w-3xl mx-auto" data-testid="lessons-page">
        <ConfirmLeaveModal
          open={guard.open}
          onCancel={guard.cancel}
          onConfirm={guard.confirm}
          title="Quit the test?"
          body={<>You'll keep any XP, but the level stays locked until you complete it.</>}
          confirmLabel="Yes, leave"
          cancelLabel="No, keep going"
        />
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Test out</div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-fg" data-testid="test-target-title">
            {testTarget.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => guard.tryGo("/")}
            data-testid="exit-game"
            className="brut-border-soft surface p-1.5 hover:bg-rose-500 hover:text-white text-fg"
            aria-label="Quit test"
          >
            <X size={14} />
          </button>
          <div className="flex-1 h-3 brut-border surface overflow-hidden">
            <motion.div className="h-full bg-blue-500" animate={{ width: `${pct}%` }} transition={{ duration: 0.3 }} />
          </div>
          <div className="flex items-center gap-1" data-testid="test-hearts">
            {Array.from({ length: TEST_HEARTS }).map((_, i) => (
              <Heart
                key={i}
                size={18}
                className={i < hearts ? "fill-rose-500 text-rose-700" : "text-zinc-300 dark:text-zinc-700"}
                strokeWidth={2.5}
              />
            ))}
          </div>
        </div>

        {q && (
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
        <div className="text-center mt-3 text-xs text-muted font-mono">
          Q{idx + 1} / {TEST_QUESTIONS} · {hearts} hearts
        </div>
      </div>
    );
  }

  // ── render: RESULT (regular lesson) ───────────────────────────────────────
  if (phase === "result") {
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
              Back to path
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

  // ── render: TEST RESULT ───────────────────────────────────────────────────
  if (phase === "testResult") {
    const passed = !!result?.passed;
    return (
      <div className="max-w-2xl mx-auto" data-testid="lessons-page">
        <div className="surface brut-border brut-shadow p-6 sm:p-8 text-center space-y-5" data-testid="test-end-screen">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: [0.7, 1.15, 1], opacity: 1 }}
            transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
            className={`inline-flex items-center gap-2 brut-border px-3 py-1.5 font-bold text-xs uppercase tracking-wider ${
              passed ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
            }`}
          >
            {passed ? <Trophy size={14} /> : <XCircle size={14} />} {passed ? "You tested out!" : "Test failed"}
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-fg">
            {passed ? `${testTarget?.title} cleared.` : "More than 4 wrong answers."}
          </h2>
          <p className="text-sm text-muted">
            {passed
              ? `All ${testTarget?.lessons.length} lessons in this level are now marked complete and the next level is unlocked.`
              : "Keep practising — try lessons in this level, or come back to the test later."}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 pt-2">
            <button
              onClick={() => setPhase("lobby")}
              className="flex-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs px-3 py-2.5 hover:bg-blue-600 hover:text-white"
              data-testid="test-end-back"
            >
              Back to path
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── render: LOBBY ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto" data-testid="lessons-page">
      <Link to="/" className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1" data-testid="lessons-back">
        <ArrowLeft size={12} /> Back
      </Link>
      <div className="mt-2 mb-6">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Mode</div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Lesson</h1>
        <p className="text-sm text-muted mt-1.5">
          {TOTAL_LESSONS_TARGET} lessons across {path.length} levels. Follow the path, test out of any level you already know, or build a custom lesson.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs text-muted font-mono" data-testid="path-progress">
          <span className="text-fg font-bold tabular-nums">{pathDoneCount}</span>
          <span>/</span>
          <span className="tabular-nums">{flatPath.length}</span>
          <div className="flex-1 h-1.5 brut-border-soft surface-2 max-w-xs overflow-hidden">
            <div
              className="h-full bg-emerald-500"
              style={{ width: `${(pathDoneCount / flatPath.length) * 100}%` }}
            />
          </div>
          <span className="tabular-nums">
            {Math.round((pathDoneCount / flatPath.length) * 100)}%
          </span>
        </div>
      </div>

      {/* Two-column layout: path on the left/main, custom lesson sidebar on the right (lg+). */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 lg:gap-10">
        <div data-testid="lesson-path">
          <LessonPath
            path={path}
            isLessonUnlocked={isLessonUnlocked}
            isLessonCompleted={isLessonCompleted}
            isLevelUnlocked={isLevelUnlocked}
            isLevelCompleted={isLevelCompleted}
            onStart={(lesson, level) => startLessonFromPath(lesson, level)}
            onTestOut={(level) => startTestOut(level)}
          />
          {/* Endless mode tile — locked until path is fully cleared */}
          <div className={`mt-8 brut-border ${allDone ? "brut-shadow surface" : "surface-2 opacity-70"} p-5 flex items-center gap-4`} data-testid="endless-tile">
            <div className={`w-14 h-14 brut-border grid place-items-center ${allDone ? "bg-amber-300 text-zinc-950" : "surface text-muted"}`}>
              {allDone ? <InfinityIcon size={26} /> : <Lock size={20} />}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
                {allDone ? "Unlocked" : "Locked"}
              </div>
              <div className="font-bold text-fg text-lg">Endless practice</div>
              <div className="text-xs text-muted">
                {allDone
                  ? "Auto-generated lessons across every topic and difficulty. No end."
                  : `Unlocks once you've cleared all ${flatPath.length} lessons.`}
              </div>
            </div>
            <button
              disabled={!allDone}
              onClick={startEndless}
              data-testid="endless-start"
              className={`brut-border brut-shadow font-bold uppercase tracking-wider text-xs px-4 py-2.5 ${
                allDone
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-blue-600 hover:text-white"
                  : "surface-2 text-muted cursor-not-allowed"
              }`}
            >
              {allDone ? "Start" : "Locked"}
            </button>
          </div>
        </div>

        {/* Custom lesson sidebar (sticky on desktop) */}
        <aside className="lg:sticky lg:top-24 self-start" data-testid="lessons-custom">
          <div className="brut-border surface p-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles size={14} className="text-amber-500" />
                <h2 className="font-bold text-fg text-sm uppercase tracking-wider">Custom lesson</h2>
              </div>
              <p className="text-xs text-muted">
                Pick the topics and difficulty you want — 20 questions, off-path.
              </p>
            </div>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-2">Topics</h3>
              <div className="grid grid-cols-2 gap-2">
                {TOPICS.map((t) => {
                  const on = topics.includes(t.key);
                  return (
                    <button
                      key={t.key}
                      onClick={() => toggleTopic(t.key)}
                      data-testid={`lessons-topic-${t.key.replace("_", "-")}`}
                      className={`brut-border p-2.5 text-left transition-colors ${
                        on
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                          : "surface-2 text-fg hover:surface"
                      }`}
                    >
                      <div className="font-mono font-black text-lg">{t.icon}</div>
                      <div className="text-[11px] font-bold mt-0.5">{t.label}</div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-2">Difficulty</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(DIFF).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setDifficulty(k)}
                    data-testid={`lessons-difficulty-${k}`}
                    className={`brut-border px-2 py-2 text-[11px] font-bold uppercase tracking-wider ${
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
              onClick={startCustomLesson}
              data-testid="lessons-start"
              className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs py-3 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all flex items-center justify-center gap-2"
            >
              Start custom lesson <ArrowRight size={14} />
            </button>

            <div className="pt-2 border-t border-zinc-300 dark:border-zinc-700">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium flex items-center gap-1">
                <GraduationCap size={11} /> Path progress
              </div>
              <div className="text-xs text-muted mt-1.5">
                <span className="text-fg font-bold tabular-nums">{pathDoneCount}</span>
                {" of "}
                <span className="tabular-nums">{flatPath.length}</span>
                {" lessons cleared"}
              </div>
            </div>
          </div>
        </aside>
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

// ─────────────────────────────────────────────────────────────────────────
// Centered zig-zag: lessons curve outward from the centre using a sine wave
// so the path feels organic and uses the full width.
// ─────────────────────────────────────────────────────────────────────────
function LessonPath({
  path,
  isLessonUnlocked,
  isLessonCompleted,
  isLevelUnlocked,
  isLevelCompleted,
  onStart,
  onTestOut,
}) {
  // Find next-up lesson across the entire path so we can pulse it.
  let nextLessonId = null;
  outer: for (const lv of path) {
    for (const l of lv.lessons) {
      if (!nextLessonId && isLessonUnlocked(l.id) && !isLessonCompleted(l.id)) {
        nextLessonId = l.id;
        break outer;
      }
    }
  }

  return (
    <div className="space-y-10">
      {path.map((unit) => {
        const unlocked = isLevelUnlocked(unit);
        const done = isLevelCompleted(unit);
        const completedInLevel = unit.lessons.filter((l) => isLessonCompleted(l.id)).length;
        return (
          <div key={unit.id} data-testid={`lesson-path-unit-${unit.id}`}>
            {/* Level header */}
            <div className={`brut-border ${unit.accentSoft} px-4 py-3 mb-6 flex items-center gap-3`}>
              <div className={`w-10 h-10 brut-border ${unit.accent} grid place-items-center text-zinc-950 shrink-0`}>
                {done ? <Trophy size={16} /> : !unlocked ? <Lock size={14} /> : <Star size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
                  {done ? "Cleared" : !unlocked ? "Locked" : "In progress"} · {completedInLevel}/{unit.lessons.length}
                </div>
                <div className="font-bold text-fg text-base truncate">{unit.title}</div>
                <div className="text-xs text-muted">{unit.subtitle}</div>
              </div>
              {!done && (
                <button
                  onClick={() => onTestOut(unit)}
                  data-testid={`lesson-path-test-${unit.id}`}
                  title="Test out of this level"
                  className="brut-border-soft surface-2 hover:bg-blue-600 hover:text-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-fg shrink-0"
                >
                  Test out
                </button>
              )}
            </div>

            {/* Centered zig-zag column of lesson nodes */}
            <div className="relative">
              {unit.lessons.map((lesson, i) => {
                const lessonUnlocked = isLessonUnlocked(lesson.id);
                const lessonDone = isLessonCompleted(lesson.id);
                const isNext = lesson.id === nextLessonId;
                // Sine-wave offset from centre — width per step ≈ 90px in
                // each direction. Period of 4 nodes feels natural.
                const offset = Math.sin((i / 3) * Math.PI) * 90;
                return (
                  <div
                    key={lesson.id}
                    className="flex flex-col items-center mb-7 transition-transform"
                    style={{ transform: `translateX(${offset}px)` }}
                  >
                    <button
                      onClick={() => onStart(lesson, unit)}
                      disabled={!lessonUnlocked}
                      data-testid={`lesson-path-node-${lesson.id}`}
                      aria-label={`${unit.title} · ${lesson.label}${lessonDone ? " (done)" : !lessonUnlocked ? " (locked)" : ""}`}
                      className={`relative w-16 h-16 sm:w-20 sm:h-20 brut-border brut-shadow grid place-items-center font-black text-2xl transition-all ${
                        lessonDone
                          ? `${unit.accent} text-zinc-950`
                          : lessonUnlocked
                          ? "bg-amber-300 text-zinc-950 hover:-translate-y-0.5"
                          : "surface-2 text-muted cursor-not-allowed"
                      } ${lesson.boss ? "rounded-md" : "rounded-full"}`}
                    >
                      {lessonDone ? (
                        <CheckCircle2 size={26} strokeWidth={3} />
                      ) : !lessonUnlocked ? (
                        <Lock size={20} />
                      ) : lesson.boss ? (
                        <Trophy size={24} />
                      ) : (
                        <Star size={24} strokeWidth={2.5} />
                      )}
                      {isNext && (
                        <motion.span
                          className={`absolute inset-0 ${lesson.boss ? "rounded-md" : "rounded-full"} ring-4 ring-amber-400`}
                          animate={{ scale: [1, 1.1, 1], opacity: [0.7, 0.2, 0.7] }}
                          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                          style={{ pointerEvents: "none" }}
                        />
                      )}
                    </button>
                    <div className="text-[10px] uppercase tracking-[0.2em] font-bold mt-2 text-muted text-center">
                      {lesson.label}
                      {lesson.boss && <span className="ml-1 text-amber-600 dark:text-amber-400">★</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
