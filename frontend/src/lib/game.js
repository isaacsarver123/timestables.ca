// Question generation utilities.

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateQuestion(selectedTables, opts = {}) {
  const { lastKey, maxFactor = 12, minFactor = 1 } = opts;
  const tables = selectedTables && selectedTables.length ? selectedTables : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  for (let i = 0; i < 20; i++) {
    const a = tables[randInt(0, tables.length - 1)];
    const b = randInt(minFactor, maxFactor);
    const key = `${a}x${b}`;
    if (key !== lastKey) {
      return { a, b, answer: a * b, key };
    }
  }
  const a = tables[0];
  const b = randInt(minFactor, maxFactor);
  return { a, b, answer: a * b, key: `${a}x${b}` };
}

// Boss level config: each level adds tables and increases max factor.
export function bossConfig(level) {
  const baseTables = [2, 3];
  const extra = [4, 5, 6, 7, 8, 9, 10, 11, 12];
  const tables = [...baseTables, ...extra.slice(0, Math.min(level, extra.length))];
  const maxFactor = Math.min(6 + level, 12);
  const questions = 8 + Math.min(level, 7); // 9..15
  const timePerQ = Math.max(8 - Math.floor(level / 2), 4); // seconds, decreases
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
  ];
  return names[(level - 1) % names.length];
}
