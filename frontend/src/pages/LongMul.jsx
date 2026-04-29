import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, X, Grid3x3 } from "lucide-react";
import Question from "@/components/Question";
import { recordAnswer, addCoinsAndXp } from "@/lib/storage";
import { generateLongMul } from "@/lib/game";
import { sfx } from "@/lib/sound";

const ROUND_LEN = 8;
const DIFFS = [
  { key: "easy", label: "Easy", sub: "2-digit × 1-digit" },
  { key: "medium", label: "Medium", sub: "2-digit × 2-digit" },
  { key: "hard", label: "Hard", sub: "3-digit × 2-digit" },
];

const LongMul = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("brief");
  const [difficulty, setDifficulty] = useState("medium");
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [question, setQuestion] = useState(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [showHint, setShowHint] = useState(false);
  const startTs = useRef(performance.now());

  const begin = (diff) => {
    setDifficulty(diff);
    setIdx(0);
    setCorrect(0);
    setQuestion(generateLongMul({ difficulty: diff }));
    setValue("");
    setStatus("idle");
    setShowHint(false);
    setPhase("play");
    startTs.current = performance.now();
  };

  const next = () => {
    if (idx + 1 >= ROUND_LEN) {
      setPhase("result");
      return;
    }
    setIdx((i) => i + 1);
    setQuestion((q) => generateLongMul({ difficulty, lastKey: q?.key }));
    setValue("");
    setStatus("idle");
    setShowHint(false);
    startTs.current = performance.now();
  };

  const submit = () => {
    if (status !== "idle" || !question) return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const ok = parseInt(value, 10) === question.answer;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct: ok, ms });
    if (ok) {
      const reward = difficulty === "easy" ? 3 : difficulty === "medium" ? 5 : 8;
      addCoinsAndXp(reward, 8);
      sfx.correct();
      sfx.coin();
      setCorrect((c) => c + 1);
      setStatus("correct");
      setTimeout(next, 400);
    } else {
      sfx.wrong();
      setStatus("wrong");
      setShowHint(true);
      setTimeout(() => setStatus("idle"), 700);
    }
  };

  return (
    <div className="max-w-3xl mx-auto" data-testid="long-mul-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2 flex items-center gap-2">
            <Grid3x3 size={22} className="text-violet-600" /> Long Multiplication
          </h1>
        </div>
        <Link
          to="/"
          className="brut-border-soft surface px-3 py-1.5 font-semibold text-xs uppercase tracking-widest hover:surface-2 text-fg"
          data-testid="exit-game"
        >
          <X size={13} className="inline -mt-0.5" /> Exit
        </Link>
      </div>

      {phase === "brief" && (
        <div className="surface brut-border brut-shadow p-7" data-testid="long-mul-brief">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            Choose difficulty
          </div>
          <h2 className="text-xl font-bold tracking-tight text-fg mt-1">
            {ROUND_LEN} questions · enter the final product
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
            {DIFFS.map((d) => (
              <button
                key={d.key}
                onClick={() => begin(d.key)}
                data-testid={`diff-${d.key}`}
                className="brut-border brut-shadow surface p-4 text-left hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all"
              >
                <div className="text-base font-bold text-fg">{d.label}</div>
                <div className="text-xs text-muted mt-0.5">{d.sub}</div>
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-4 font-mono">
            Tip: break it apart — e.g. 23 × 47 = 23×40 + 23×7 = 920 + 161 = 1081.
          </p>
        </div>
      )}

      {phase === "play" && question && (
        <>
          <div className="surface brut-border p-3 mb-4 flex items-center justify-between">
            <div className="text-sm text-fg font-semibold">
              {DIFFS.find((d) => d.key === difficulty).label} ·{" "}
              <span className="font-mono">
                {idx + 1}/{ROUND_LEN}
              </span>
            </div>
            <div className="font-mono text-sm text-muted">
              Correct: <span className="text-fg font-bold">{correct}</span>
            </div>
          </div>
          <div className="surface brut-border brut-shadow p-7 sm:p-9">
            <Question
              question={question}
              value={value}
              onChange={setValue}
              onSubmit={submit}
              status={status}
              hint={showHint ? `${question.a} × ${question.b} = ${question.answer}` : null}
            />
          </div>
        </>
      )}

      {phase === "result" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="surface brut-border brut-shadow p-7 text-center"
          data-testid="long-mul-result"
        >
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            Round complete
          </div>
          <h2 className="text-4xl sm:text-5xl font-black tracking-tighter mt-1 text-fg">
            {correct}<span className="text-muted">/{ROUND_LEN}</span>
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-2.5">
            <button
              onClick={() => setPhase("brief")}
              data-testid="long-mul-again"
              className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
            >
              Play again
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
    </div>
  );
};

export default LongMul;
