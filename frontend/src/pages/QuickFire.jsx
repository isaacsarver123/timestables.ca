import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Clock, Flame, X, Plus, SkipForward, Snowflake, Sparkles } from "lucide-react";
import Question from "@/components/Question";
import ChoiceGrid from "@/components/ChoiceGrid";
import ConfirmLeaveModal from "@/components/ConfirmLeaveModal";
import { useNavGuard } from "@/lib/leaveGuard";
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

const ROUND_SECONDS = 60;

const QuickFire = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const [question, setQuestion] = useState(() =>
    generateQuestion(getState().selectedTables, { op: getState().opMode })
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
  const [lastChoice, setLastChoice] = useState(null);
  const startTs = useRef(performance.now());

  const finish = useCallback(() => {
    setRunning(false);
    recordRunResult({ mode: "quickfire", score, streak: combo });
  }, [score, combo]);

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
      const baseCoins = 1 + Math.floor(combo / 5);
      const earnedCoins = doubler ? baseCoins * 2 : baseCoins;
      const earnedXp = 5 + combo;
      addCoinsAndXp(earnedCoins, earnedXp);
      setScore((s) => s + 1);
      setCombo((c) => c + 1);
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
      setCombo(0);
      sfx.wrong();
      if (getState().inputMode === "choices") {
        setLastChoice(guess);
        setTimeout(() => next(), 900);
      } else {
        // Show correct answer briefly, then move on.
        setTimeout(() => next(), 1100);
      }
    }
  };

  const submit = () => {
    if (value === "" || value === "-") return;
    evaluate(parseInt(value, 10));
  };

  const useExtraTime = () => {
    if (consumePowerup("extraTime")) setTime((t) => t + 15);
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
    if (consumePowerup("doubler")) setDoubler(true);
  };

  const restart = () => {
    setQuestion(generateQuestion(getState().selectedTables, { op: getState().opMode }));
    setValue("");
    setLastChoice(null);
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
  const guard = useNavGuard(running);

  return (
    <div className="max-w-3xl mx-auto" data-testid="quickfire-page">
      <ConfirmLeaveModal open={guard.open} onCancel={guard.cancel} onConfirm={guard.confirm} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            Mode
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Quick-Fire</h1>
        </div>
        <button
          onClick={() => guard.tryGo("/")}
          className="brut-border-soft surface px-3 py-1.5 font-semibold text-xs uppercase tracking-widest hover:surface-2 text-fg"
          data-testid="exit-game"
        >
          <X size={13} className="inline -mt-0.5" /> Exit
        </button>
      </div>

      <div className="surface brut-border p-4 mb-4">
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <div className="flex items-center gap-1.5 brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-2.5 py-1.5">
            <Clock size={14} />
            <span className="font-mono font-bold text-base tabular-nums" data-testid="hud-timer">
              {String(Math.max(0, time)).padStart(2, "0")}s
            </span>
          </div>
          <div className="flex items-center gap-1.5 brut-border bg-blue-600 text-white px-2.5 py-1.5">
            <span className="font-mono font-bold text-base tabular-nums" data-testid="hud-score">
              {score}
            </span>
            <span className="text-[10px] uppercase tracking-widest opacity-90">score</span>
          </div>
          <motion.div
            animate={combo > 0 ? { scale: [1, 1.05, 1] } : { scale: 1 }}
            transition={{ duration: 0.5, repeat: combo > 0 ? Infinity : 0 }}
            className={`flex items-center gap-1.5 brut-border px-2.5 py-1.5 ${
              combo > 0 ? "bg-amber-300" : "surface"
            }`}
            data-testid="hud-combo"
          >
            <Flame size={14} className={combo > 0 ? "text-zinc-950" : "text-muted"} />
            <span className={`font-mono font-bold text-base tabular-nums ${combo > 0 ? "text-zinc-950" : "text-fg"}`}>x{combo}</span>
          </motion.div>
          <div className="hidden sm:flex items-center gap-1.5 brut-border surface px-2.5 py-1.5">
            <Coins size={14} className="text-amber-500" />
            <span className="font-mono font-bold text-base tabular-nums text-fg" data-testid="hud-run-coins">
              +{coinsEarned}
            </span>
          </div>
        </div>
        <div className="mt-3 h-2.5 surface-2 brut-border-soft overflow-hidden">
          <motion.div
            className={`h-full ${frozen ? "bg-cyan-500" : "bg-zinc-900 dark:bg-zinc-100"}`}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.4, ease: "linear" }}
          />
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
              correctAnswer={question?.answer}
            />
          )
        ) : (
          <div className="text-center py-4" data-testid="quickfire-results">
            <div className="flex items-baseline justify-center gap-2 leading-none">
              <span className="text-3xl sm:text-4xl font-black tracking-tighter text-fg">Time</span>
              <motion.span
                initial={{ scale: 1.6, opacity: 0 }}
                animate={{ scale: [1.6, 1.15, 1], opacity: 1 }}
                transition={{ duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
                className="text-4xl sm:text-5xl font-black tracking-tighter text-fg"
                data-testid="time-up-up"
              >
                UP.
              </motion.span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-2.5 mt-6 max-w-md mx-auto">
              <div className="brut-border p-2.5 bg-blue-600 text-white">
                <div className="text-[10px] uppercase tracking-widest opacity-90">Score</div>
                <div className="font-mono font-bold text-2xl">{score}</div>
              </div>
              <div className="brut-border p-2.5 bg-amber-300 text-zinc-950">
                <div className="text-[10px] uppercase tracking-widest">Coins</div>
                <div className="font-mono font-bold text-2xl">+{coinsEarned}</div>
              </div>
              <div className="brut-border p-2.5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
                <div className="text-[10px] uppercase tracking-widest opacity-70">Best Combo</div>
                <div className="font-mono font-bold text-2xl">x{combo}</div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button
                onClick={restart}
                className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
                data-testid="play-again"
              >
                Play Again
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
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5" data-testid="powerup-bar">
          <PowerupBtn testid="pu-extra-time" label="+15s" sub="Extra Time" count={state.powerups.extraTime} Icon={Plus} onClick={useExtraTime} color="bg-emerald-300" />
          <PowerupBtn testid="pu-skip" label="Skip" sub="Question" count={state.powerups.skip} Icon={SkipForward} onClick={useSkip} color="bg-blue-300" />
          <PowerupBtn testid="pu-freeze" label={frozen ? "Active" : "Freeze"} sub="5s pause" count={state.powerups.freeze} Icon={Snowflake} onClick={useFreeze} color="bg-cyan-300" disabled={frozen} />
          <PowerupBtn testid="pu-doubler" label={doubler ? "x2 Active" : "x2 Coins"} sub="this run" count={state.powerups.doubler} Icon={Sparkles} onClick={useDoubler} color="bg-amber-300" disabled={doubler} />
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
      className={`brut-border brut-shadow-sm p-2.5 text-left flex items-center gap-2.5 transition-all text-zinc-950 ${
        empty || disabled
          ? "surface-2 text-muted cursor-not-allowed"
          : `${color} hover:-translate-y-0.5 active:translate-y-0.5 active:brut-shadow-none`
      }`}
    >
      <div className="brut-border surface w-9 h-9 grid place-items-center text-fg">
        <Icon size={16} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-xs leading-none">{label}</div>
        <div className="text-[9px] uppercase tracking-widest font-semibold opacity-70 mt-1">
          {sub}
        </div>
      </div>
      <div className="font-mono font-bold text-sm">{count || 0}</div>
    </button>
  );
};

export default QuickFire;
