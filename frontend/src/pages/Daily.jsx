import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, CalendarCheck, X, Flame } from "lucide-react";
import Question from "@/components/Question";
import ConfirmLeaveModal from "@/components/ConfirmLeaveModal";
import { useNavGuard } from "@/lib/leaveGuard";
import {
  getState,
  subscribe,
  recordAnswer,
  addCoinsAndXp,
  setDailyResult,
} from "@/lib/storage";
import { dailyQuestions } from "@/lib/game";
import { sfx } from "@/lib/sound";

const TODAY = () => new Date().toISOString().slice(0, 10);
const PRETTY_DATE = () =>
  new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

const TOTAL = 30;

const Daily = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const today = TODAY();
  const completedToday = state.daily?.completed && state.daily?.date === today;

  const [questions] = useState(() => dailyQuestions(TOTAL, "mixed"));
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [score, setScore] = useState(0);
  const [running, setRunning] = useState(!completedToday);
  const startTs = useRef(performance.now());

  const q = questions[idx];

  const submit = () => {
    if (!running || status !== "idle" || !q) return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const correct = parseInt(value, 10) === q.answer;
    recordAnswer({ a: q.a, b: q.b, op: q.op, correct, ms });
    if (correct) {
      addCoinsAndXp(2, 6);
      sfx.correct();
      sfx.coin();
      setScore((s) => s + 1);
      setStatus("correct");
    } else {
      sfx.wrong();
      setStatus("wrong");
    }
    setTimeout(() => {
      const nextIdx = idx + 1;
      if (nextIdx >= TOTAL) {
        const finalScore = score + (correct ? 1 : 0);
        setRunning(false);
        setDailyResult({ date: today, score: finalScore, total: TOTAL });
      } else {
        setIdx(nextIdx);
        setValue("");
        setStatus("idle");
        startTs.current = performance.now();
      }
    }, correct ? 350 : 1900);
  };

  const pct = ((idx + (running ? 0 : 1)) / TOTAL) * 100;
  const guard = useNavGuard(running);

  return (
    <div className="max-w-3xl mx-auto" data-testid="daily-page">
      <ConfirmLeaveModal open={guard.open} onCancel={guard.cancel} onConfirm={guard.confirm} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
            data-testid="back-link"
          >
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2 flex items-center gap-2">
            <CalendarCheck size={24} className="text-emerald-600" />
            Daily Challenge
          </h1>
          <p className="text-sm text-muted mt-1">{PRETTY_DATE()}</p>
          {state.dailyStreak?.count > 0 && (
            <div
              className="mt-2 inline-flex items-center gap-1.5 brut-border bg-amber-300 text-zinc-950 px-2.5 py-1"
              data-testid="daily-streak"
            >
              <Flame size={14} />
              <span className="font-mono text-sm font-bold">
                {state.dailyStreak.count}-day streak
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => guard.tryGo("/")}
          className="brut-border-soft surface px-3 py-1.5 font-semibold text-xs uppercase tracking-widest hover:surface-2 text-fg"
          data-testid="exit-game"
        >
          <X size={13} className="inline -mt-0.5" /> Exit
        </button>
      </div>

      {completedToday ? (
        <div className="surface brut-border brut-shadow p-7 sm:p-9 text-center" data-testid="daily-completed">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            Completed
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mt-1 text-fg">
            {state.daily.score}<span className="text-muted">/{state.daily.total}</span>
          </h2>
          <p className="mt-2 text-muted text-sm">
            You've done today's challenge. New questions tomorrow.
          </p>
          <div className="mt-6 flex justify-center gap-2.5">
            <button
              onClick={() => navigate("/play/quickfire")}
              className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
              data-testid="goto-quickfire"
            >
              Play Quick-Fire
            </button>
            <button
              onClick={() => navigate("/")}
              className="surface brut-border brut-shadow font-bold px-5 py-2.5 hover:surface-2 active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm text-fg"
              data-testid="back-home"
            >
              Home
            </button>
          </div>
        </div>
      ) : running ? (
        <>
          <div className="surface brut-border p-4 mb-4">
            <div className="flex items-center justify-between mb-3 text-sm font-mono">
              <span className="text-fg font-bold" data-testid="hud-progress">
                {idx + 1} / {TOTAL}
              </span>
              <span className="text-muted">Score: <span className="text-fg font-bold">{score}</span></span>
            </div>
            <div className="h-2.5 surface-2 brut-border-soft overflow-hidden">
              <motion.div
                className="h-full bg-emerald-500"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
          <div className="surface brut-border brut-shadow p-7 sm:p-9">
            <Question
              question={q}
              value={value}
              onChange={setValue}
              onSubmit={submit}
              status={status}
              disabled={status !== "idle"}
              correctAnswer={q?.answer}
            />
          </div>
        </>
      ) : (
        <div className="surface brut-border brut-shadow p-7 sm:p-9 text-center" data-testid="daily-results">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Done</div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mt-1 text-fg">
            {score}<span className="text-muted">/{TOTAL}</span>
          </h2>
          <p className="mt-2 text-muted text-sm">Saved. Come back tomorrow for new questions.</p>
          <div className="mt-6 flex justify-center gap-2.5">
            <button
              onClick={() => navigate("/")}
              className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
              data-testid="back-home"
            >
              Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Daily;
