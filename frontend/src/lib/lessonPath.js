// ─────────────────────────────────────────────────────────────────────────
// Programmatically generate the entire 1000-lesson path.
// 67 levels × 15 lessons = 1005 lessons across 5 streams.
// Each level ramps difficulty within its topic; the final lesson of a level
// is the "unit boss". Levels are gated sequentially across the entire path.
// ─────────────────────────────────────────────────────────────────────────

const LESSONS_PER_LEVEL = 15;

// Streams describe the high-level "look" of each topic group. The order here
// is the order they're rendered in the path.
const STREAMS = [
  {
    topic: "multiplication", title: "Multiplication", op: "mul", isLong: false,
    accent: "bg-emerald-400", accentSoft: "bg-emerald-100 dark:bg-emerald-950/30",
    levels: 17,
  },
  {
    topic: "division", title: "Division", op: "div", isLong: false,
    accent: "bg-cyan-400", accentSoft: "bg-cyan-100 dark:bg-cyan-950/30",
    levels: 17,
  },
  {
    topic: "long_mul", title: "Long Multiplication", op: "mul", isLong: true,
    accent: "bg-violet-400", accentSoft: "bg-violet-100 dark:bg-violet-950/30",
    levels: 15,
  },
  {
    topic: "long_div", title: "Long Division", op: "div", isLong: true,
    accent: "bg-rose-400", accentSoft: "bg-rose-100 dark:bg-rose-950/30",
    levels: 15,
  },
  {
    topic: "mixed", title: "Mastery", op: "mixed", isLong: false,
    accent: "bg-amber-400", accentSoft: "bg-amber-100 dark:bg-amber-950/30",
    levels: 3,
  },
];

// Difficulty ramp: as the level number inside a stream grows, push harder.
function diffForLevel(stream, levelInStream) {
  // For short topics (1-12 ish), scale tables/factors.
  if (!stream.isLong && stream.topic !== "mixed") {
    const ratio = levelInStream / Math.max(1, stream.levels - 1); // 0..1
    if (ratio < 0.25) return { label: "Beginner", tables: [2, 3, 4, 5, 10], maxFactor: 10 };
    if (ratio < 0.5)  return { label: "Easy",     tables: [2, 3, 4, 5, 6, 7, 8, 9, 10], maxFactor: 12 };
    if (ratio < 0.75) return { label: "Medium",   tables: [3, 4, 6, 7, 8, 9, 11, 12], maxFactor: 14 };
    if (ratio < 0.9)  return { label: "Hard",     tables: [6, 7, 8, 9, 11, 12, 13, 14, 15, 16], maxFactor: 17 };
    return { label: "Expert", tables: [7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], maxFactor: 19 };
  }
  // Long mul/div: factors stay 11+, maxFactor scales.
  if (stream.isLong) {
    const ratio = levelInStream / Math.max(1, stream.levels - 1);
    if (ratio < 0.33) return { label: "Easy",   tables: [11, 12, 13, 14, 15], maxFactor: 19, isLong: true };
    if (ratio < 0.66) return { label: "Medium", tables: [12, 13, 14, 15, 16, 17, 18], maxFactor: 25, isLong: true };
    return { label: "Hard", tables: [13, 14, 15, 16, 17, 18, 19, 20, 22, 24], maxFactor: 30, isLong: true };
  }
  // Mixed mastery: hardest of everything, all four ops mixed.
  return { label: "Mastery", tables: [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19], maxFactor: 19 };
}

// Friendly title per level, e.g. "Multiplication · L1: ×2-5 (Beginner)".
function titleForLevel(stream, levelInStream, diff) {
  const base = `Level ${levelInStream + 1}`;
  const detail =
    stream.topic === "mixed"
      ? "All four operations"
      : stream.isLong
      ? `${diff.label} · 2-digit × ${stream.op === "div" ? "1-digit ÷" : "1-digit"}`
      : `×${diff.tables[0]}–${diff.tables[diff.tables.length - 1]}`;
  return { base, detail };
}

// Build the full path. Pure function — same output every call.
export function buildGiantPath() {
  const levels = [];
  let levelGlobalIdx = 0;
  STREAMS.forEach((stream) => {
    for (let li = 0; li < stream.levels; li++) {
      const diff = diffForLevel(stream, li);
      const t = titleForLevel(stream, li, diff);
      const lessonsArr = [];
      for (let lj = 0; lj < LESSONS_PER_LEVEL; lj++) {
        const isBoss = lj === LESSONS_PER_LEVEL - 1;
        lessonsArr.push({
          id: `L${levelGlobalIdx}_l${lj}`,
          label: isBoss ? "Unit boss" : `Lesson ${lj + 1}`,
          boss: isBoss,
          // Per-lesson params: keep it identical inside a level so the
          // pacing feels consistent. (Variation comes from the question
          // generator's randomness.)
          topic: stream.topic === "mixed" ? "mixed" : stream.topic,
          tables: diff.tables,
          maxFactor: diff.maxFactor,
          isLong: diff.isLong || stream.isLong,
          op: stream.op,
          difficultyLabel: diff.label,
        });
      }
      levels.push({
        id: `lvl_${levelGlobalIdx}`,
        idx: levelGlobalIdx,
        title: `${stream.title} · ${t.base}`,
        subtitle: `${t.detail} · ${diff.label}`,
        topic: stream.topic,
        accent: stream.accent,
        accentSoft: stream.accentSoft,
        lessons: lessonsArr,
        diff, // keep so test-out can sample identical questions
        stream,
      });
      levelGlobalIdx += 1;
    }
  });
  return levels;
}

// Flat array of every lesson across every level — used for sequential
// unlock checks.
export function flattenPath(path) {
  return path.flatMap((lv) => lv.lessons.map((l) => ({ ...l, levelIdx: lv.idx })));
}

export const TOTAL_LESSONS_TARGET = STREAMS.reduce(
  (acc, s) => acc + s.levels * LESSONS_PER_LEVEL,
  0
);
