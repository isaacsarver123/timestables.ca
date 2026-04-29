import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, X, Divide, ArrowRight } from "lucide-react";
import Question from "@/components/Question";
import StepDivision from "@/components/StepDivision";
import { recordAnswer, addCoinsAndXp } from "@/lib/storage";
import { generateLongDiv, generateStepDivision } from "@/lib/game";
import { sfx } from "@/lib/sound";

const ROUND_LEN = 8;
const STEP_ROUND_LEN = 4;
const DIFFS = [
  { key: "easy", label: "Easy", sub: "÷ 2–7, quotient 11–19" },
  { key: "medium", label: "Medium", sub: "÷ 3–14, quotient 11–50" },
  { key: "hard", label: "Hard", sub: "÷ 7–24, quotient 11–100" },
  { key: "step", label: "Step-by-Step", sub: "Solve like on paper, digit by digit", step: true },
];

const LongDiv = () => {
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
      setQuestion(generateStepDivision({ difficulty: "medium" }));
    } else {
      setQuestion(generateLongDiv({ difficulty: diff }));
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
      setQuestion((q) => generateStepDivision({ difficulty: "medium", lastKey: q?.key }));
    } else {
      setQuestion((q) => generateLongDiv({ difficulty, lastKey: q?.key }));
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
    <div className="max-w-3xl mx-auto" data-testid="long-div-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2 flex items-center gap-2">
            <Divide size={22} className="text-rose-600" /> Long Division
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
        <div className="surface brut-border brut-shadow p-7" data-testid="long-div-brief">
          <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            Choose difficulty
          </div>
          <h2 className="text-xl font-bold tracking-tight text-fg mt-1">
            Choose how to practise
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
            {DIFFS.map((d) => (
              <button
                key={d.key}
                onClick={() => begin(d.key)}
                data-testid={`diff-${d.key}`}
                className={`brut-border brut-shadow p-4 text-left hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all ${
                  d.step ? "bg-rose-100 dark:bg-rose-500/15" : "surface"
                }`}
              >
                <div className="text-base font-bold text-fg">{d.label}</div>
                <div className="text-xs text-muted mt-0.5">{d.sub}</div>
                {d.step && (
                  <div className="text-[10px] uppercase tracking-widest text-rose-700 dark:text-rose-400 font-bold mt-2">
                    NEW · guided practice
                  </div>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted mt-4 font-mono">
            Tip: estimate first — e.g. 156 ÷ 12 ≈ 13 (since 12 × 13 = 156).
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
            <div
              className="surface brut-border brut-shadow p-5 sm:p-7"
              data-testid="step-play-card"
            >
              <StepDivision
                problem={question}
                onComplete={() => {
                  addCoinsAndXp(8, 12);
                  setCorrect((c) => c + 1);
                }}
                onWrong={() => {
                  recordAnswer({
                    a: question.dividend,
                    b: question.divisor,
                    op: "÷",
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
                hint={showHint ? `${question.a} ÷ ${question.b} = ${question.answer}` : null}
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
          data-testid="long-div-result"
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
              data-testid="long-div-again"
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

export default LongDiv;
