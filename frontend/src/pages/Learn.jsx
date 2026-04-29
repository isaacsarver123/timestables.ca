import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Play } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { tableTips, generateQuestion } from "@/lib/game";
import Question from "@/components/Question";
import { recordAnswer, addCoinsAndXp } from "@/lib/storage";
import { sfx } from "@/lib/sound";

const TABLES = Array.from({ length: 20 }, (_, i) => i + 1);
const ROWS = Array.from({ length: 12 }, (_, i) => i + 1);

const DRILL_LEN = 10;

const Learn = () => {
  const [n, setN] = useState(7);
  const [drillOn, setDrillOn] = useState(false);
  const [drillIdx, setDrillIdx] = useState(0);
  const [drillCorrect, setDrillCorrect] = useState(0);
  const [question, setQuestion] = useState(null);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [showHint, setShowHint] = useState(false);
  const startTs = useRef(performance.now());

  const tips = tableTips(n);

  useEffect(() => {
    if (drillOn) {
      setQuestion(generateQuestion([n], { maxFactor: 12, minFactor: 1, op: "mul" }));
      setValue("");
      setStatus("idle");
      setShowHint(false);
      startTs.current = performance.now();
    }
  }, [drillOn, n]);

  const startDrill = () => {
    setDrillIdx(0);
    setDrillCorrect(0);
    setDrillOn(true);
  };
  const exitDrill = () => setDrillOn(false);

  const nextQ = () => {
    if (drillIdx + 1 >= DRILL_LEN) {
      setDrillOn(false);
      return;
    }
    setDrillIdx((i) => i + 1);
    setQuestion((q) =>
      generateQuestion([n], { lastKey: q?.key, maxFactor: 12, minFactor: 1, op: "mul" })
    );
    setValue("");
    setStatus("idle");
    setShowHint(false);
    startTs.current = performance.now();
  };

  const submit = () => {
    if (status !== "idle") return;
    if (value === "" || value === "-") return;
    const ms = Math.round(performance.now() - startTs.current);
    const correct = parseInt(value, 10) === question.answer;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct, ms });
    if (correct) {
      addCoinsAndXp(1, 4);
      sfx.correct();
      sfx.coin();
      setDrillCorrect((c) => c + 1);
      setStatus("correct");
      setTimeout(nextQ, 350);
    } else {
      setStatus("wrong");
      sfx.wrong();
      setShowHint(true);
      setTimeout(() => setStatus("idle"), 600);
    }
  };

  return (
    <div className="space-y-7" data-testid="learn-page">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link
            to="/"
            className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
            data-testid="back-link"
          >
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2">Learn</h1>
          <p className="text-sm text-muted mt-1">Pick a table to study, then drill it.</p>
        </div>
      </div>

      {/* Table picker */}
      <div className="surface brut-border p-4">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium mb-3">
          Pick a table (1–20)
        </div>
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2" data-testid="learn-table-picker">
          {TABLES.map((x) => (
            <button
              key={x}
              onClick={() => {
                setN(x);
                setDrillOn(false);
              }}
              data-testid={`learn-pick-${x}`}
              className={`aspect-square brut-border font-mono text-sm sm:text-base font-bold grid place-items-center transition-all ${
                x === n ? "bg-blue-600 text-white" : "surface text-fg hover:surface-2"
              }`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!drillOn && (
          <motion.div
            key={`learn-${n}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {/* Table list */}
            <div className="surface brut-border p-5" data-testid="learn-table-list">
              <div className="flex items-baseline gap-3 mb-4">
                <div className="font-mono font-black text-4xl text-fg">×{n}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
                  table
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {ROWS.map((r) => (
                  <div
                    key={r}
                    className="brut-border-soft px-3 py-2 flex items-center justify-between font-mono text-fg"
                  >
                    <span className="text-sm">
                      {r} × {n}
                    </span>
                    <span className="text-base font-bold tabular-nums">{r * n}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tips + drill CTA */}
            <div className="space-y-3">
              <div className="surface brut-border p-5" data-testid="learn-tips">
                <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
                  Tips for ×{n}
                </div>
                <ul className="mt-3 space-y-2.5">
                  {tips.map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-fg">
                      <span className="font-mono text-blue-600 font-bold">→</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={startDrill}
                data-testid="start-drill"
                className="w-full surface brut-border brut-shadow p-5 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:brut-shadow-lg transition-all flex items-center gap-3 text-left text-fg"
              >
                <div className="w-11 h-11 brut-border bg-blue-600 text-white grid place-items-center">
                  <Play size={20} strokeWidth={2.5} />
                </div>
                <div className="flex-1">
                  <div className="text-base font-bold">Drill ×{n}</div>
                  <div className="text-xs text-muted">
                    {DRILL_LEN} questions · 1×{n} through 12×{n}
                  </div>
                </div>
                <ArrowRight size={16} className="text-muted" />
              </button>
            </div>
          </motion.div>
        )}

        {drillOn && question && (
          <motion.div
            key="drill"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="space-y-4"
            data-testid="drill-active"
          >
            <div className="surface brut-border p-3 flex items-center justify-between">
              <div className="text-sm text-fg font-semibold">
                Drill ×{n} ·{" "}
                <span className="font-mono">
                  {drillIdx + 1}/{DRILL_LEN}
                </span>
              </div>
              <div className="font-mono text-sm text-muted">
                Correct: {drillCorrect}
              </div>
              <button
                onClick={exitDrill}
                data-testid="exit-drill"
                className="brut-border-soft surface px-3 py-1 text-xs font-semibold uppercase tracking-widest hover:surface-2 text-fg"
              >
                Stop
              </button>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Learn;
