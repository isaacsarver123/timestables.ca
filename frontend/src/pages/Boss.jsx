import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Coins, Skull, X, Heart, Plus, SkipForward } from "lucide-react";
import Question from "@/components/Question";
import {
  getState,
  subscribe,
  recordAnswer,
  addCoinsAndXp,
  consumePowerup,
  bumpBossLevel,
} from "@/lib/storage";
import { bossConfig, bossName, generateQuestion } from "@/lib/game";

const MAX_LIVES = 3;

const Boss = () => {
  const navigate = useNavigate();
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const [phase, setPhase] = useState("brief"); // brief | play | result
  const [outcome, setOutcome] = useState(null); // 'win' | 'lose'
  const [progress, setProgress] = useState(0);
  const [lives, setLives] = useState(MAX_LIVES);
  const [time, setTime] = useState(0);
  const [question, setQuestion] = useState(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const startTs = useRef(performance.now());

  const level = state.bossLevel;
  const cfg = bossConfig(level);
  const name = bossName(level);

  const newQ = useCallback(() => {
    const q = generateQuestion(cfg.tables, {
      lastKey: question?.key,
      maxFactor: cfg.maxFactor,
      minFactor: 2,
    });
    setQuestion(q);
    setValue("");
    setStatus("idle");
    setTime(cfg.timePerQ);
    startTs.current = performance.now();
  }, [cfg.tables, cfg.maxFactor, cfg.timePerQ, question?.key]);

  const startBattle = () => {
    setProgress(0);
    setLives(MAX_LIVES);
    setOutcome(null);
    setPhase("play");
    const q = generateQuestion(cfg.tables, { maxFactor: cfg.maxFactor, minFactor: 2 });
    setQuestion(q);
    setValue("");
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

  // timer per question
  useEffect(() => {
    if (phase !== "play" || status !== "idle") return;
    if (time <= 0) {
      setStatus("wrong");
      recordAnswer({ a: question.a, b: question.b, correct: false, ms: cfg.timePerQ * 1000 });
      setTimeout(() => loseLife(), 400);
      return;
    }
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [phase, status, time, question, cfg.timePerQ, loseLife]);

  const submit = () => {
    if (phase !== "play" || status !== "idle") return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const correct = parseInt(value, 10) === question.answer;
    recordAnswer({ a: question.a, b: question.b, correct, ms });
    if (correct) {
      const earnedCoins = 3;
      addCoinsAndXp(earnedCoins, 8);
      setStatus("correct");
      const np = progress + 1;
      setProgress(np);
      if (np >= cfg.questions) {
        // win
        addCoinsAndXp(cfg.reward, 30 + level * 5);
        bumpBossLevel();
        setOutcome("win");
        setTimeout(() => setPhase("result"), 500);
      } else {
        setTimeout(newQ, 250);
      }
    } else {
      setStatus("wrong");
      setTimeout(() => loseLife(), 500);
    }
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
        setOutcome("win");
        setTimeout(() => setPhase("result"), 500);
      } else {
        newQ();
      }
    }
  };

  const pct = (progress / cfg.questions) * 100;
  const timePct = (time / cfg.timePerQ) * 100;

  return (
    <div className="max-w-3xl mx-auto" data-testid="boss-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
            Mode 03 · Boss
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tighter">
            LV {level} · {name}
          </h1>
        </div>
        <Link
          to="/"
          className="brut-border bg-white px-3 py-2 font-bold text-xs uppercase tracking-widest hover:bg-zinc-100"
          data-testid="exit-game"
        >
          <X size={14} className="inline -mt-0.5" /> Exit
        </Link>
      </div>

      {phase === "brief" && (
        <div className="bg-white brut-border brut-shadow-lg p-8 sm:p-10" data-testid="boss-brief">
          <div className="flex items-start gap-5 mb-6">
            <div className="w-16 h-16 brut-border bg-zinc-950 text-white grid place-items-center">
              <Skull size={28} />
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
                Encounter
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight">{name}</h2>
              <p className="text-sm text-zinc-600 mt-1">
                Solve every challenge before time runs out. Three lives. No retries inside.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Tables" value={cfg.tables.join(", ")} />
            <Stat label="Questions" value={cfg.questions} />
            <Stat label="Time / Q" value={`${cfg.timePerQ}s`} />
            <Stat label="Reward" value={`${cfg.reward}c`} highlight />
          </div>
          <div className="mt-8 flex gap-3">
            <button
              onClick={startBattle}
              data-testid="start-boss"
              className="bg-zinc-950 text-white brut-border brut-shadow font-bold px-6 py-3 hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
            >
              Engage
            </button>
          </div>
        </div>
      )}

      {phase === "play" && question && (
        <>
          <div className="bg-white brut-border brut-shadow p-5 mb-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1" data-testid="hud-lives">
                {Array.from({ length: MAX_LIVES }).map((_, i) => (
                  <Heart
                    key={i}
                    size={20}
                    className={i < lives ? "fill-red-500 text-red-700" : "text-zinc-300"}
                  />
                ))}
              </div>
              <div className="font-mono font-black text-sm">
                {progress} / {cfg.questions}
              </div>
              <div className="brut-border bg-zinc-950 text-white px-3 py-1.5 font-mono font-black tabular-nums" data-testid="hud-timer">
                {time}s
              </div>
            </div>
            <div className="h-3 bg-zinc-200 brut-border overflow-hidden">
              <motion.div
                className="h-full bg-blue-600 border-r-2 border-zinc-900"
                animate={{ width: `${pct}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <div className="mt-2 h-2 bg-zinc-100 brut-border overflow-hidden">
              <motion.div
                className="h-full bg-red-500"
                animate={{ width: `${timePct}%` }}
                transition={{ duration: 0.4, ease: "linear" }}
              />
            </div>
          </div>

          <div className="bg-white brut-border brut-shadow-lg p-8 sm:p-10">
            <Question
              question={question}
              value={value}
              onChange={setValue}
              onSubmit={submit}
              status={status}
              disabled={status !== "idle"}
            />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              data-testid="pu-extra-time"
              disabled={(state.powerups.extraTime || 0) <= 0}
              onClick={useExtraTime}
              className="brut-border brut-shadow-sm p-3 flex items-center gap-3 bg-emerald-300 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed transition-all"
            >
              <Plus size={16} />
              <span className="font-bold text-sm">+15s</span>
              <span className="font-mono font-black ml-auto">{state.powerups.extraTime || 0}</span>
            </button>
            <button
              data-testid="pu-skip"
              disabled={(state.powerups.skip || 0) <= 0}
              onClick={useSkip}
              className="brut-border brut-shadow-sm p-3 flex items-center gap-3 bg-blue-300 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed transition-all"
            >
              <SkipForward size={16} />
              <span className="font-bold text-sm">Skip</span>
              <span className="font-mono font-black ml-auto">{state.powerups.skip || 0}</span>
            </button>
          </div>
        </>
      )}

      <AnimatePresence>
        {phase === "result" && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white brut-border brut-shadow-lg p-8 sm:p-10 text-center"
            data-testid="boss-result"
          >
            <div className="text-[10px] uppercase tracking-[0.3em] text-zinc-500 font-bold">
              Result
            </div>
            <h2
              className={`text-5xl sm:text-7xl font-black tracking-tighter mt-2 ${
                outcome === "win" ? "text-emerald-600" : "text-red-600"
              }`}
            >
              {outcome === "win" ? "VICTORY" : "DEFEAT"}
            </h2>
            <p className="mt-3 text-zinc-600 font-medium">
              {outcome === "win"
                ? `You earned ${cfg.reward} coins. Level ${level + 1} unlocked.`
                : `You progressed ${progress} of ${cfg.questions}. Try again.`}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <button
                onClick={() => setPhase("brief")}
                data-testid="boss-retry"
                className="bg-zinc-950 text-white brut-border brut-shadow font-bold px-6 py-3 hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
              >
                {outcome === "win" ? "Next Level" : "Try Again"}
              </button>
              <button
                onClick={() => navigate("/")}
                className="bg-white brut-border brut-shadow font-bold px-6 py-3 hover:bg-zinc-100 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
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
  <div className={`brut-border p-3 ${highlight ? "bg-amber-300" : "bg-white"}`}>
    <div className="text-[10px] uppercase tracking-widest text-zinc-600 font-bold">{label}</div>
    <div className="font-mono font-black text-lg mt-1 flex items-center gap-1">
      {highlight && <Coins size={16} />}
      {value}
    </div>
  </div>
);

export default Boss;
