import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Skull, X, Heart, Plus, SkipForward } from "lucide-react";
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
  bumpBossLevel,
} from "@/lib/storage";
import { bossConfig, bossName, generateQuestion } from "@/lib/game";
import { sfx } from "@/lib/sound";

const MAX_LIVES = 3;

const Boss = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const [phase, setPhase] = useState("brief");
  const [outcome, setOutcome] = useState(null);
  const [progress, setProgress] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [time, setTime] = useState(0);
  const [question, setQuestion] = useState(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [lastChoice, setLastChoice] = useState(null);
  const startTs = useRef(performance.now());

  const level = state.bossLevel;
  const cfg = bossConfig(level);
  const name = bossName(level);

  const newQ = useCallback(() => {
    const q = generateQuestion(cfg.tables, {
      lastKey: question?.key,
      maxFactor: cfg.maxFactor,
      minFactor: 2,
      op: getState().opMode,
    });
    setQuestion(q);
    setValue("");
    setLastChoice(null);
    setStatus("idle");
    setTime(cfg.timePerQ);
    startTs.current = performance.now();
  }, [cfg.tables, cfg.maxFactor, cfg.timePerQ, question?.key]);

  const startBattle = () => {
    setProgress(0);
    setLives(MAX_LIVES);
    setOutcome(null);
    setPhase("play");
    const q = generateQuestion(cfg.tables, {
      maxFactor: cfg.maxFactor,
      minFactor: 2,
      op: getState().opMode,
    });
    setQuestion(q);
    setValue("");
    setLastChoice(null);
    setStatus("idle");
    setTime(cfg.timePerQ);
    startTs.current = performance.now();
  };

  const loseLife = useCallback(() => {
    setLives((l) => {
      const nl = l - 1;
      if (nl <= 0) {
        setOutcome("lose");
        setPhase("result");
      } else {
        setTimeout(newQ, 400);
      }
      return nl;
    });
  }, [newQ]);

  useEffect(() => {
    if (phase !== "play" || status !== "idle") return;
    if (time <= 0) {
      setStatus("wrong");
      sfx.wrong();
      recordAnswer({
        a: question.a,
        b: question.b,
        op: question.op,
        correct: false,
        ms: cfg.timePerQ * 1000,
      });
      setTimeout(() => loseLife(), 400);
      return;
    }
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, status, time, question, cfg.timePerQ, loseLife]);

  const evaluate = (guess) => {
    if (phase !== "play" || status !== "idle") return;
    const ms = Math.round(performance.now() - startTs.current);
    const correct = guess === question.answer;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct, ms });
    if (correct) {
      addCoinsAndXp(3, 8);
      sfx.correct();
      sfx.coin();
      setStatus("correct");
      const np = progress + 1;
      setProgress(np);
      if (np >= cfg.questions) {
        addCoinsAndXp(cfg.reward, 30 + level * 5);
        bumpBossLevel();
        sfx.levelup();
        setOutcome("win");
        setTimeout(() => setPhase("result"), 500);
      } else {
        setTimeout(newQ, 250);
      }
    } else {
      setStatus("wrong");
      sfx.wrong();
      if (getState().inputMode === "choices") setLastChoice(guess);
      setTimeout(() => loseLife(), 600);
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
    if (consumePowerup("skip")) {
      const np = progress + 1;
      setProgress(np);
      if (np >= cfg.questions) {
        addCoinsAndXp(cfg.reward, 30 + level * 5);
        bumpBossLevel();
        sfx.levelup();
        setOutcome("win");
        setTimeout(() => setPhase("result"), 500);
      } else {
        newQ();
      }
    }
  };

  const pct = (progress / cfg.questions) * 100;
  const timePct = (time / cfg.timePerQ) * 100;
  const guard = useNavGuard(phase === "play");

  return (
    <div className="max-w-3xl mx-auto" data-testid="boss-page">
      <ConfirmLeaveModal open={guard.open} onCancel={guard.cancel} onConfirm={guard.confirm} />
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            Mode · Boss
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">
            LV {level} · {name}
          </h1>
        </div>
        <button
          onClick={() => guard.tryGo("/")}
          className="brut-border-soft surface px-3 py-1.5 font-semibold text-xs uppercase tracking-widest hover:surface-2 text-fg"
          data-testid="exit-game"
        >
          <X size={13} className="inline -mt-0.5" /> Exit
        </button>
      </div>

      {phase === "brief" && (
        <div className="surface brut-border brut-shadow p-7 sm:p-9" data-testid="boss-brief">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-14 h-14 brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 grid place-items-center">
              <Skull size={24} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
                Encounter
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-fg">{name}</h2>
              <p className="text-sm text-muted mt-1">
                Solve every challenge before time runs out. Three lives. No retries inside.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <Stat label="Tables" value={cfg.tables.join(", ")} />
            <Stat label="Questions" value={cfg.questions} />
            <Stat label="Time / Q" value={`${cfg.timePerQ}s`} />
            <Stat label="Reward" value={`${cfg.reward}c`} highlight />
          </div>
          <div className="mt-7 flex gap-2.5">
            <button
              onClick={startBattle}
              data-testid="start-boss"
              className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
            >
              Engage
            </button>
          </div>
        </div>
      )}

      {phase === "play" && question && (
        <>
          <div className="surface brut-border p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1" data-testid="hud-lives">
                {Array.from({ length: MAX_LIVES }).map((_, i) => (
                  <Heart
                    key={i}
                    size={18}
                    className={i < lives ? "fill-red-500 text-red-700" : "text-zinc-300 dark:text-zinc-700"}
                  />
                ))}
              </div>
              <div className="font-mono font-bold text-sm text-fg">
                {progress} / {cfg.questions}
              </div>
              <div className="brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-2.5 py-1 font-mono font-bold tabular-nums" data-testid="hud-timer">
                {time}s
              </div>
            </div>
            <div className="h-2.5 surface-2 brut-border-soft overflow-hidden">
              <motion.div
                className="h-full bg-blue-600"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mt-1.5 h-1.5 surface-2 brut-border-soft overflow-hidden">
              <motion.div
                className="h-full bg-red-500"
                animate={{ width: `${timePct}%` }}
                transition={{ duration: 0.4, ease: "linear" }}
              />
            </div>
          </div>

          <div className="surface brut-border brut-shadow p-7 sm:p-9">
            {state.inputMode === "choices" ? (
              <ChoiceGrid
                question={question}
                onAnswer={evaluate}
                status={status}
                disabled={status !== "idle"}
                lastChoice={lastChoice}
              />
            ) : (
              <Question
                question={question}
                value={value}
                onChange={setValue}
                onSubmit={submit}
                status={status}
                disabled={status !== "idle"}
                correctAnswer={question?.answer}
              />
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <button
              data-testid="pu-extra-time"
              disabled={(state.powerups.extraTime || 0) <= 0}
              onClick={useExtraTime}
              className="brut-border brut-shadow-sm p-2.5 flex items-center gap-2.5 bg-emerald-300 text-zinc-950 disabled:surface-2 disabled:text-muted disabled:cursor-not-allowed transition-all"
            >
              <Plus size={14} />
              <span className="font-bold text-xs">+15s</span>
              <span className="font-mono font-bold ml-auto">{state.powerups.extraTime || 0}</span>
            </button>
            <button
              data-testid="pu-skip"
              disabled={(state.powerups.skip || 0) <= 0}
              onClick={useSkip}
              className="brut-border brut-shadow-sm p-2.5 flex items-center gap-2.5 bg-blue-300 text-zinc-950 disabled:surface-2 disabled:text-muted disabled:cursor-not-allowed transition-all"
            >
              <SkipForward size={14} />
              <span className="font-bold text-xs">Skip</span>
              <span className="font-mono font-bold ml-auto">{state.powerups.skip || 0}</span>
            </button>
          </div>
        </>
      )}

      <AnimatePresence>
        {phase === "result" && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="surface brut-border brut-shadow p-7 sm:p-9 text-center"
            data-testid="boss-result"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
              Result
            </div>
            <h2
              className={`text-4xl sm:text-6xl font-black tracking-tighter mt-1 ${
                outcome === "win" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {outcome === "win" ? "VICTORY" : "DEFEAT"}
            </h2>
            <p className="mt-2 text-muted text-sm">
              {outcome === "win"
                ? `You earned ${cfg.reward} coins. Level ${level + 1} unlocked.`
                : `You progressed ${progress} of ${cfg.questions}. Try again.`}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2.5">
              <button
                onClick={() => setPhase("brief")}
                data-testid="boss-retry"
                className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
              >
                {outcome === "win" ? "Next Level" : "Try Again"}
              </button>
              <button
                onClick={() => navigate("/")}
                className="surface brut-border brut-shadow font-bold px-5 py-2.5 hover:surface-2 active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm text-fg"
                data-testid="back-home"
              >
                Home
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const Stat = ({ label, value, highlight }) => (
  <div className={`brut-border p-2.5 ${highlight ? "bg-amber-300 text-zinc-950" : "surface text-fg"}`}>
    <div className="text-[10px] uppercase tracking-widest font-medium opacity-70">{label}</div>
    <div className="font-mono font-bold text-base mt-1 flex items-center gap-1">
      {highlight && <Coins size={14} />}
      {value}
    </div>
  </div>
);

export default Boss;
