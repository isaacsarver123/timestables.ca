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

// Long-form (multi-digit) generators
export function generateLongMul(opts = {}) {
  const { rng = Math.random, lastKey, difficulty = "medium" } = opts;
  // easy: 2x1 (10-25 × 2-9). medium: 2x2 (10-99 × 10-99). hard: 3x2.
  for (let i = 0; i < 30; i++) {
    let a, b;
    if (difficulty === "easy") {
      a = Math.floor(rng() * 16) + 10; // 10-25
      b = Math.floor(rng() * 8) + 2; // 2-9
    } else if (difficulty === "hard") {
      a = Math.floor(rng() * 900) + 100; // 100-999
      b = Math.floor(rng() * 90) + 10; // 10-99
    } else {
      a = Math.floor(rng() * 90) + 10; // 10-99
      b = Math.floor(rng() * 90) + 10; // 10-99
    }
    const key = `lm_${a}x${b}`;
    if (key !== lastKey) {
      return { a, b, op: "×", prompt: `${a} × ${b}`, answer: a * b, key };
    }
  }
  return { a: 12, b: 13, op: "×", prompt: "12 × 13", answer: 156, key: "lm_12x13_f" };
}

export function generateLongDiv(opts = {}) {
  const { rng = Math.random, lastKey, difficulty = "medium" } = opts;
  for (let i = 0; i < 30; i++) {
    let divisor, quotient;
    if (difficulty === "easy") {
      divisor = Math.floor(rng() * 6) + 2; // 2-7
      quotient = Math.floor(rng() * 9) + 11; // 11-19
    } else if (difficulty === "hard") {
      divisor = Math.floor(rng() * 18) + 7; // 7-24
      quotient = Math.floor(rng() * 90) + 11; // 11-100
    } else {
      divisor = Math.floor(rng() * 12) + 3; // 3-14
      quotient = Math.floor(rng() * 40) + 11; // 11-50
    }
    const dividend = divisor * quotient;
    const key = `ld_${dividend}/${divisor}`;
    if (key !== lastKey) {
      return {
        a: dividend,
        b: divisor,
        op: "÷",
        prompt: `${dividend} ÷ ${divisor}`,
        answer: quotient,
        key,
      };
    }
  }
  return { a: 144, b: 12, op: "÷", prompt: "144 ÷ 12", answer: 12, key: "ld_144/12_f" };
}

// Multiple choice options for a given question (Learn mode)
export function generateChoices(question, count = 4, rng = Math.random) {
  const correct = question.answer;
  const set = new Set([correct]);
  let guard = 0;
  while (set.size < count && guard++ < 50) {
    let delta = Math.floor(rng() * 21) - 10; // -10..10
    if (delta === 0) delta = 1;
    const c = correct + delta;
    if (c > 0 && c !== correct) set.add(c);
  }
  const arr = Array.from(set);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Skip-counting fill-in: produce a sequence of multiples of `table` with one blank
export function generateSkipCounting(table, opts = {}) {
  const { rng = Math.random, length = 6 } = opts;
  const start = Math.floor(rng() * 7) + 1; // 1..7
  const seq = [];
  for (let i = 0; i < length; i++) seq.push((start + i) * table);
  const blank = Math.floor(rng() * (length - 2)) + 1;
  return {
    table,
    seq,
    blank,
    answer: seq[blank],
    key: `sc_${table}_${start}_${blank}_${length}`,
  };
}

// Build a flashcard deck for a single table OR a list of tables.
// Cards are shuffled when multiple tables are provided.
export function flashcardSet(input) {
  const tables = Array.isArray(input) ? input : [input];
  const cards = [];
  tables.forEach((table) => {
    for (let k = 1; k <= 12; k++) {
      cards.push({
        front: `${k} × ${table}`,
        back: String(k * table),
        key: `fc_${table}_${k}`,
        a: k,
        b: table,
        answer: k * table,
      });
    }
  });
  if (tables.length > 1) {
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
  }
  return cards;
}

// Long-division algorithm steps for guided practice.
// Returns { steps: [...], quotient, dividend, divisor }.
// Each step: { partial, digit, quotientDigit, product, remainder, i }
// where `partial` is the running dividend chunk being divided at this step,
// `digit` is the digit just brought down, `i` is the position in the dividend.
export function longDivisionSteps(dividend, divisor) {
  if (divisor <= 0) return { steps: [], quotient: 0, dividend, divisor };
  const digits = String(dividend).split("").map(Number);
  const steps = [];
  let acc = 0;
  let started = false;
  let quotientStr = "";
  for (let i = 0; i < digits.length; i++) {
    acc = acc * 10 + digits[i];
    if (acc < divisor && !started) {
      continue;
    }
    started = true;
    const q = Math.floor(acc / divisor);
    const product = q * divisor;
    const remainder = acc - product;
    steps.push({
      partial: acc,
      digit: digits[i],
      quotientDigit: q,
      product,
      remainder,
      i,
    });
    acc = remainder;
    quotientStr += q;
  }
  return {
    steps,
    quotient: parseInt(quotientStr || "0", 10),
    dividend,
    divisor,
  };
}

// Generate a long-division problem suited for step-by-step practice.
// Ensures multi-step (>= 2 steps) with whole-number quotient.
export function generateStepDivision(opts = {}) {
  const { rng = Math.random, lastKey, difficulty = "medium" } = opts;
  for (let i = 0; i < 30; i++) {
    let divisor, quotient;
    if (difficulty === "easy") {
      divisor = Math.floor(rng() * 5) + 3; // 3-7
      quotient = Math.floor(rng() * 80) + 20; // 20-99 (2-digit quotient)
    } else if (difficulty === "hard") {
      divisor = Math.floor(rng() * 60) + 12; // 12-71
      quotient = Math.floor(rng() * 800) + 100; // 100-899 (3-digit)
    } else {
      divisor = Math.floor(rng() * 18) + 6; // 6-23
      quotient = Math.floor(rng() * 400) + 100; // 100-499
    }
    const dividend = divisor * quotient;
    const key = `sd_${dividend}/${divisor}`;
    if (key === lastKey) continue;
    const info = longDivisionSteps(dividend, divisor);
    if (info.steps.length >= 2) {
      return { ...info, key };
    }
  }
  // fallback
  const info = longDivisionSteps(13032, 24);
  return { ...info, key: "sd_13032/24_f" };
}

// Generate a long-division problem with a non-zero remainder.
export function generateRemainderDiv(opts = {}) {
  const { rng = Math.random, lastKey, difficulty = "medium" } = opts;
  for (let i = 0; i < 30; i++) {
    let divisor, quotient;
    if (difficulty === "easy") {
      divisor = Math.floor(rng() * 6) + 3; // 3-8
      quotient = Math.floor(rng() * 9) + 5; // 5-13
    } else if (difficulty === "hard") {
      divisor = Math.floor(rng() * 18) + 7; // 7-24
      quotient = Math.floor(rng() * 60) + 11; // 11-70
    } else {
      divisor = Math.floor(rng() * 11) + 4; // 4-14
      quotient = Math.floor(rng() * 30) + 10; // 10-39
    }
    const remainder = Math.floor(rng() * (divisor - 1)) + 1; // 1..divisor-1
    const dividend = divisor * quotient + remainder;
    const key = `rd_${dividend}/${divisor}`;
    if (key === lastKey) continue;
    return {
      a: dividend,
      b: divisor,
      op: "÷r",
      prompt: `${dividend} ÷ ${divisor}`,
      answer: { quotient, remainder },
      key,
    };
  }
  return {
    a: 25,
    b: 4,
    op: "÷r",
    prompt: "25 ÷ 4",
    answer: { quotient: 6, remainder: 1 },
    key: "rd_25/4_f",
  };
}

// Decimal multiplication. One factor is a small decimal, other is a small integer.
const DECIMALS = [0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 1.2, 1.5, 1.8, 2.4, 2.5];
export function generateDecimalMul(opts = {}) {
  const { rng = Math.random, lastKey } = opts;
  for (let i = 0; i < 30; i++) {
    const a = DECIMALS[Math.floor(rng() * DECIMALS.length)];
    const b = Math.floor(rng() * 10) + 2; // 2-11
    const product = Math.round(a * b * 100) / 100;
    const key = `dm_${a}x${b}`;
    if (key === lastKey) continue;
    return {
      a,
      b,
      op: "×",
      prompt: `${a} × ${b}`,
      answer: product,
      key,
      decimal: true,
    };
  }
  return { a: 1.5, b: 4, op: "×", prompt: "1.5 × 4", answer: 6, key: "dm_1.5x4_f", decimal: true };
}

// Long multiplication algorithm: each digit of `b` (from ones) creates a partial.
// Returns { a, b, partials: [{ digit, smallProduct, shifted, offset }], total, key }
export function longMultiplicationSteps(a, b) {
  const bDigits = String(b).split("").map(Number).reverse(); // ones first
  const partials = bDigits.map((digit, offset) => {
    const smallProduct = a * digit;
    const shifted = smallProduct * Math.pow(10, offset);
    return { digit, smallProduct, shifted, offset };
  });
  return { a, b, partials, total: a * b };
}

export function generateStepMultiplication(opts = {}) {
  const { rng = Math.random, lastKey, difficulty = "medium" } = opts;
  for (let i = 0; i < 30; i++) {
    let a, b;
    if (difficulty === "easy") {
      // 2-digit × 1-digit (single partial, easier intro)
      a = Math.floor(rng() * 80) + 12; // 12-91
      b = Math.floor(rng() * 8) + 2; // 2-9
    } else if (difficulty === "hard") {
      // 3-digit × 2-digit
      a = Math.floor(rng() * 800) + 100;
      b = Math.floor(rng() * 80) + 12;
    } else {
      // 2-digit × 2-digit
      a = Math.floor(rng() * 80) + 12;
      b = Math.floor(rng() * 80) + 12;
    }
    const key = `sm_${a}x${b}`;
    if (key === lastKey) continue;
    return { ...longMultiplicationSteps(a, b), key };
  }
  return { ...longMultiplicationSteps(23, 47), key: "sm_23x47_f" };
}

// Tips per table for Learn mode
/**
 * Structured tips per times-table.
 *   { kind: "formula" | "rule" | "anchor" | "pattern" | "trick", text: "..." }
 *
 * Designed so the UI can render an icon + small caption per category.
 */
export function tableTips(n) {
  const tips = {
    1: [
      { kind: "formula", text: "Identity: anything × 1 = itself." },
      { kind: "trick", text: "If a result equals the multiplier, you used 1." },
    ],
    2: [
      { kind: "formula", text: "Doubles: 2×n = n + n." },
      { kind: "pattern", text: "Always even — last digit is 0, 2, 4, 6, or 8." },
      { kind: "rule", text: "Divisible by 2 if the last digit is even." },
    ],
    3: [
      { kind: "formula", text: "3×n = 2×n + n. (3×7 = 14 + 7 = 21)" },
      { kind: "rule", text: "Add the digits — if the sum is a multiple of 3, the number is too. 123 → 1+2+3 = 6 ✓" },
      { kind: "pattern", text: "Last-digit cycle: 3, 6, 9, 2, 5, 8, 1, 4, 7, 0." },
    ],
    4: [
      { kind: "trick", text: "Double, then double again. 4×7 → 7 → 14 → 28." },
      { kind: "rule", text: "Divisible by 4 if the last two digits form a multiple of 4. 312 → '12' ✓" },
      { kind: "pattern", text: "Last-digit cycle of length 5: 4, 8, 2, 6, 0." },
    ],
    5: [
      { kind: "pattern", text: "Always ends in 0 (even k) or 5 (odd k)." },
      { kind: "trick", text: "5×n = (10×n) ÷ 2 — multiply by ten, then halve." },
      { kind: "rule", text: "Divisible by 5 if it ends in 0 or 5." },
    ],
    6: [
      { kind: "formula", text: "6×n = 5×n + n. (6×7 = 35 + 7 = 42)" },
      { kind: "pattern", text: "Always even, since 6 is even." },
      { kind: "rule", text: "Divisible by 6 ⇔ divisible by both 2 and 3." },
    ],
    7: [
      { kind: "trick", text: "No clean shortcut — chain it: 7, 14, 21, 28, 35, 42, 49, 56, 63, 70." },
      { kind: "anchor", text: "7×7 = 49 · 7×8 = 56 (\"5, 6, 7, 8\" → 56 = 7×8) · 7×11 = 77." },
      { kind: "trick", text: "7×9 = 63 — \"six-three is seven-nine\"." },
    ],
    8: [
      { kind: "trick", text: "Triple-double: 8×n = 2 × 2 × 2 × n. (8×7 → 7 → 14 → 28 → 56)" },
      { kind: "formula", text: "Or 8×n = 10×n − 2×n. (8×6 = 60 − 12 = 48)" },
      { kind: "rule", text: "Divisible by 8 if the last three digits form a multiple of 8." },
    ],
    9: [
      { kind: "formula", text: "9×n = 10×n − n. (9×7 = 70 − 7 = 63)" },
      { kind: "trick", text: "Digits of the answer add to 9 (for 1 ≤ n ≤ 10). 9×4 = 36 → 3+6 = 9." },
      { kind: "rule", text: "Divisible by 9 if the digit sum is a multiple of 9. 729 → 18 ✓" },
      { kind: "trick", text: "Finger trick: hold up 10 fingers, fold the n-th; digits on each side give the answer." },
    ],
    10: [
      { kind: "trick", text: "Just append a 0 to n." },
      { kind: "rule", text: "Divisible by 10 if it ends in 0." },
    ],
    11: [
      { kind: "trick", text: "For 1-digit n: write n twice. 11×4 = 44, 11×7 = 77." },
      { kind: "trick", text: "For 2-digit n: split, add, insert. 11×23 → 2_3 with 2+3 = 5 → 253. Carry if the sum ≥ 10." },
      { kind: "rule", text: "Alternating digit sum is a multiple of 11 (incl. 0). 2728 → 2−7+2−8 = −11 ✓" },
    ],
    12: [
      { kind: "formula", text: "12×n = 10×n + 2×n. (12×7 = 70 + 14 = 84)" },
      { kind: "trick", text: "12 = 4 × 3, so 12×n = 4×n × 3 (or 6×n × 2)." },
      { kind: "anchor", text: "12×12 = 144." },
    ],
    13: [
      { kind: "formula", text: "13×n = 10×n + 3×n. (13×6 = 60 + 18 = 78)" },
      { kind: "anchor", text: "13×13 = 169." },
    ],
    14: [
      { kind: "formula", text: "14×n = 10×n + 4×n." },
      { kind: "trick", text: "14×n = 7×n × 2 — if your 7s are solid, just double." },
      { kind: "pattern", text: "Always even (14 is even)." },
    ],
    15: [
      { kind: "formula", text: "15×n = 10×n + 5×n. (15×6 = 60 + 30 = 90)" },
      { kind: "trick", text: "Halve a 30: 15×n = (30×n) ÷ 2. (15×8 = 240 ÷ 2 = 120)" },
      { kind: "rule", text: "15 = 3 × 5: divisible by 15 ⇔ divisible by 3 and 5." },
    ],
    16: [
      { kind: "trick", text: "16×n = 8×n × 2 — double your 8s." },
      { kind: "formula", text: "Or 16×n = 4×n × 4." },
      { kind: "formula", text: "Or 16×n = 10×n + 6×n." },
    ],
    17: [
      { kind: "formula", text: "17×n = 10×n + 7×n." },
      { kind: "anchor", text: "17×3 = 51 · 17×6 = 102 · 17×17 = 289." },
      { kind: "trick", text: "Genuinely no shortcut — drill the anchors and repetition wins." },
    ],
    18: [
      { kind: "trick", text: "18×n = 9×n × 2 — double your 9s." },
      { kind: "formula", text: "Or 18×n = 20×n − 2×n. (18×7 = 140 − 14 = 126)" },
      { kind: "rule", text: "Divisible by 18 ⇔ divisible by 2 and by 9." },
    ],
    19: [
      { kind: "formula", text: "19×n = 20×n − n. (19×8 = 160 − 8 = 152)" },
      { kind: "formula", text: "Or (10×n × 2) − n." },
      { kind: "anchor", text: "19×19 = 361." },
    ],
    20: [
      { kind: "trick", text: "20×n = 2×n with a 0 appended. (20×7 = 14 → 140)" },
      { kind: "formula", text: "Or 10×n × 2." },
      { kind: "rule", text: "Ends in 00, 20, 40, 60, or 80." },
    ],
  };
  return tips[n] || [{ kind: "trick", text: "Practise repeats until automatic." }];
}
