import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Clock, Flame, X, Plus, SkipForward, Snowflake, Sparkles } from "lucide-react";
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

const ROUND_SECONDS = 60;

const QuickFire = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const [question, setQuestion] = useState(() =>
    generateQuestion(getState().selectedTables)
  );
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [time, setTime] = useState(ROUND_SECONDS);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [running, setRunning] = useState(true);
  const [doubler, setDoubler] = useState(false);
  const [frozen, setFrozen] = useState(false);
  const [poppers, setPoppers] = useState([]);
  const startTs = useRef(performance.now());

  const finish = useCallback(() => {
    setRunning(false);
    recordRunResult({ mode: "quickfire", score, streak: combo });
  }, [score, combo]);

  // timer
  useEffect(() => {
    if (!running || frozen) return;
    if (time <= 0) {
      finish();
      return;
    }
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [running, frozen, time, finish]);

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
      const baseCoins = 1 + Math.floor(combo / 5);
      const earnedCoins = doubler ? baseCoins * 2 : baseCoins;
      const earnedXp = 5 + combo;
      addCoinsAndXp(earnedCoins, earnedXp);
      setScore((s) => s + 1);
      setCombo((c) => c + 1);
      setCoinsEarned((c) => c + earnedCoins);
      setStatus("correct");
      const id = Math.random().toString(36).slice(2);
      setPoppers((p) => [...p, { id, n: earnedCoins }]);
      setTimeout(() => setPoppers((p) => p.filter((x) => x.id !== id)), 800);
      setTimeout(next, 220);
    } else {
      setStatus("wrong");
      setCombo(0);
      setTimeout(() => setStatus("idle"), 450);
    }
  };

  const useExtraTime = () => {
    if (consumePowerup("extraTime")) {
      setTime((t) => t + 15);
    }
  };
  const useSkip = () => {
    if (status !== "idle") return;
    if (consumePowerup("skip")) next();
  };
  const useFreeze = () => {
    if (frozen) return;
    if (consumePowerup("freeze")) {
      setFrozen(true);
      setTimeout(() => setFrozen(false), 5000);
    }
  };
  const useDoubler = () => {
    if (doubler) return;
    if (consumePowerup("doubler")) {
      setDoubler(true);
    }
  };

  const restart = () => {
    setQuestion(generateQuestion(getState().selectedTables));
    setValue("");
    setStatus("idle");
    setTime(ROUND_SECONDS);
    setScore(0);
    setCombo(0);
    setCoinsEarned(0);
    setRunning(true);
    setDoubler(false);
    setFrozen(false);
    startTs.current = performance.now();
  };

  const pct = Math.max(0, Math.min(100, (time / ROUND_SECONDS) * 100));

  return (
    <div className="max-w-3xl mx-auto" data-testid="quickfire-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
            Mode 01
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">Quick-Fire</h1>
        </div>
        <Link
          to="/"
          className="brut-border bg-white px-3 py-2 font-bold text-xs uppercase tracking-widest hover:bg-zinc-100"
          data-testid="exit-game"
        >
          <X size={14} className="inline -mt-0.5" /> Exit
        </Link>
      </div>

      {/* HUD */}
      <div className="bg-white brut-border brut-shadow p-5 mb-5">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-2 brut-border bg-zinc-950 text-white px-3 py-2">
            <Clock size={16} />
            <span className="font-mono font-black text-xl tabular-nums" data-testid="hud-timer">
              {String(Math.max(0, time)).padStart(2, "0")}s
            </span>
          </div>
          <div className="flex items-center gap-2 brut-border bg-blue-600 text-white px-3 py-2">
            <span className="font-mono font-black text-xl tabular-nums" data-testid="hud-score">
              {score}
            </span>
            <span className="text-[10px] uppercase tracking-widest opacity-80">score</span>
          </div>
          <motion.div
            animate={combo > 0 ? { scale: [1, 1.06, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, repeat: combo > 0 ? Infinity : 0 }}
            className={`flex items-center gap-2 brut-border px-3 py-2 ${
              combo > 0 ? "bg-amber-300" : "bg-white"
            }`}
            data-testid="hud-combo"
          >
            <Flame size={16} />
            <span className="font-mono font-black text-xl tabular-nums">x{combo}</span>
          </motion.div>
          <div className="hidden sm:flex items-center gap-2 brut-border bg-white px-3 py-2">
            <Coins size={16} className="text-amber-600" />
            <span className="font-mono font-black text-xl tabular-nums" data-testid="hud-run-coins">
              +{coinsEarned}
            </span>
          </div>
        </div>
        <div className="mt-4 h-3 bg-zinc-200 brut-border overflow-hidden">
          <motion.div
            className={`h-full ${frozen ? "bg-cyan-500" : "bg-zinc-950"}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
        </div>
      </div>

      {/* Game area */}
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
          <div className="text-center py-6" data-testid="quickfire-results">
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
              Time
            </div>
            <h2 className="text-5xl sm:text-6xl font-black tracking-tighter mt-2">UP.</h2>
            <div className="grid grid-cols-3 gap-3 mt-8 max-w-md mx-auto">
              <div className="brut-border p-3 bg-blue-600 text-white">
                <div className="text-[10px] uppercase tracking-widest opacity-80">Score</div>
                <div className="font-mono font-black text-3xl">{score}</div>
              </div>
              <div className="brut-border p-3 bg-amber-300">
                <div className="text-[10px] uppercase tracking-widest">Coins</div>
                <div className="font-mono font-black text-3xl">+{coinsEarned}</div>
              </div>
              <div className="brut-border p-3 bg-zinc-950 text-white">
                <div className="text-[10px] uppercase tracking-widest opacity-70">Best Combo</div>
                <div className="font-mono font-black text-3xl">x{combo}</div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={restart}
                className="bg-zinc-950 text-white brut-border brut-shadow font-bold px-6 py-3 hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
                data-testid="play-again"
              >
                Play Again
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

      {/* Powerups */}
      {running && (
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="powerup-bar">
          <PowerupBtn
            testid="pu-extra-time"
            label="+15s"
            sub="Extra Time"
            count={state.powerups.extraTime}
            Icon={Plus}
            onClick={useExtraTime}
            color="bg-emerald-300"
          />
          <PowerupBtn
            testid="pu-skip"
            label="Skip"
            sub="Question"
            count={state.powerups.skip}
            Icon={SkipForward}
            onClick={useSkip}
            color="bg-blue-300"
          />
          <PowerupBtn
            testid="pu-freeze"
            label={frozen ? "Active" : "Freeze"}
            sub="5s pause"
            count={state.powerups.freeze}
            Icon={Snowflake}
            onClick={useFreeze}
            color="bg-cyan-300"
            disabled={frozen}
          />
          <PowerupBtn
            testid="pu-doubler"
            label={doubler ? "x2 Active" : "x2 Coins"}
            sub="this run"
            count={state.powerups.doubler}
            Icon={Sparkles}
            onClick={useDoubler}
            color="bg-amber-300"
            disabled={doubler}
          />
        </div>
      )}
    </div>
  );
};

const PowerupBtn = ({ testid, label, sub, count, Icon, onClick, color, disabled }) => {
  const empty = (count || 0) <= 0;
  return (
    <button
      data-testid={testid}
      disabled={empty || disabled}
      onClick={onClick}
      className={`brut-border brut-shadow-sm p-3 text-left flex items-center gap-3 transition-all ${
        empty || disabled
          ? "bg-zinc-100 text-zinc-400 cursor-not-allowed"
          : `${color} hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none`
      }`}
    >
      <div className="brut-border bg-white w-10 h-10 grid place-items-center">
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-black text-sm leading-none">{label}</div>
        <div className="text-[10px] uppercase tracking-widest font-bold opacity-70 mt-1">
          {sub}
        </div>
      </div>
      <div className="font-mono font-black text-lg">{count || 0}</div>
    </button>
  );
};

export default QuickFire;
