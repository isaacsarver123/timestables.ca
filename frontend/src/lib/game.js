// Question generation utilities.

function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

// mulberry32 seeded RNG
export function seededRng(seed) {
  let t = seed >>> 0;
  return function () {
    t |= 0;
    t = (t + 0x6d2b79f5) | 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

// op: 'mul' | 'div' | 'mixed'
export function generateQuestion(selectedTables, opts = {}) {
  const {
    lastKey,
    maxFactor = 12,
    minFactor = 1,
    op = "mul",
    rng = Math.random,
  } = opts;
  const tables =
    selectedTables && selectedTables.length
      ? selectedTables
      : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  const r = () => rng();
  for (let i = 0; i < 25; i++) {
    const a = tables[randInt(r, 0, tables.length - 1)];
    const b = randInt(r, minFactor, maxFactor);
    const useMul = op === "mul" ? true : op === "div" ? false : r() < 0.5;
    const product = a * b;
    if (useMul) {
      const key = `m_${a}x${b}`;
      if (key === lastKey) continue;
      return { a, b, op: "×", prompt: `${a} × ${b}`, answer: product, key };
    }
    // division
    const key = `d_${product}÷${a}`;
    if (key === lastKey) continue;
    return {
      a: product,
      b: a,
      op: "÷",
      prompt: `${product} ÷ ${a}`,
      answer: b,
      key,
    };
  }
  // fallback
  const a = tables[0];
  const b = randInt(r, minFactor, maxFactor);
  return { a, b, op: "×", prompt: `${a} × ${b}`, answer: a * b, key: `m_${a}x${b}_f` };
}

// Boss level config. Scales tables, max factor, time.
export function bossConfig(level) {
  const baseTables = [2, 3];
  const extra = [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const tables = [...baseTables, ...extra.slice(0, Math.min(level, extra.length))];
  const maxFactor = Math.min(6 + level, 12);
  const questions = 8 + Math.min(level, 7);
  const timePerQ = Math.max(8 - Math.floor(level / 2), 4);
  const reward = 50 + level * 25;
  return { tables, maxFactor, questions, timePerQ, reward };
}

export function bossName(level) {
  const names = [
    "Sentinel of Twos",
    "Keeper of Threes",
    "Guardian of Fours",
    "Warden of Fives",
    "Hex of Sixes",
    "Shade of Sevens",
    "Octa Prime",
    "Nine Phantom",
    "Decimator",
    "Eleven Wraith",
    "Dozen Overlord",
    "Triskaideka",
    "Fourteen Husk",
    "Quindecim",
  ];
  return names[(level - 1) % names.length];
}

// Daily challenge: deterministic 30 questions
export function dailyQuestions(count = 30, op = "mixed") {
  const rng = seededRng(todaySeed());
  const tables = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const list = [];
  let last = null;
  for (let i = 0; i < count; i++) {
    const q = generateQuestion(tables, {
      rng,
      maxFactor: 12,
      minFactor: 2,
      op,
      lastKey: last,
    });
    last = q.key;
    list.push(q);
  }
  return list;
}

// Tips per table for Learn mode
export function tableTips(n) {
  const tips = {
    1: ["Identity. Anything × 1 = itself."],
    2: ["Doubles. 2×n = n + n.", "Always even."],
    3: ["3×n = 2×n + n.", "Sum of digits is divisible by 3."],
    4: ["Double, then double again.", "Always even."],
    5: ["Always ends in 0 or 5.", "Half of 10×n."],
    6: ["6×n = 5×n + n.", "Even × any."],
    7: ["No simple pattern — drill it.", "7×7 = 49 (anchor)."],
    8: ["Triple-double: 2 × 2 × 2 × n.", "8×n = 10×n − 2×n."],
    9: ["Digits sum to 9 (up to 9×10).", "9×n = 10×n − n."],
    10: ["Just append a 0."],
    11: ["For n<10: write n twice (e.g. 11×4 = 44)."],
    12: ["12×n = 10×n + 2×n."],
    13: ["13×n = 10×n + 3×n."],
    14: ["14×n = 10×n + 4×n.", "Or 7×n × 2."],
    15: ["15×n = 10×n + 5×n.", "Or 1.5 × 10 × n."],
    16: ["16×n = 10×n + 6×n.", "Or double 8×n."],
    17: ["17×n = 10×n + 7×n.", "No clean shortcut — repetition wins."],
    18: ["18×n = 20×n − 2×n.", "Or 9×n × 2."],
    19: ["19×n = 20×n − n."],
    20: ["20×n = 2×n × 10.", "Just append a 0 to 2×n."],
  };
  return tips[n] || ["Practise repeats until automatic."];
}
