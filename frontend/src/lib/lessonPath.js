// ─────────────────────────────────────────────────────────────────────────
// Programmatically generate the entire 1000-lesson path.
// 67 levels × 15 lessons = 1005 lessons across 5 streams.
// Difficulty is a CONTINUOUS function of (stream, levelInStream): every
// level index meaningfully ramps the question pool — table count grows,
// max factor grows, long-form magnitudes grow. So lesson #1005 is
// dramatically harder than lesson #1.
// ─────────────────────────────────────────────────────────────────────────

const LESSONS_PER_LEVEL = 15;

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

const DIFF_BAND = ["Beginner", "Easy", "Easy+", "Medium", "Medium+", "Hard", "Hard+", "Expert", "Master"];

// Pick a difficulty band by ratio (0..1) through the stream.
function bandFor(ratio) {
  const idx = Math.min(DIFF_BAND.length - 1, Math.floor(ratio * DIFF_BAND.length));
  return DIFF_BAND[idx];
}

// Build the table list for short-form mul/div at a given level index.
// Level 0 starts with just {2, 5, 10}. Each level adds one more table from a
// canonical "next-table-to-introduce" list, eventually covering 2-19.
const SHORT_TABLE_INTRO = [2, 5, 10, 3, 4, 6, 9, 11, 12, 7, 8, 13, 14, 15, 16, 17, 18, 19];

function shortDiffFor(levelInStream, totalLevels) {
  // tables: introduce one new table every level, capped at the full list.
  const count = Math.min(SHORT_TABLE_INTRO.length, 3 + levelInStream);
  const tables = SHORT_TABLE_INTRO.slice(0, count).sort((a, b) => a - b);
  // maxFactor: ramps from 5 → 20 over the stream.
  const ratio = levelInStream / Math.max(1, totalLevels - 1);
  const maxFactor = Math.round(5 + ratio * 15); // 5..20
  return {
    label: bandFor(ratio),
    tables,
    maxFactor,
    minFactor: levelInStream < 2 ? 1 : 2,
    isLong: false,
  };
}

// Long-form generators ramp factor-magnitude. Level 0 = 11 × 2-9. Level 14 =
// 25 × 25 with 3-digit results.
function longDiffFor(levelInStream, totalLevels) {
  const ratio = levelInStream / Math.max(1, totalLevels - 1);
  // factor lists grow: start with [11..15], end with [13..30].
  const lo = 11 + Math.floor(ratio * 2); // 11..13
  const hi = 15 + Math.floor(ratio * 15); // 15..30
  const tables = [];
  for (let n = lo; n <= Math.min(20, hi); n++) tables.push(n);
  const maxFactor = Math.round(9 + ratio * 21); // 9..30
  return {
    label: bandFor(ratio),
    tables,
    maxFactor,
    minFactor: 11,
    isLong: true,
  };
}

// Mastery: hardest of everything, all four ops mixed.
function mixedDiffFor(levelInStream, totalLevels) {
  const ratio = levelInStream / Math.max(1, totalLevels - 1);
  const tables = [6, 7, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const maxFactor = Math.round(15 + ratio * 10); // 15..25
  return {
    label: ratio < 0.5 ? "Master" : "Grand Master",
    tables,
    maxFactor,
    minFactor: 2,
    isLong: false,
  };
}

function diffForLevel(stream, levelInStream) {
  if (stream.topic === "mixed") return mixedDiffFor(levelInStream, stream.levels);
  if (stream.isLong)            return longDiffFor(levelInStream, stream.levels);
  return shortDiffFor(levelInStream, stream.levels);
}

function titleForLevel(stream, levelInStream, diff) {
  const base = `Level ${levelInStream + 1}`;
  let detail;
  if (stream.topic === "mixed") {
    detail = `All four operations · factors ≤ ${diff.maxFactor}`;
  } else if (stream.isLong) {
    detail = `${diff.tables[0]}–${diff.tables[diff.tables.length - 1]} × factor ≤ ${diff.maxFactor}`;
  } else {
    detail = `×${diff.tables.join(", ×")} · factor ≤ ${diff.maxFactor}`;
    // If the table list is long, just show the bookends.
    if (diff.tables.length > 5) {
      detail = `×${diff.tables[0]}–${diff.tables[diff.tables.length - 1]} (${diff.tables.length} tables) · factor ≤ ${diff.maxFactor}`;
    }
  }
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
        // Per-lesson micro-ramp: lessons later in the level use a slightly
        // tighter table subset / higher minFactor than earlier ones, so even
        // within a level there's a small ramp. The unit boss uses the full
        // hardest spec.
        const lessonRatio = lj / (LESSONS_PER_LEVEL - 1); // 0..1
        const minFactor = Math.max(diff.minFactor, Math.round(diff.minFactor + lessonRatio * 2));
        const maxFactor = Math.round(diff.maxFactor - (1 - lessonRatio) * 2);
        lessonsArr.push({
          id: `L${levelGlobalIdx}_l${lj}`,
          label: isBoss ? "Unit boss" : `Lesson ${lj + 1}`,
          boss: isBoss,
          topic: stream.topic === "mixed" ? "mixed" : stream.topic,
          tables: diff.tables,
          minFactor,
          maxFactor: Math.max(maxFactor, minFactor + 2),
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
        diff,
        stream,
      });
      levelGlobalIdx += 1;
    }
  });
  return levels;
}

export function flattenPath(path) {
  return path.flatMap((lv) => lv.lessons.map((l) => ({ ...l, levelIdx: lv.idx })));
}

export const TOTAL_LESSONS_TARGET = STREAMS.reduce(
  (acc, s) => acc + s.levels * LESSONS_PER_LEVEL,
  0
);
