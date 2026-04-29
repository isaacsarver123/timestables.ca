import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, X, Grid3x3, ArrowRight } from "lucide-react";
import Question from "@/components/Question";
import StepMultiplication from "@/components/StepMultiplication";
import { recordAnswer, addCoinsAndXp } from "@/lib/storage";
import { generateLongMul, generateDecimalMul, generateStepMultiplication } from "@/lib/game";
import { sfx } from "@/lib/sound";

const ROUND_LEN = 8;
const STEP_ROUND_LEN = 4;
const DIFFS = [
  { key: "easy", label: "Easy", sub: "2-digit × 1-digit" },
  { key: "medium", label: "Medium", sub: "2-digit × 2-digit" },
  { key: "hard", label: "Hard", sub: "3-digit × 2-digit" },
  { key: "decimals", label: "Decimals", sub: "Decimal × integer (e.g. 1.5 × 8)", decimal: true },
  { key: "step", label: "Step-by-Step", sub: "Solve like on paper, partial by partial", step: true },
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
    if (diff === "step") {
      setQuestion(generateStepMultiplication({ difficulty: "medium" }));
    } else if (diff === "decimals") {
      setQuestion(generateDecimalMul());
    } else {
      setQuestion(generateLongMul({ difficulty: diff }));
    }
    setValue("");
    setStatus("idle");
    setShowHint(false);
    setPhase("play");
    startTs.current = performance.now();
  };

  const isStep = difficulty === "step";
  const totalLen = isStep ? STEP_ROUND_LEN : ROUND_LEN;

  const next = () => {
    if (idx + 1 >= totalLen) {
      setPhase("result");
      return;
    }
    setIdx((i) => i + 1);
    if (isStep) {
      setQuestion((q) =>
        generateStepMultiplication({ difficulty: "medium", lastKey: q?.key })
      );
    } else if (difficulty === "decimals") {
      setQuestion((q) => generateDecimalMul({ lastKey: q?.key }));
    } else {
      setQuestion((q) => generateLongMul({ difficulty, lastKey: q?.key }));
    }
    setValue("");
    setStatus("idle");
    setShowHint(false);
    startTs.current = performance.now();
  };

  const submit = () => {
    if (status !== "idle" || !question) return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const guess = parseFloat(value);
    const ok = Math.abs(guess - question.answer) < 0.0001;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct: ok, ms });
    if (ok) {
      const reward =
        difficulty === "easy"
          ? 3
          : difficulty === "medium"
          ? 5
          : difficulty === "decimals"
          ? 6
          : 8;
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
            Choose how to practise
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
                {idx + 1}/{totalLen}
              </span>
            </div>
            <div className="font-mono text-sm text-muted">
              Correct: <span className="text-fg font-bold">{correct}</span>
            </div>
          </div>
          {isStep ? (
            <div className="surface brut-border brut-shadow p-5 sm:p-7" data-testid="step-mul-card">
              <StepMultiplication
                problem={question}
                onComplete={() => {
                  addCoinsAndXp(8, 12);
                  setCorrect((c) => c + 1);
                }}
                onWrong={() => {
                  recordAnswer({
                    a: question.a,
                    b: question.b,
                    op: "×",
                    correct: false,
                    ms: 0,
                  });
                }}
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={next}
                  data-testid="step-next"
                  className="surface brut-border brut-shadow font-bold text-sm px-5 py-2 hover:surface-2 active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-fg flex items-center gap-2"
                >
                  Next problem <ArrowRight size={14} />
                </button>
              </div>
            </div>
          ) : (
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
          )}
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
            {correct}<span className="text-muted">/{totalLen}</span>
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
