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

// Tips per table for Learn mode
export function tableTips(n) {
  const tips = {
    1: [
      "Identity: anything × 1 = itself.",
      "Useful for sanity-checking — if a result equals the multiplier, you used 1.",
    ],
    2: [
      "Doubles: 2×n = n + n.",
      "Always even.",
      "Divisibility: a number is divisible by 2 if its last digit is 0, 2, 4, 6, or 8.",
    ],
    3: [
      "3×n = 2×n + n. e.g. 3×7 = 14 + 7 = 21.",
      "Divisibility rule: add up the digits — if the sum is a multiple of 3, the number is too. 123 → 1+2+3 = 6 ✓.",
      "The pattern of last digits cycles: 3, 6, 9, 2, 5, 8, 1, 4, 7, 0.",
    ],
    4: [
      "Double, then double again: 4×n = 2×(2×n). e.g. 4×7 → 7→14→28.",
      "Divisibility rule: a number is divisible by 4 if its last two digits form a multiple of 4. 312 → 12 ✓.",
      "Pattern of last digits: 4, 8, 2, 6, 0 — repeats every 5.",
    ],
    5: [
      "Always ends in 0 (even k) or 5 (odd k).",
      "5×n = (10×n) ÷ 2 — multiply by ten, then halve.",
      "Divisibility: ends in 0 or 5.",
    ],
    6: [
      "6×n = 5×n + n. e.g. 6×7 = 35 + 7 = 42.",
      "Always even, since 6 is even.",
      "Divisibility rule: divisible by 6 ⇔ divisible by both 2 and 3.",
    ],
    7: [
      "No clean shortcut — sequencing helps: 7, 14, 21, 28, 35, 42, 49, 56, 63, 70.",
      "Anchors: 7×7 = 49, 7×8 = 56 ('5, 6, 7, 8' → 56 = 7×8), 7×11 = 77.",
      "7×9 = 63: 'six-three is seven-nine'.",
    ],
    8: [
      "Triple-double: 8×n = 2 × 2 × 2 × n. e.g. 8×7 → 7→14→28→56.",
      "Or: 8×n = 10×n − 2×n. e.g. 8×6 = 60 − 12 = 48.",
      "Divisibility rule: divisible by 8 ⇔ the last three digits form a multiple of 8.",
    ],
    9: [
      "9×n = 10×n − n. e.g. 9×7 = 70 − 7 = 63.",
      "Digit-sum trick: for 9×k where 1 ≤ k ≤ 10, the digits of the answer add to 9. (9×4 = 36 → 3+6 = 9).",
      "Divisibility rule: the digit sum is a multiple of 9. e.g. 729 → 7+2+9 = 18 ✓.",
      "Finger trick: hold up 10 fingers, fold the kth finger; the digits on each side give the answer.",
    ],
    10: [
      "Just append a 0 to n.",
      "Divisibility: ends in 0.",
    ],
    11: [
      "For 1-digit n: write n twice. 11×4 = 44, 11×7 = 77.",
      "For 2-digit n: split the digits, add, insert. 11×23: 2_3 with 2+3 = 5 → 253. Carry if the sum ≥ 10.",
      "Divisibility rule: take the alternating sum of digits. If it's a multiple of 11 (including 0), the number is divisible by 11. 2728 → 2−7+2−8 = −11 ✓.",
    ],
    12: [
      "12×n = 10×n + 2×n. e.g. 12×7 = 70 + 14 = 84.",
      "12 = 4 × 3, so 12×n = 4×n × 3 (or 6×n × 2).",
      "Anchor: 12×12 = 144.",
    ],
    13: [
      "13×n = 10×n + 3×n. e.g. 13×6 = 60 + 18 = 78.",
      "Anchor: 13×13 = 169.",
    ],
    14: [
      "14×n = 10×n + 4×n.",
      "Or: 14×n = 7×n × 2 — if your 7s are solid, just double.",
      "Even, so divisibility by 2 always holds; divisibility by 7 needed for the rest.",
    ],
    15: [
      "15×n = 10×n + 5×n. e.g. 15×6 = 60 + 30 = 90.",
      "Halving trick: 15×n = (30×n) ÷ 2 — useful for even n. 15×8 = 240 ÷ 2 = 120.",
      "15 = 3 × 5: a number is divisible by 15 ⇔ divisible by both 3 and 5.",
    ],
    16: [
      "16×n = 8×n × 2 — double your 8s.",
      "Or: 16×n = 4×n × 4.",
      "Or: 16×n = 10×n + 6×n.",
    ],
    17: [
      "17×n = 10×n + 7×n.",
      "Anchors: 17×3 = 51, 17×6 = 102, 17×17 = 289.",
      "Genuinely no shortcut — repetition wins. Drill the anchors.",
    ],
    18: [
      "18×n = 9×n × 2 — double your 9s.",
      "Or: 18×n = 20×n − 2×n. e.g. 18×7 = 140 − 14 = 126.",
      "Divisibility rule: divisible by 18 ⇔ divisible by 2 and by 9.",
    ],
    19: [
      "19×n = 20×n − n. e.g. 19×8 = 160 − 8 = 152.",
      "Or: (10×n × 2) − n.",
      "Anchor: 19×19 = 361.",
    ],
    20: [
      "20×n = 2×n with a 0 appended. e.g. 20×7 = 14 → 140.",
      "Or: 10×n × 2.",
      "Divisibility: ends in 00, 20, 40, 60, or 80 (i.e. divisible by both 4 and 5).",
    ],
  };
  return tips[n] || ["Practise repeats until automatic."];
}
