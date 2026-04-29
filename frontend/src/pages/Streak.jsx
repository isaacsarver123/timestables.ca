import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Flame, X, SkipForward } from "lucide-react";
import Question from "@/components/Question";
import {
  getState,
  subscribe,
  recordAnswer,
  addCoinsAndXp,
  consumePowerup,
  recordRunResult,
} from "@/lib/storage";
import { generateQuestion } from "@/lib/game";

const Streak = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const [question, setQuestion] = useState(() => generateQuestion(getState().selectedTables));
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [combo, setCombo] = useState(0);
  const [running, setRunning] = useState(true);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [poppers, setPoppers] = useState([]);
  const startTs = useRef(performance.now());

  const next = () => {
    setQuestion((q) => generateQuestion(getState().selectedTables, { lastKey: q.key }));
    setValue("");
    setStatus("idle");
    startTs.current = performance.now();
  };

  const submit = () => {
    if (!running || status !== "idle") return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const correct = parseInt(value, 10) === question.answer;
    recordAnswer({ a: question.a, b: question.b, correct, ms });
    if (correct) {
      const newCombo = combo + 1;
      const earnedCoins = 1 + Math.floor(newCombo / 3);
      const earnedXp = 5 + Math.floor(newCombo / 2);
      addCoinsAndXp(earnedCoins, earnedXp);
      setCombo(newCombo);
      setCoinsEarned((c) => c + earnedCoins);
      setStatus("correct");
      const id = Math.random().toString(36).slice(2);
      setPoppers((p) => [...p, { id, n: earnedCoins }]);
      setTimeout(() => setPoppers((p) => p.filter((x) => x.id !== id)), 800);
      setTimeout(next, 220);
    } else {
      setStatus("wrong");
      setTimeout(() => {
        setRunning(false);
        recordRunResult({ mode: "streak", score: combo, streak: combo });
      }, 600);
    }
  };

  const useSkip = () => {
    if (status !== "idle") return;
    if (consumePowerup("skip")) next();
  };

  const restart = () => {
    setQuestion(generateQuestion(getState().selectedTables));
    setValue("");
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
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
            Mode 02
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Streak</h1>
        </div>
        <Link
          to="/"
          className="brut-border bg-white px-3 py-2 font-bold text-xs uppercase tracking-widest hover:bg-zinc-100"
          data-testid="exit-game"
        >
          <X size={14} className="inline -mt-0.5" /> Exit
        </Link>
      </div>

      <div className="bg-white brut-border brut-shadow p-5 mb-5 flex items-center justify-between gap-3">
        <motion.div
          animate={combo > 0 ? { scale: [1, 1.05, 1] } : { scale: 1 }}
          transition={{ duration: 0.5, repeat: combo > 0 ? Infinity : 0 }}
          className={`flex items-center gap-2 brut-border px-4 py-3 ${
            combo > 0 ? "bg-amber-300" : "bg-white"
          }`}
          data-testid="hud-combo"
        >
          <Flame size={18} />
          <span className="font-mono font-black text-3xl tabular-nums">x{combo}</span>
        </motion.div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-zinc-500 font-bold">
            Best
          </div>
          <div className="font-mono font-black text-2xl tabular-nums">
            x{Math.max(state.bestStreak, combo)}
          </div>
        </div>
        <div className="brut-border bg-white px-3 py-2 flex items-center gap-2">
          <Coins size={16} className="text-amber-600" />
          <span className="font-mono font-black text-xl">+{coinsEarned}</span>
        </div>
      </div>

      <div className="bg-white brut-border brut-shadow-lg p-8 sm:p-10 relative">
        <AnimatePresence>
          {poppers.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: -80, scale: 1.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.7 }}
              className="absolute right-8 top-8 font-mono font-black text-2xl text-amber-600 pointer-events-none"
            >
              +{p.n} <Coins size={20} className="inline -mt-1" />
            </motion.div>
          ))}
        </AnimatePresence>

        {running ? (
          <Question
            question={question}
            value={value}
            onChange={setValue}
            onSubmit={submit}
            status={status}
            disabled={!running}
          />
        ) : (
          <div className="text-center py-6" data-testid="streak-results">
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
              Streak Broken
            </div>
            <h2 className="text-5xl sm:text-6xl font-black tracking-tighter mt-2">x{combo}</h2>
            <p className="mt-3 text-zinc-600 font-medium">
              Final answer was {question.a} × {question.b} = {question.answer}.
            </p>
            <div className="grid grid-cols-2 gap-3 mt-8 max-w-md mx-auto">
              <div className="brut-border p-3 bg-amber-300">
                <div className="text-[10px] uppercase tracking-widest">Coins Earned</div>
                <div className="font-mono font-black text-3xl">+{coinsEarned}</div>
              </div>
              <div className="brut-border p-3 bg-zinc-950 text-white">
                <div className="text-[10px] uppercase tracking-widest opacity-70">Best Streak</div>
                <div className="font-mono font-black text-3xl">x{state.bestStreak}</div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={restart}
                className="bg-zinc-950 text-white brut-border brut-shadow font-bold px-6 py-3 hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
                data-testid="play-again"
              >
                Try Again
              </button>
              <button
                onClick={() => navigate("/")}
                className="bg-white brut-border brut-shadow font-bold px-6 py-3 hover:bg-zinc-100 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
                data-testid="back-home"
              >
                Home
              </button>
            </div>
          </div>
        )}
      </div>

      {running && (
        <div className="mt-5">
          <button
            data-testid="pu-skip"
            disabled={(state.powerups.skip || 0) <= 0}
            onClick={useSkip}
            className="brut-border brut-shadow-sm p-3 flex items-center gap-3 bg-blue-300 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all"
          >
            <SkipForward size={16} />
            <span className="font-bold text-sm">Skip Question</span>
            <span className="font-mono font-black ml-2">{state.powerups.skip || 0}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Streak;
