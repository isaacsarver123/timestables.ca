import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, X, Divide, ArrowRight } from "lucide-react";
import Question from "@/components/Question";
import StepDivision from "@/components/StepDivision";
import RemainderDivision from "@/components/RemainderDivision";
import { recordAnswer, addCoinsAndXp, markCompletedActivityToday } from "@/lib/storage";
import { generateLongDiv, generateStepDivision, generateRemainderDiv } from "@/lib/game";
import { sfx } from "@/lib/sound";

const ROUND_LEN = 8;
const STEP_ROUND_LEN = 4;

const SECTIONS = [
  {
    key: "quick",
    title: "Quick",
    sub: "Type the final answer",
    levels: [
      { key: "easy", label: "Easy", sub: "÷ 2–7, q 11–19" },
      { key: "medium", label: "Medium", sub: "÷ 3–14, q 11–50" },
      { key: "hard", label: "Hard", sub: "÷ 7–24, q 11–100" },
    ],
  },
  {
    key: "step",
    title: "Step-by-Step",
    sub: "Solve digit by digit, paper-style",
    accent: "bg-rose-100 dark:bg-rose-500/15",
    levels: [
      { key: "easy", label: "Easy", sub: "÷ 3–7, 2-digit quotient" },
      { key: "medium", label: "Medium", sub: "÷ 6–23, 3-digit quotient" },
      { key: "hard", label: "Hard", sub: "÷ 12–71, 3-digit quotient" },
    ],
  },
  {
    key: "rem",
    title: "With Remainder",
    sub: "Quotient AND remainder",
    accent: "bg-amber-100 dark:bg-amber-500/15",
    levels: [
      { key: "easy", label: "Easy", sub: "÷ 3–8" },
      { key: "medium", label: "Medium", sub: "÷ 4–14" },
      { key: "hard", label: "Hard", sub: "÷ 7–24" },
    ],
  },
];

const FLAT = SECTIONS.flatMap((sec) =>
  sec.levels.map((l) => ({
    key: `${sec.key}-${l.key}`,
    section: sec.key,
    sectionTitle: sec.title,
    label: l.label,
    sub: l.sub,
    accent: sec.accent,
  }))
);

const LongDiv = () => {
  const navigate = useNavigate();
  const [phase, setPhase] = useState("brief");
  const [difficulty, setDifficulty] = useState("quick-medium");
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [question, setQuestion] = useState(null);
  const [value, setValue] = useState("");
  const [qVal, setQVal] = useState("");
  const [rVal, setRVal] = useState("");
  const [status, setStatus] = useState("idle");
  const [showHint, setShowHint] = useState(false);
  const startTs = useRef(performance.now());

  const meta = FLAT.find((d) => d.key === difficulty) || FLAT[1];
  const section = meta.section;
  const level = difficulty.split("-")[1];

  const isStep = section === "step";
  const isRem = section === "rem";
  const totalLen = isStep ? STEP_ROUND_LEN : ROUND_LEN;

  const newQuestion = (lastKey) => {
    if (isStep) return generateStepDivision({ difficulty: level, lastKey });
    if (isRem) return generateRemainderDiv({ difficulty: level, lastKey });
    return generateLongDiv({ difficulty: level, lastKey });
  };

  const begin = (key) => {
    setDifficulty(key);
    setIdx(0);
    setCorrect(0);
    const newSection = key.startsWith("step") ? "step" : key.startsWith("rem") ? "rem" : "quick";
    const newLevel = key.split("-")[1];
    if (newSection === "step")
      setQuestion(generateStepDivision({ difficulty: newLevel }));
    else if (newSection === "rem")
      setQuestion(generateRemainderDiv({ difficulty: newLevel }));
    else setQuestion(generateLongDiv({ difficulty: newLevel }));
    setValue("");
    setQVal("");
    setRVal("");
    setStatus("idle");
    setShowHint(false);
    setPhase("play");
    startTs.current = performance.now();
  };

  const next = () => {
    if (idx + 1 >= totalLen) {
      markCompletedActivityToday();
      setPhase("result");
      return;
    }
    setIdx((i) => i + 1);
    setQuestion((q) => newQuestion(q?.key));
    setValue("");
    setQVal("");
    setRVal("");
    setStatus("idle");
    setShowHint(false);
    startTs.current = performance.now();
  };

  const submitQuick = () => {
    if (status !== "idle" || !question) return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const ok = parseInt(value, 10) === question.answer;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct: ok, ms });
    if (ok) {
      const reward = level === "easy" ? 3 : level === "medium" ? 5 : 8;
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

  const submitRemainder = () => {
    if (status !== "idle" || !question) return;
    if (qVal === "" || rVal === "") return;
    const ms = Math.round(performance.now() - startTs.current);
    const ok =
      parseInt(qVal, 10) === question.answer.quotient &&
      parseInt(rVal, 10) === question.answer.remainder;
    recordAnswer({ a: question.a, b: question.b, op: "÷", correct: ok, ms });
    if (ok) {
      const reward = level === "easy" ? 4 : level === "medium" ? 6 : 9;
      addCoinsAndXp(reward, 10);
      sfx.correct();
      sfx.coin();
      setCorrect((c) => c + 1);
      setStatus("correct");
      setTimeout(next, 450);
    } else {
      sfx.wrong();
      setStatus("wrong");
      setShowHint(true);
      setTimeout(() => setStatus("idle"), 800);
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
        <div className="space-y-5" data-testid="long-div-brief">
          {SECTIONS.map((sec) => (
            <div key={sec.key} className={`brut-border p-4 ${sec.accent || "surface"}`}>
              <div className="mb-3">
                <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
                  {sec.sub}
                </div>
                <h3 className="text-lg font-bold tracking-tight text-fg">{sec.title}</h3>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {sec.levels.map((l) => (
                  <button
                    key={l.key}
                    onClick={() => begin(`${sec.key}-${l.key}`)}
                    data-testid={`diff-${sec.key}-${l.key}`}
                    className="brut-border brut-shadow-sm surface p-3 text-left hover:-translate-y-0.5 hover:brut-shadow active:translate-y-0.5 active:brut-shadow-none transition-all"
                  >
                    <div className="text-sm font-bold text-fg">{l.label}</div>
                    <div className="text-[11px] text-muted mt-0.5">{l.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {phase === "play" && question && (
        <>
          <div className="surface brut-border p-3 mb-4 flex items-center justify-between">
            <div className="text-sm text-fg font-semibold">
              {meta.sectionTitle} · {meta.label} ·{" "}
              <span className="font-mono">
                {idx + 1}/{totalLen}
              </span>
            </div>
            <div className="font-mono text-sm text-muted">
              Correct: <span className="text-fg font-bold">{correct}</span>
            </div>
          </div>

          {isStep ? (
            <div className="surface brut-border brut-shadow p-5 sm:p-7" data-testid="step-play-card">
              <StepDivision
                problem={question}
                onComplete={() => {
                  const reward = level === "easy" ? 5 : level === "medium" ? 8 : 12;
                  addCoinsAndXp(reward, 12);
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
          ) : isRem ? (
            <div
              className="surface brut-border brut-shadow p-5 sm:p-7"
              data-testid="remainder-card"
            >
              <RemainderDivision
                problem={question}
                onCorrect={() => {
                  const reward = level === "easy" ? 4 : level === "medium" ? 6 : 9;
                  addCoinsAndXp(reward, 10);
                  setCorrect((c) => c + 1);
                  recordAnswer({
                    a: question.a,
                    b: question.b,
                    op: "÷",
                    correct: true,
                    ms: 0,
                  });
                }}
                onWrong={() => {
                  recordAnswer({
                    a: question.a,
                    b: question.b,
                    op: "÷",
                    correct: false,
                    ms: 0,
                  });
                }}
              />
              <div className="mt-3 flex justify-end">
                <button
                  onClick={next}
                  data-testid="rem-next"
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
                onSubmit={submitQuick}
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
