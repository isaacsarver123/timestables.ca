import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Play, Layers, ListChecks, Hash, BookText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  tableTips,
  generateQuestion,
  flashcardSet,
  generateChoices,
  generateSkipCounting,
} from "@/lib/game";
import Question from "@/components/Question";
import CorrectPulse from "@/components/CorrectPulse";
import { recordAnswer, addCoinsAndXp } from "@/lib/storage";
import { sfx } from "@/lib/sound";

const ALL = Array.from({ length: 20 }, (_, i) => i + 1);
const ROWS = Array.from({ length: 12 }, (_, i) => i + 1);
const DRILL_LEN = 10;

const TABS = [
  { key: "table", label: "Table", Icon: BookText },
  { key: "flash", label: "Flashcards", Icon: Layers },
  { key: "choices", label: "Multiple Choice", Icon: ListChecks },
  { key: "skip", label: "Skip Count", Icon: Hash },
  { key: "drill", label: "Drill", Icon: Play },
];

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

const Learn = () => {
  const [tables, setTables] = useState([7]);
  const [tab, setTab] = useState("table");

  const toggle = (n) => {
    setTables((cur) => {
      const next = cur.includes(n) ? cur.filter((x) => x !== n) : [...cur, n];
      if (next.length === 0) return cur; // require at least one
      return next.sort((a, b) => a - b);
    });
  };

  const setOne = (n) => setTables([n]);

  return (
    <div className="space-y-6" data-testid="learn-page">
      <div>
        <Link
          to="/"
          className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
          data-testid="back-link"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2">Learn</h1>
        <p className="text-sm text-muted mt-1">
          Pick one or more tables, then study them your way. Mixing tables makes drills harder.
        </p>
      </div>

      {/* Table picker */}
      <div className="surface brut-border p-4">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
            Pick tables (1–20) — tap to toggle, hold-pick a single by selecting just one
          </div>
          <div className="text-xs font-mono text-muted">
            {tables.length} selected
          </div>
        </div>
        <div className="grid grid-cols-10 gap-1.5 sm:gap-2" data-testid="learn-table-picker">
          {ALL.map((x) => (
            <button
              key={x}
              onClick={() => toggle(x)}
              onDoubleClick={() => setOne(x)}
              data-testid={`learn-pick-${x}`}
              title="Click to toggle · double-click to select only this"
              className={`aspect-square brut-border font-mono text-sm sm:text-base font-bold grid place-items-center transition-all ${
                tables.includes(x) ? "bg-blue-600 text-white" : "surface text-fg hover:surface-2"
              }`}
            >
              {x}
            </button>
          ))}
        </div>
      </div>

      {/* Method tabs */}
      <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1" data-testid="learn-tabs">
        {TABS.map((t) => {
          const Icon = t.Icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`whitespace-nowrap brut-border px-3 py-2 text-xs sm:text-sm font-bold flex items-center gap-2 transition-colors ${
                active
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                  : "surface text-fg hover:surface-2"
              }`}
            >
              <Icon size={14} />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={`${tab}-${tables.join(",")}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.16 }}
        >
          {tab === "table" && <TableView tables={tables} />}
          {tab === "flash" && <FlashView tables={tables} />}
          {tab === "choices" && <ChoicesView tables={tables} />}
          {tab === "skip" && <SkipView tables={tables} />}
          {tab === "drill" && <DrillView tables={tables} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ───────── Table view (with tips for every selected table) ─────────
const TableView = ({ tables }) => {
  if (tables.length === 1) {
    const n = tables[0];
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SingleTable n={n} />
        <SingleTips n={n} />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {tables.map((n) => (
          <SingleTable key={n} n={n} compact />
        ))}
      </div>
      <div className="surface brut-border p-5">
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
          Tips for {tables.length} tables
        </div>
        <div className="mt-3 divide-y divide-zinc-200 dark:divide-zinc-800">
          {tables.map((n) => (
            <div key={n} className="py-3 first:pt-0 last:pb-0">
              <div className="font-mono font-black text-xl text-fg mb-2">×{n}</div>
              <ul className="space-y-1.5">
                {tableTips(n).map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-fg">
                    <span className="font-mono text-blue-600 font-bold mt-0.5">→</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const SingleTable = ({ n, compact = false }) => (
  <div className="surface brut-border p-5" data-testid={`learn-table-list-${n}`}>
    <div className="flex items-baseline gap-3 mb-3">
      <div className={`font-mono font-black ${compact ? "text-2xl" : "text-4xl"} text-fg`}>×{n}</div>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">table</div>
    </div>
    <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2"} gap-1.5`}>
      {ROWS.map((r) => (
        <div
          key={r}
          className="brut-border-soft px-3 py-1.5 flex items-center justify-between font-mono text-fg"
        >
          <span className="text-sm">
            {r} × {n}
          </span>
          <span className="text-base font-bold tabular-nums">{r * n}</span>
        </div>
      ))}
    </div>
  </div>
);

const SingleTips = ({ n }) => (
  <div className="surface brut-border p-5" data-testid="learn-tips">
    <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
      Tips for ×{n}
    </div>
    <ul className="mt-3 space-y-2.5">
      {tableTips(n).map((t, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-fg">
          <span className="font-mono text-blue-600 font-bold mt-0.5">→</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  </div>
);

// ───────── Flashcards (with 3D flip animation) ─────────
const FlashView = ({ tables }) => {
  const [cards, setCards] = useState(() => flashcardSet(tables));
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [knew, setKnew] = useState(0);
  const [missed, setMissed] = useState(0);
  const done = idx >= cards.length;

  useEffect(() => {
    setCards(flashcardSet(tables));
    setIdx(0);
    setFlipped(false);
    setKnew(0);
    setMissed(0);
  }, [tables]);

  const card = cards[idx];

  const mark = (knownIt) => {
    if (knownIt) {
      setKnew((k) => k + 1);
      addCoinsAndXp(1, 2);
      sfx.coin();
    } else {
      setMissed((m) => m + 1);
    }
    setIdx((i) => i + 1);
    setFlipped(false);
  };

  const restart = () => {
    setCards(flashcardSet(tables));
    setIdx(0);
    setFlipped(false);
    setKnew(0);
    setMissed(0);
  };

  if (done) {
    return (
      <div className="surface brut-border brut-shadow p-7 text-center" data-testid="flash-done">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Set complete
        </div>
        <h2 className="text-4xl font-black tracking-tighter mt-1 text-fg">
          {knew}
          <span className="text-muted">/{cards.length}</span>
        </h2>
        <p className="text-sm text-muted mt-2">
          Knew: {knew} · Missed: {missed}
        </p>
        <button
          onClick={restart}
          data-testid="flash-restart"
          className="mt-6 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
        >
          Shuffle again
        </button>
      </div>
    );
  }

  return (
    <div data-testid="flash-view">
      <div className="flex items-center justify-between mb-4 text-sm font-mono">
        <span className="text-fg font-bold">
          Card {idx + 1} / {cards.length}
        </span>
        <span className="text-muted">
          Knew: <span className="text-fg font-bold">{knew}</span> · Missed:{" "}
          <span className="text-fg font-bold">{missed}</span>
        </span>
      </div>

      {/* 3D flip card */}
      <div
        className="w-full"
        style={{ perspective: "1200px" }}
        onClick={() => setFlipped((f) => !f)}
        data-testid="flash-card"
      >
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ transformStyle: "preserve-3d" }}
          className="relative w-full cursor-pointer"
        >
          {/* Front */}
          <div
            style={{ backfaceVisibility: "hidden" }}
            className="surface brut-border brut-shadow-lg p-10 sm:p-14 text-center"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">
              Front
            </div>
            <div className="font-mono font-black text-6xl sm:text-7xl text-fg" data-testid="flash-front">
              {card.front}
            </div>
            <div className="mt-6 text-xs text-muted font-mono">tap to flip</div>
          </div>
          {/* Back (rotated 180° behind the front) */}
          <div
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            className="surface brut-border brut-shadow-lg p-10 sm:p-14 text-center bg-amber-50 dark:bg-amber-500/15"
          >
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">
              Answer
            </div>
            <div className="font-mono font-black text-6xl sm:text-7xl text-fg" data-testid="flash-back">
              {card.back}
            </div>
            <div className="mt-6 text-xs text-muted font-mono">tap to hide</div>
          </div>
        </motion.div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <button
          onClick={() => mark(false)}
          data-testid="flash-missed"
          className="brut-border brut-shadow-sm p-3 bg-rose-500 text-white font-bold uppercase tracking-wider text-sm hover:bg-rose-600 hover:-translate-y-0.5 active:translate-y-0.5 active:brut-shadow-none transition-all"
        >
          Missed it
        </button>
        <button
          onClick={() => mark(true)}
          data-testid="flash-knew"
          className="brut-border brut-shadow-sm p-3 bg-emerald-500 text-white font-bold uppercase tracking-wider text-sm hover:bg-emerald-600 hover:-translate-y-0.5 active:translate-y-0.5 active:brut-shadow-none transition-all"
        >
          Knew it
        </button>
      </div>
    </div>
  );
};

// ───────── Multiple choice (across all selected tables) ─────────
const ChoicesView = ({ tables }) => {
  const buildRound = () => {
    const q = generateQuestion(tables, { maxFactor: 12, minFactor: 1, op: "mul" });
    return { q, choices: generateChoices(q, 4) };
  };
  const [round, setRound] = useState(buildRound);
  const [picked, setPicked] = useState(null);
  const [score, setScore] = useState(0);
  const [count, setCount] = useState(0);
  const [pickedCorrect, setPickedCorrect] = useState(false);

  useEffect(() => {
    setRound(buildRound());
    setPicked(null);
    setScore(0);
    setCount(0);
    setPickedCorrect(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  const choose = (c) => {
    if (picked != null) return;
    const correct = c === round.q.answer;
    setPicked(c);
    setPickedCorrect(correct);
    if (correct) {
      sfx.correct();
      sfx.coin();
      addCoinsAndXp(1, 3);
      setScore((s) => s + 1);
    } else {
      sfx.wrong();
    }
    recordAnswer({ a: round.q.a, b: round.q.b, op: round.q.op, correct, ms: 0 });
    setCount((c2) => c2 + 1);
    setTimeout(() => {
      setRound(buildRound());
      setPicked(null);
      setPickedCorrect(false);
    }, 800);
  };

  return (
    <div className="surface brut-border brut-shadow p-6 sm:p-8 relative" data-testid="choices-view">
      <CorrectPulse show={pickedCorrect} />
      <div className="flex items-center justify-between mb-4 text-sm font-mono">
        <span className="text-muted">
          {tables.length === 1 ? `×${tables[0]}` : `${tables.length} tables`} · Multiple choice
        </span>
        <span className="text-fg font-bold">
          {score}/{count}
        </span>
      </div>
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-2">
          Pick the answer
        </div>
        <div className="font-mono font-black text-5xl sm:text-6xl text-fg">
          {round.q.prompt} <span className="opacity-30">=</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mt-7" data-testid="choices-grid">
        {round.choices.map((c) => {
          const isPicked = picked === c;
          const isCorrect = round.q.answer === c;
          let style = "surface text-fg hover:surface-2";
          if (picked != null && isCorrect) style = "bg-emerald-500 text-white";
          else if (isPicked && !isCorrect) style = "bg-red-500 text-white";
          const animate =
            picked != null && isCorrect
              ? { scale: [1, 1.18, 1], rotate: [0, -2, 2, 0] }
              : { scale: 1 };
          return (
            <motion.button
              key={c}
              onClick={() => choose(c)}
              data-testid={`choice-${c}`}
              disabled={picked != null}
              animate={animate}
              transition={{ duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
              className={`brut-border brut-shadow-sm py-5 sm:py-6 font-mono text-3xl sm:text-4xl font-bold transition-colors ${style}`}
            >
              {c}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

// ───────── Skip-counting (random table from selection per round) ─────────
const SkipView = ({ tables }) => {
  const buildRound = () => {
    const t = pickRandom(tables);
    return generateSkipCounting(t);
  };
  const [round, setRound] = useState(buildRound);
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [score, setScore] = useState(0);
  const [count, setCount] = useState(0);

  useEffect(() => {
    setRound(buildRound());
    setValue("");
    setStatus("idle");
    setScore(0);
    setCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  const submit = () => {
    if (status !== "idle") return;
    if (value === "") return;
    const correct = parseInt(value, 10) === round.answer;
    if (correct) {
      sfx.correct();
      sfx.coin();
      addCoinsAndXp(1, 3);
      setScore((s) => s + 1);
      setStatus("correct");
    } else {
      sfx.wrong();
      setStatus("wrong");
    }
    setCount((c) => c + 1);
    setTimeout(() => {
      setRound(buildRound());
      setValue("");
      setStatus("idle");
    }, 700);
  };

  return (
    <div className="surface brut-border brut-shadow p-6 sm:p-8 relative" data-testid="skip-view">
      <CorrectPulse show={status === "correct"} />
      <div className="flex items-center justify-between mb-4 text-sm font-mono">
        <span className="text-muted">
          Count by {round.table}
          {tables.length > 1 ? ` (random from ${tables.length} tables)` : ""}
        </span>
        <span className="text-fg font-bold">
          {score}/{count}
        </span>
      </div>
      <div
        className="flex flex-wrap items-center justify-center gap-2 sm:gap-3"
        data-testid="skip-sequence"
      >
        {round.seq.map((v, i) => {
          const blank = i === round.blank;
          if (blank) {
            return (
              <motion.input
                key={i}
                value={value}
                onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submit();
                }}
                disabled={status !== "idle"}
                placeholder="?"
                data-testid="skip-input"
                autoFocus
                animate={
                  status === "correct"
                    ? { scale: [1, 1.2, 1] }
                    : status === "wrong"
                    ? { x: [-6, 6, -4, 4, 0] }
                    : { scale: 1 }
                }
                transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
                className={`brut-border surface w-20 sm:w-24 font-mono text-3xl sm:text-4xl font-bold text-center py-2 placeholder:opacity-30 text-fg focus:outline-none focus:ring-2 focus:ring-blue-500/40 transition-colors ${
                  status === "correct"
                    ? "bg-emerald-500 text-white border-emerald-700"
                    : status === "wrong"
                    ? "bg-red-100 border-red-700"
                    : ""
                }`}
              />
            );
          }
          return (
            <div
              key={i}
              className="brut-border-soft px-3 py-2 sm:px-4 sm:py-3 font-mono text-2xl sm:text-3xl font-bold tabular-nums text-fg"
            >
              {v}
            </div>
          );
        })}
      </div>
      <div className="mt-6 text-center">
        <button
          onClick={submit}
          data-testid="skip-submit"
          className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold text-sm px-6 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider"
        >
          Check ↵
        </button>
      </div>
    </div>
  );
};

// ───────── Drill (across all selected) ─────────
const DrillView = ({ tables }) => {
  const [running, setRunning] = useState(true);
  const [idx, setIdx] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [question, setQuestion] = useState(() =>
    generateQuestion(tables, { maxFactor: 12, minFactor: 1, op: "mul" })
  );
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("idle");
  const [showHint, setShowHint] = useState(false);
  const startTs = useRef(performance.now());

  useEffect(() => {
    setRunning(true);
    setIdx(0);
    setCorrect(0);
    setQuestion(generateQuestion(tables, { maxFactor: 12, minFactor: 1, op: "mul" }));
    setValue("");
    setStatus("idle");
    setShowHint(false);
    startTs.current = performance.now();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(",")]);

  const next = () => {
    if (idx + 1 >= DRILL_LEN) {
      setRunning(false);
      return;
    }
    setIdx((i) => i + 1);
    setQuestion((q) =>
      generateQuestion(tables, { lastKey: q.key, maxFactor: 12, minFactor: 1, op: "mul" })
    );
    setValue("");
    setStatus("idle");
    setShowHint(false);
    startTs.current = performance.now();
  };

  const submit = () => {
    if (status !== "idle") return;
    if (value === "") return;
    const ms = Math.round(performance.now() - startTs.current);
    const ok = parseInt(value, 10) === question.answer;
    recordAnswer({ a: question.a, b: question.b, op: question.op, correct: ok, ms });
    if (ok) {
      addCoinsAndXp(1, 4);
      sfx.correct();
      sfx.coin();
      setCorrect((c) => c + 1);
      setStatus("correct");
      setTimeout(next, 350);
    } else {
      sfx.wrong();
      setStatus("wrong");
      setShowHint(true);
      setTimeout(() => setStatus("idle"), 600);
    }
  };

  if (!running) {
    return (
      <div className="surface brut-border brut-shadow p-7 text-center" data-testid="drill-results">
        <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Drill complete
        </div>
        <h2 className="text-4xl font-black tracking-tighter mt-1 text-fg">
          {correct}
          <span className="text-muted">/{DRILL_LEN}</span>
        </h2>
        <button
          onClick={() => {
            setRunning(true);
            setIdx(0);
            setCorrect(0);
            setQuestion(
              generateQuestion(tables, { maxFactor: 12, minFactor: 1, op: "mul" })
            );
            setValue("");
            setStatus("idle");
            setShowHint(false);
          }}
          data-testid="drill-restart"
          className="mt-5 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all uppercase tracking-wider text-sm"
        >
          Drill again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="drill-active">
      <div className="surface brut-border p-3 flex items-center justify-between">
        <div className="text-sm text-fg font-semibold">
          Drill {tables.length === 1 ? `×${tables[0]}` : `${tables.length} tables`} ·{" "}
          <span className="font-mono">
            {idx + 1}/{DRILL_LEN}
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
    </div>
  );
};

export default Learn;
