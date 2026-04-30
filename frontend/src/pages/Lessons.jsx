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
import CompletionCelebration from "@/components/CompletionCelebration";
import ConfirmLeaveModal from "@/components/ConfirmLeaveModal";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useNavGuard } from "@/lib/leaveGuard";
import { generateQuestion, tableTips } from "@/lib/game";
import { addCoinsAndXp, recordAnswer, markCompletedActivityToday } from "@/lib/storage";
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
const BASE_QUESTIONS = 17;       // questions before the challenge round
const HARD_DOTS = 3;             // == TOTAL - BASE_QUESTIONS
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
function questionFromSpec(spec, lastKey) {
  // For "mixed", randomly pick mul or div per question.
  let op = spec.op === "mixed" ? (Math.random() < 0.5 ? "mul" : "div") : spec.op;
  const minFactor = spec.minFactor ?? (spec.isLong ? 11 : 2);
  const maxFactor = spec.isLong ? Math.max(spec.maxFactor, 19) : spec.maxFactor;
  return generateQuestion(spec.tables, { minFactor, maxFactor, op, lastKey });
}

function buildRunFromSpec(spec) {
  const out = [];
  let lastKey = null;
  for (let i = 0; i < TOTAL; i++) {
    const nextQ = questionFromSpec(spec, lastKey);
    out.push({ ...nextQ, isHard: spec.isLong || (spec.maxFactor >= 14) });
    lastKey = nextQ.key;
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
  let lastKey = null;
  for (let i = 0; i < TOTAL; i++) {
    const pick = ops[i % ops.length];
    const minFactor = pick.isLong ? 11 : 2;
    const maxFactor = pick.isLong ? Math.max(cfg.maxFactor, 19) : cfg.maxFactor;
    const q = generateQuestion(cfg.tables, { minFactor, maxFactor, op: pick.op, lastKey });
    out.push({ ...q, isHard: pick.isLong });
    lastKey = q.key;
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
  let lastKey = null;
  for (let i = 0; i < TOTAL; i++) {
    const pick = ops[Math.floor(Math.random() * ops.length)];
    const minFactor = pick.isLong ? 11 : 2;
    const maxFactor = pick.isLong ? 25 : 19;
    const q = generateQuestion([6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], { minFactor, maxFactor, op: pick.op, lastKey });
    out.push({ ...q, isHard: true });
    lastKey = q.key;
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
  // Per-challenge-question result: true = correct, false = wrong, undefined = unanswered
  const [hardResults, setHardResults] = useState([]);
  const [hearts, setHearts] = useState(TEST_HEARTS);
  const [explanation, setExplanation] = useState(null);
  const [result, setResult] = useState(null);
  const [streakInfo, setStreakInfo] = useState(null);
  const [progress, setProgress] = useState(loadProgress);
  const [testTarget, setTestTarget] = useState(null); // legacy field used by render branches
  const [jumpAim, setJumpAim] = useState(null); // { aimLesson, level? } during a jump-here test
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

  // Auto-scroll to the current (next-up) lesson when the lobby loads so the
  // user never starts on "the top of the page" at Level 1 after they've
  // already progressed past it.
  useEffect(() => {
    if (phase !== "lobby") return;
    // Find first unlocked+uncompleted lesson in the flat path.
    const next = flatPath.find((l) => isLessonUnlocked(l.id) && !isLessonCompleted(l.id));
    if (!next) return;
    // Wait a tick for the path to render.
    const t = setTimeout(() => {
      const el = document.querySelector(`[data-testid="lesson-path-node-${next.id}"]`);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pathDoneCount]);

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
  // "Jump here" lets the user prove they already know a lesson (or a level's
  // worth of lessons) by passing a 20-question / 5-heart test calibrated to
  // that specific lesson's difficulty. Pass marks that lesson AND every
  // earlier path lesson as complete; fail leaves progress untouched.
  // `target` can be either a single lesson spec OR a level object (we use
  // its hardest lesson — the unit boss — to calibrate the test in that case).
  const startJumpHere = (target) => {
    // Normalise: figure out the lesson we're aiming for.
    const isLevel = !!target.lessons;
    const aimLesson = isLevel
      ? target.lessons[target.lessons.length - 1] // unit boss
      : target;
    if (!aimLesson) return;
    enterLoading(aimLesson, () => {
      setJumpAim({ aimLesson, level: isLevel ? target : null });
      // Build the test from the level's lesson pool when jumping a whole
      // level, otherwise from the single lesson spec sampled 20 times.
      const specPool = isLevel ? target.lessons : [aimLesson];
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
      setHardResults([]);
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
    setHardResults([]);
    setExplanation(null);
  }

  // ── submit / advance ──────────────────────────────────────────────────────
  // Path/custom lesson UI is multiple-choice (LessonQuestion). It fires
  // onAnswer(true|false, chosen) only AFTER the user clicks Check.
  // Correct: brief green flash inside LessonQuestion, then we advance.
  // Wrong: we immediately show the explanation card, user reads it and
  // clicks "Got it — continue" to advance.
  const submitChoice = (isCorrect, _chosen) => {
    // LessonQuestion already played sfx at check-time. Skip sfx here.
    if (isCorrect) onCorrect(false);
    else onWrong(false);
  };
  const submit = () => {
    if (status !== "idle") return;
    if (value === "" || value === "-") return;
    const guess = parseInt(value, 10);
    if (guess === q.answer) onCorrect(true);
    else onWrong(true);
  };

  const onCorrect = (playSfx = true) => {
    if (playSfx) { sfx.correct(); sfx.coin(); }
    setCorrect((c) => c + 1);
    if (q.isHard) setHardCorrect((c) => c + 1);
    if (phase !== "test" && idx >= BASE_QUESTIONS) {
      setHardResults((arr) => [...arr, true]);
    }
    addCoinsAndXp(1, 3);
    recordAnswer({ a: q.a, b: q.b, op: q.op, correct: true, ms: 0 });
    advance();
  };

  const onWrong = (playSfx = true) => {
    if (playSfx) sfx.wrong();
    recordAnswer({ a: q.a, b: q.b, op: q.op, correct: false, ms: 0 });
    if (phase === "test") {
      setStatus("wrong");
      setHearts((h) => {
        const nh = h - 1;
        if (nh <= 0) {
          setTimeout(() => finishTest(false), 700);
        } else {
          setTimeout(advance, 700);
        }
        return nh;
      });
    } else {
      if (idx >= BASE_QUESTIONS) setHardResults((arr) => [...arr, false]);
      setExplanation(explain(q));
      setStatus("reviewing");
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
    // Universal streak credit — only counts the first completion of the day.
    setStreakInfo(markCompletedActivityToday());
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
    // Credit the streak (idempotent for today) regardless of pass/fail —
    // the user did finish a 20-question activity start-to-finish.
    setStreakInfo(markCompletedActivityToday());
    if (passed && jumpAim?.aimLesson) {
      // Mark every flat-path lesson up to AND INCLUDING the aimLesson as
      // complete, so the user truly "jumps" here. Also mark every level
      // entirely covered by those lessons as complete.
      const aimIdx = flatPath.findIndex((l) => l.id === jumpAim.aimLesson.id);
      const nextCompletedLessons = { ...progress.completedLessons };
      const nextCompletedLevels = { ...progress.completedLevels };
      for (let i = 0; i <= aimIdx && i < flatPath.length; i++) {
        const l = flatPath[i];
        if (!nextCompletedLessons[l.id]) {
          nextCompletedLessons[l.id] = { at: Date.now(), via: "jump_here" };
        }
      }
      // Mark levels complete when every one of their lessons is now done.
      path.forEach((lvl) => {
        if (lvl.lessons.every((l) => nextCompletedLessons[l.id])) {
          if (!nextCompletedLevels[lvl.idx]) {
            nextCompletedLevels[lvl.idx] = { at: Date.now(), via: "jump_here" };
          }
        }
      });
      const next = {
        ...progress,
        completedLessons: nextCompletedLessons,
        completedLevels: nextCompletedLevels,
      };
      setProgress(next);
      saveProgress(next);
      addCoinsAndXp(0, jumpAim.level ? 80 : 30); // bigger reward for jumping a whole level
    }
    setResult({ passed, hearts, jumpAim });
    // Stash the aim's level (if any) for the result-screen UI; clear jumpAim.
    setTestTarget(jumpAim?.level || null);
    setJumpAim(null);
  };

  // ── render: LOADING (Brilliant-style intermission) ────────────────────────
  if (phase === "loading") {
    return (
      <LessonLoading
        durationMs={4500}
        onDone={onLoadingDone}
        title={
          jumpAim
            ? jumpAim.level
              ? "Loading jump test"
              : "Loading lesson test"
            : "Loading lesson"
        }
      />
    );
  }

  // ── render: PLAY ──────────────────────────────────────────────────────────
  if (phase === "play") {
    // Bar represents the first BASE_QUESTIONS (17). The remaining 3 are the
    // challenge round and use the dot rectangles instead.
    const isChallenge = idx >= BASE_QUESTIONS;
    const challengeNum = isChallenge ? idx - BASE_QUESTIONS + 1 : 0;
    const baseDone = Math.min(idx, BASE_QUESTIONS) + (status !== "idle" && idx < BASE_QUESTIONS ? 1 : 0);
    const pct = (baseDone / BASE_QUESTIONS) * 100;
    return (
      // Fit the entire play UI inside the viewport (no scroll). The container
      // collapses the top/bottom padding the Layout adds so we get more height,
      // and uses dvh so iOS bottom-bar collapse doesn't push content offscreen.
      <div className="max-w-3xl mx-auto flex flex-col -my-4 sm:-my-6 h-[calc(100dvh-160px)] sm:h-[calc(100dvh-180px)]" data-testid="lessons-page">
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
        <div className="flex items-center gap-3 mb-3 shrink-0 pt-3 sm:pt-4">
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
          {/* Challenge dots — little rectangles matching the bar style.
              Green when answered correctly, red when answered wrong, blank
              until the question comes up. */}
          <div className="flex items-center gap-1" data-testid="lesson-hard-dots">
            {Array.from({ length: HARD_DOTS }).map((_, i) => {
              const r = hardResults[i];
              const cls = r === true
                ? "bg-emerald-500"
                : r === false
                ? "bg-rose-500"
                : "surface-2";
              return (
                <div
                  key={i}
                  data-testid={`lesson-hard-dot-${i}`}
                  className={`w-3 h-3 brut-border ${cls}`}
                />
              );
            })}
          </div>
        </div>

        {/* Challenge banner — replaces the standard "Q N / 20" text once the
            base questions are done. */}
        {isChallenge && (
          <div className="text-center text-[11px] uppercase tracking-[0.25em] text-amber-500 font-bold mb-2 shrink-0" data-testid="challenge-banner">
            Challenge question {challengeNum} / {HARD_DOTS}
          </div>
        )}

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
          <div className="flex-1 min-h-0 flex flex-col">
            <LessonQuestion
              key={`${idx}-${q?.key ?? `${q?.op}-${q?.a}-${q?.b}-${q?.answer}`}`}
              question={q}
              onAnswer={submitChoice}
              status={status}
            />
          </div>
        )}

        <div className="text-center mt-2 text-[11px] text-muted font-mono shrink-0 pb-2" data-testid="lesson-progress-text">
          {isChallenge ? `Q${idx + 1} / ${TOTAL}` : `Q${idx + 1} / ${BASE_QUESTIONS}`}
        </div>
      </div>
    );
  }

  // ── render: TEST (jump-here) ──────────────────────────────────────────────
  if (phase === "test" && jumpAim) {
    const pct = ((idx + (status === "idle" ? 0 : 1)) / TEST_QUESTIONS) * 100;
    const aimingForLevel = !!jumpAim.level;
    return (
      <div className="max-w-3xl mx-auto flex flex-col -my-4 sm:-my-6 h-[calc(100dvh-160px)] sm:h-[calc(100dvh-180px)]" data-testid="lessons-page">
        <ConfirmLeaveModal
          open={guard.open}
          onCancel={guard.cancel}
          onConfirm={guard.confirm}
          title="Quit the test?"
          body={<>You'll keep any XP, but you won't jump ahead until you pass.</>}
          confirmLabel="Yes, leave"
          cancelLabel="No, keep going"
        />
        <div className="mb-2 shrink-0 pt-3 sm:pt-4">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            {aimingForLevel ? "Jump here · level test" : "Jump here · lesson test"}
          </div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight text-fg" data-testid="test-target-title">
            {aimingForLevel ? jumpAim.level.title : jumpAim.aimLesson.label}
          </h2>
          <div className="text-xs text-muted mt-0.5">
            Pass with at least 16 / 20 correct (5 hearts) to unlock everything up to here.
          </div>
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
          <div className="flex-1 min-h-0 overflow-auto">
            <Question
              question={q}
              value={value}
              onChange={setValue}
              onSubmit={submit}
              status={status}
              disabled={status !== "idle"}
              correctAnswer={q.answer}
            />
          </div>
        )}
        <div className="text-center mt-2 text-[11px] text-muted font-mono shrink-0 pb-2">
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

          <div className="max-w-md mx-auto text-left">
            <CompletionCelebration
              xp={result?.xp_earned ?? 0}
              gems={result?.gems_earned ?? 0}
              streakInfo={streakInfo}
            />
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
            {passed ? <Trophy size={14} /> : <XCircle size={14} />} {passed ? "You jumped ahead!" : "Test failed"}
          </motion.div>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-fg">
            {passed
              ? testTarget?.title
                ? `${testTarget.title} cleared.`
                : "Lesson cleared."
              : "More than 4 wrong answers."}
          </h2>
          <p className="text-sm text-muted">
            {passed
              ? "Every lesson up to and including this one is now marked complete."
              : "Keep practising — try lessons leading up to this point, or come back later."}
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
            onJumpHere={(target) => startJumpHere(target)}
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
// LOCKED nodes: click → Radix Popover (portaled, collision-detected, no flicker).
// UNLOCKED / DONE nodes: click → start/practice immediately. No popover.
// ─────────────────────────────────────────────────────────────────────────
function LessonPath({
  path,
  isLessonUnlocked,
  isLessonCompleted,
  isLevelUnlocked,
  isLevelCompleted,
  onStart,
  onJumpHere,
}) {
  const getNodeOffset = (i) => Math.sin((i / 3) * Math.PI) * 90;
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
            {/* Level header — includes the per-level "Jump here" button. */}
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
                  onClick={() => onJumpHere(unit)}
                  data-testid={`lesson-path-jump-level-${unit.id}`}
                  title="Take a 20-question test calibrated to this level. Pass to skip everything before it."
                  className="brut-border surface text-fg hover:bg-amber-300 hover:text-zinc-950 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider shrink-0 flex items-center gap-1.5"
                >
                  <ArrowRight size={11} /> Jump here
                </button>
              )}
            </div>

            {/* Centered zig-zag column of lesson nodes */}
            <div className="relative">
              {unit.lessons.map((lesson, i) => {
                const lessonUnlocked = isLessonUnlocked(lesson.id);
                const lessonDone = isLessonCompleted(lesson.id);
                const isNext = lesson.id === nextLessonId;
                const offset = getNodeOffset(i);
                return (
                  <div
                    key={lesson.id}
                    className="flex flex-col items-center mb-7 transition-transform"
                    style={{ transform: `translateX(${offset}px)` }}
                  >
                    <LessonNode
                      lesson={lesson}
                      unit={unit}
                      done={lessonDone}
                      unlocked={lessonUnlocked}
                      isNext={isNext}
                      index={i}
                      totalLessons={unit.lessons.length}
                      offset={offset}
                      getNodeOffset={getNodeOffset}
                      onStart={() => onStart(lesson, unit)}
                      onJump={() => onJumpHere(lesson)}
                    />
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

// ─────────────────────────────────────────────────────────────────────────
// LessonNode
// - DONE / NEXT-UP UNLOCKED: button click goes straight to start/practice.
// - LOCKED (further ahead): button is the Radix Popover trigger. Click to
//   open a portaled popover with the "Jump here" CTA. Radix handles
//   click-outside-to-close, collision-detected sides, focus trap, and the
//   portal escapes the parent's bounding box → no overlap with neighbours.
// ─────────────────────────────────────────────────────────────────────────
function LessonNode({ lesson, unit, done, unlocked, isNext, index, totalLessons, offset, getNodeOffset, onStart, onJump }) {
  const [open, setOpen] = useState(false);

  // Shadow lives only on COMPLETED lessons — it reads as a "credited" mark.
  // Next-up and locked nodes stay flat so the user's eye doesn't get pulled
  // everywhere.
  const shadowClass = done ? "brut-shadow-sm" : "";
  const buttonClass = `relative w-16 h-16 sm:w-20 sm:h-20 brut-border ${shadowClass} grid place-items-center font-black text-2xl transition-all ${
    done
      ? `${unit.accent} text-zinc-950 hover:-translate-y-0.5`
      : unlocked
      ? "bg-amber-300 text-zinc-950 hover:-translate-y-0.5"
      : "surface-2 text-muted hover:-translate-y-0.5"
  } ${lesson.boss ? "rounded-md" : "rounded-full"}`;

  const innerIcon = done ? (
    <CheckCircle2 size={26} strokeWidth={3} />
  ) : !unlocked ? (
    <Lock size={20} />
  ) : lesson.boss ? (
    <Trophy size={24} />
  ) : (
    <Star size={24} strokeWidth={2.5} />
  );

  // Pulsing "next-up" ring — sits just outside the button so the amber halo
  // is visible without spilling onto the text label below.
  const pulse = isNext && (
    <motion.span
      className={`absolute -inset-1 ${lesson.boss ? "rounded-md" : "rounded-full"} ring-[3px] ring-amber-400`}
      animate={{ scale: [1, 1.08, 1], opacity: [0.8, 0.25, 0.8] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
      style={{ pointerEvents: "none" }}
    />
  );

  const prevOffset = index > 0 ? getNodeOffset(index - 1) : 0;
  const nextOffset = index < totalLessons - 1 ? getNodeOffset(index + 1) : 0;
  const neighbourOffset = Math.abs(nextOffset) > Math.abs(prevOffset) ? nextOffset : prevOffset;
  const sideHint = (neighbourOffset - offset) > 0 ? "left" : "right";

  // Direct-action button for done / next-up unlocked nodes — no popover.
  if (done || unlocked) {
    return (
      <div className="relative">
        {pulse}
        <button
          onClick={onStart}
          data-testid={`lesson-path-node-${lesson.id}`}
          aria-label={`${unit.title} · ${lesson.label}${done ? " (done)" : ""}`}
          className={buttonClass}
        >
          {innerIcon}
        </button>
      </div>
    );
  }

  // Locked node — popover with "Jump here" CTA.
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        {pulse}
        <PopoverTrigger asChild>
          <button
            data-testid={`lesson-path-node-${lesson.id}`}
            aria-label={`${unit.title} · ${lesson.label} (locked)`}
            className={buttonClass}
          >
            {innerIcon}
          </button>
        </PopoverTrigger>
      </div>
      <PopoverContent
        align="center"
        side={sideHint}
        sideOffset={10}
        collisionPadding={16}
        className="w-60 surface brut-border brut-shadow rounded-md p-3 text-left"
        data-testid={`lesson-path-popover-${lesson.id}`}
      >
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold">
          {unit.title}
        </div>
        <div className="font-bold text-fg text-sm mb-1">
          {lesson.label}
          {lesson.boss && <span className="ml-1 text-amber-500">★</span>}
        </div>
        <div className="text-[11px] text-muted mb-3 leading-relaxed">
          Locked. Pass a calibrated test (20 Q · 5 hearts) to jump here and mark every previous lesson complete.
        </div>
        <button
          onClick={() => { setOpen(false); onJump(); }}
          data-testid={`lesson-path-jump-${lesson.id}`}
          className="w-full brut-border brut-shadow-sm bg-amber-300 text-zinc-950 font-bold uppercase tracking-wider text-[10px] py-2 px-2 hover:-translate-y-0.5"
        >
          Jump here
        </button>
      </PopoverContent>
    </Popover>
  );
}
