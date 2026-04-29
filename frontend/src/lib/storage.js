// LocalStorage state for the app.

const KEY = "tt_arena_state_v2";

const DEFAULT_STATE = {
  coins: 0,
  xp: 0,
  bestStreak: 0,
  bestQuickFire: 0,
  bossLevel: 1,
  bossLevelsCleared: 0,
  selectedTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  opMode: "mul", // 'mul' | 'div' | 'mixed'
  soundOn: true,
  theme: "light", // 'light' | 'dark'
  daily: { date: null, score: 0, total: 0, completed: false },
  powerups: { extraTime: 0, skip: 0, freeze: 0, doubler: 0 },
  stats: {},
  totalCorrect: 0,
  totalWrong: 0,
};

const subscribers = new Set();

function readRaw() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      // attempt to migrate from v1
      const v1 = localStorage.getItem("tt_arena_state_v1");
      if (v1) return JSON.parse(v1);
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function getState() {
  const raw = readRaw();
  if (!raw)
    return {
      ...DEFAULT_STATE,
      powerups: { ...DEFAULT_STATE.powerups },
      stats: {},
      daily: { ...DEFAULT_STATE.daily },
    };
  return {
    ...DEFAULT_STATE,
    ...raw,
    powerups: { ...DEFAULT_STATE.powerups, ...(raw.powerups || {}) },
    stats: { ...(raw.stats || {}) },
    daily: { ...DEFAULT_STATE.daily, ...(raw.daily || {}) },
    selectedTables:
      raw.selectedTables && raw.selectedTables.length
        ? raw.selectedTables
        : DEFAULT_STATE.selectedTables,
  };
}

export function saveState(next) {
  localStorage.setItem(KEY, JSON.stringify(next));
  subscribers.forEach((cb) => {
    try {
      cb(next);
    } catch {
      /* ignore */
    }
  });
}

export function updateState(updater) {
  const cur = getState();
  const next = typeof updater === "function" ? updater(cur) : { ...cur, ...updater };
  saveState(next);
  return next;
}

export function subscribe(cb) {
  subscribers.add(cb);
  return () => subscribers.delete(cb);
}

export function levelFromXp(xp) {
  return Math.floor(Math.sqrt(xp / 25)) + 1;
}
export function xpForLevel(level) {
  return Math.pow(level - 1, 2) * 25;
}
export function progressToNextLevel(xp) {
  const lvl = levelFromXp(xp);
  const cur = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  const pct = ((xp - cur) / (next - cur)) * 100;
  return { level: lvl, current: xp - cur, needed: next - cur, pct };
}

// Bucket stats by the "table" being practised. For division, the divisor is the table.
export function recordAnswer({ a, b, op, correct, ms }) {
  const tableKey = op === "÷" ? String(b) : String(Math.max(a, b));
  updateState((s) => {
    const cur = s.stats[tableKey] || { correct: 0, wrong: 0, totalMs: 0 };
    return {
      ...s,
      stats: {
        ...s.stats,
        [tableKey]: {
          correct: cur.correct + (correct ? 1 : 0),
          wrong: cur.wrong + (correct ? 0 : 1),
          totalMs: cur.totalMs + (ms || 0),
        },
      },
      totalCorrect: s.totalCorrect + (correct ? 1 : 0),
      totalWrong: s.totalWrong + (correct ? 0 : 1),
    };
  });
}

export function addCoinsAndXp(coins, xp) {
  updateState((s) => ({ ...s, coins: s.coins + coins, xp: s.xp + xp }));
}

export function spendCoins(amount) {
  const s = getState();
  if (s.coins < amount) return false;
  updateState((cur) => ({ ...cur, coins: cur.coins - amount }));
  return true;
}

export function addPowerup(kind, qty = 1) {
  updateState((s) => ({
    ...s,
    powerups: { ...s.powerups, [kind]: (s.powerups[kind] || 0) + qty },
  }));
}

export function consumePowerup(kind) {
  const s = getState();
  if ((s.powerups[kind] || 0) <= 0) return false;
  updateState((cur) => ({
    ...cur,
    powerups: { ...cur.powerups, [kind]: cur.powerups[kind] - 1 },
  }));
  return true;
}

export function setSelectedTables(tables) {
  updateState((s) => ({ ...s, selectedTables: [...tables].sort((a, b) => a - b) }));
}

export function setOpMode(op) {
  updateState((s) => ({ ...s, opMode: op }));
}

export function setSoundOn(on) {
  updateState((s) => ({ ...s, soundOn: !!on }));
}

export function setTheme(theme) {
  updateState((s) => ({ ...s, theme }));
}

export function recordRunResult({ mode, score, streak }) {
  updateState((s) => {
    const next = { ...s };
    if (streak > s.bestStreak) next.bestStreak = streak;
    if (mode === "quickfire" && score > s.bestQuickFire) next.bestQuickFire = score;
    return next;
  });
}

export function bumpBossLevel() {
  updateState((s) => ({
    ...s,
    bossLevel: s.bossLevel + 1,
    bossLevelsCleared: s.bossLevelsCleared + 1,
  }));
}

export function setDailyResult({ date, score, total }) {
  updateState((s) => ({
    ...s,
    daily: { date, score, total, completed: true },
  }));
}

export function resetAll() {
  localStorage.removeItem(KEY);
  localStorage.removeItem("tt_arena_state_v1");
  subscribers.forEach((cb) => cb(getState()));
}
