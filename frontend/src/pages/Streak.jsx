import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Flame, X, SkipForward } from "lucide-react";
import Question from "@/components/Question";
import ChoiceGrid from "@/components/ChoiceGrid";
import {
  getState,
  subscribe,
  recordAnswer,
  addCoinsAndXp,
  consumePowerup,
  recordRunResult,
} from "@/lib/storage";
import { generateQuestion } from "@/lib/game";
import { sfx } from "@/lib/sound";

const Streak = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const [question, setQuestion] = useState(() =>
    generateQuestion(getState().selectedTables, { op: getState().opMode })
  );
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [combo, setCombo] = useState(0);
  const [running, setRunning] = useState(true);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [poppers, setPoppers] = useState([]);
  const [lastChoice, setLastChoice] = useState(null);
  const startTs = useRef(performance.now());

  const next = () => {
    setQuestion((q) =>
      generateQuestion(getState().selectedTables, {
        lastKey: q.key,
        op: getState().opMode,
      })
    );
    setValue("");
    setLastChoice(null);
    setStatus("idle");
    startTs.current = performance.now();
  };

  const evaluate = (guess) => {
    if (!running || status !== "idle") return;
    const ms = Math.round(performance.now() - startTs.current);
    const correct = guess === question.answer;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct, ms });
    if (correct) {
      const newCombo = combo + 1;
      const earnedCoins = 1 + Math.floor(newCombo / 3);
      const earnedXp = 5 + Math.floor(newCombo / 2);
      addCoinsAndXp(earnedCoins, earnedXp);
      setCombo(newCombo);
      setCoinsEarned((c) => c + earnedCoins);
      setStatus("correct");
      sfx.correct();
      sfx.coin();
      const id = Math.random().toString(36).slice(2);
      setPoppers((p) => [...p, { id, n: earnedCoins }]);
      setTimeout(() => setPoppers((p) => p.filter((x) => x.id !== id)), 800);
      setTimeout(next, 220);
    } else {
      setStatus("wrong");
      sfx.wrong();
      if (getState().inputMode === "choices") setLastChoice(guess);
      setTimeout(() => {
        setRunning(false);
        recordRunResult({ mode: "streak", score: combo, streak: combo });
      }, 700);
    }
  };

  const submit = () => {
    if (value === "" || value === "-") return;
    evaluate(parseInt(value, 10));
  };

  const useSkip = () => {
    if (status !== "idle") return;
    if (consumePowerup("skip")) next();
  };

  const restart = () => {
    setQuestion(generateQuestion(getState().selectedTables, { op: getState().opMode }));
    setValue("");
    setLastChoice(null);
    setStatus("idle");
    setCombo(0);
    setCoinsEarned(0);
    setRunning(true);
    startTs.current = performance.now();
  };

  return (
    <div className="max-w-3xl mx-auto" data-testid="streak-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Mode</div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Streak</h1>
        </div>
        <Link
          to="/"
          className="brut-border-soft surface px-3 py-1.5 font-semibold text-xs uppercase tracking-widest hover:surface-2 text-fg"
          data-testid="exit-game"
        >
          <X size={13} className="inline -mt-0.5" /> Exit
        </Link>
      </div>

      <div className="surface brut-border p-4 mb-4 flex items-center justify-between gap-3">
        <motion.div
          animate={combo > 0 ? { scale: [1, 1.04, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, repeat: combo > 0 ? Infinity : 0 }}
          className={`flex items-center gap-2 brut-border px-3 py-2 ${combo > 0 ? "bg-amber-300 text-zinc-950" : "surface text-fg"}`}
          data-testid="hud-combo"
        >
          <Flame size={16} />
          <span className="font-mono font-bold text-2xl tabular-nums">x{combo}</span>
        </motion.div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-muted font-medium">Best</div>
          <div className="font-mono font-bold text-xl tabular-nums text-fg">x{Math.max(state.bestStreak, combo)}</div>
        </div>
        <div className="brut-border surface px-2.5 py-2 flex items-center gap-1.5">
          <Coins size={14} className="text-amber-500" />
          <span className="font-mono font-bold text-base text-fg">+{coinsEarned}</span>
        </div>
      </div>

      <div className="surface brut-border brut-shadow p-7 sm:p-9 relative">
        <AnimatePresence>
          {poppers.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -80, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute right-6 top-6 font-mono font-bold text-xl text-amber-600 pointer-events-none"
            >
              +{p.n} <Coins size={18} className="inline -mt-1" />
            </motion.div>
          ))}
        </AnimatePresence>

        {running ? (
          state.inputMode === "choices" ? (
            <ChoiceGrid
              question={question}
              onAnswer={evaluate}
              status={status}
              disabled={!running}
              lastChoice={lastChoice}
            />
          ) : (
            <Question
              question={question}
              value={value}
              onChange={setValue}
              onSubmit={submit}
              status={status}
              disabled={!running}
            />
          )
        ) : (
          <div className="text-center py-4" data-testid="streak-results">
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
              Streak Broken
            </div>
            <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mt-1 text-fg">x{combo}</h2>
            <p className="mt-2 text-muted text-sm">
              Last question: {question.prompt} = {question.answer}.
            </p>
            <div className="grid grid-cols-2 gap-2.5 mt-6 max-w-md mx-auto">
              <div className="brut-border p-2.5 bg-amber-300 text-zinc-950">
                <div className="text-[10px] uppercase tracking-widest">Coins Earned</div>
                <div className="font-mono font-bold text-2xl">+{coinsEarned}</div>
              </div>
              <div className="brut-border p-2.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <div className="text-[10px] uppercase tracking-widest opacity-70">Best Streak</div>
                <div className="font-mono font-bold text-2xl">x{state.bestStreak}</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button
                onClick={restart}
                className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
                data-testid="play-again"
              >
                Try Again
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
        )}
      </div>

      {running && (
        <div className="mt-4">
          <button
            data-testid="pu-skip"
            disabled={(state.powerups.skip || 0) <= 0}
            onClick={useSkip}
            className="brut-border brut-shadow-sm p-2.5 flex items-center gap-2.5 bg-blue-300 text-zinc-950 disabled:surface-2 disabled:text-muted disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0.5 active:brut-shadow-none transition-all"
          >
            <SkipForward size={14} />
            <span className="font-bold text-xs">Skip Question</span>
            <span className="font-mono font-bold ml-2">{state.powerups.skip || 0}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Streak;
