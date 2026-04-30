// State for the app — localStorage cache + optional backend sync when logged in.
import { api } from "./api";

const KEY = "tt_arena_state_v2";

// ---- remote sync ---------------------------------------------------------
let _remoteEnabled = false;
let _hydrating = false;
let _saveTimer = null;

async function _push() {
  if (!_remoteEnabled) return;
  try {
    await api.put("/user/state", { state: getState() });
  } catch {
    /* offline / not auth — keep going with localStorage */
  }
}

function _scheduleRemoteSave() {
  if (!_remoteEnabled || _hydrating) return;
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_push, 800);
}

export async function initRemoteSync() {
  // Called on app boot AND after login. Tries /user/state; if 200, hydrate
  // localStorage from server (server is the source of truth across devices).
  try {
    const { data } = await api.get("/user/state");
    _remoteEnabled = true;
    if (data && data.state && typeof data.state === "object") {
      _hydrating = true;
      try {
        localStorage.setItem(KEY, JSON.stringify(data.state));
        subscribers.forEach((cb) => { try { cb(getState()); } catch {} });
      } finally {
        _hydrating = false;
      }
    } else {
      // Brand-new or unsynced account: start fresh instead of inheriting
      // whatever another account last used in this browser.
      _hydrating = true;
      try {
        const clean = freshStateFromPreferences(readRaw() || {});
        localStorage.setItem(KEY, JSON.stringify(clean));
        subscribers.forEach((cb) => { try { cb(getState()); } catch {} });
      } finally {
        _hydrating = false;
      }
      _push();
    }
    // Auto-consume a streak freeze if the user missed exactly one day.
    try { await maybeUseStreakFreezeOnBoot(); } catch {}
    return true;
  } catch {
    _remoteEnabled = false;
    return false;
  }
}

/**
 * If the last recorded streak activity was exactly 2 days ago (i.e. the user
 * missed yesterday), try to consume a Streak Freeze so the count doesn't reset.
 * Server-authoritative: only patches local state if the server confirms.
 */
export async function maybeUseStreakFreezeOnBoot() {
  const s = getState();
  const prev = s.dailyStreak || { count: 0, lastDate: null };
  if (!prev.lastDate || !prev.count) return false;
  const d = new Date();
  const daysAgo = (ds) => {
    const a = new Date(ds + "T00:00:00");
    const b = new Date(d.toISOString().slice(0, 10) + "T00:00:00");
    return Math.round((b - a) / (1000 * 60 * 60 * 24));
  };
  let gap;
  try { gap = daysAgo(prev.lastDate); } catch { return false; }
  if (gap !== 2) return false;  // only save if exactly 1 missed day
  try {
    await api.post("/streak/use-freeze");
  } catch {
    return false;
  }
  // Patch local: advance lastDate by 1 so the count is preserved.
  const yest = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
  updateState((cur) => ({
    ...cur,
    dailyStreak: { count: cur.dailyStreak.count, lastDate: yest },
  }));
  return true;
}

export function disableRemoteSync() {
  _remoteEnabled = false;
}


const DEFAULT_STATE = {
  coins: 0,
  xp: 0,
  bestStreak: 0,
  bestQuickFire: 0,
  bossLevel: 1,
  bossLevelsCleared: 0,
  selectedTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  opMode: "mul", // 'mul' | 'div' | 'mixed'
  inputMode: "type", // 'type' | 'choices'
  soundOn: true,
  theme: "light", // 'light' | 'dark'
  daily: { date: null, score: 0, total: 0, completed: false },
  dailyStreak: { count: 0, lastDate: null },
  history: {}, // { 'YYYY-MM-DD': { correct: number, wrong: number } }
  powerups: { extraTime: 0, skip: 0, freeze: 0, doubler: 0 },
  stats: {},
  totalCorrect: 0,
  totalWrong: 0,
};

const subscribers = new Set();

function freshStateFromPreferences(source = {}) {
  return {
    ...DEFAULT_STATE,
    selectedTables:
      Array.isArray(source.selectedTables) && source.selectedTables.length
        ? [...source.selectedTables]
        : [...DEFAULT_STATE.selectedTables],
    opMode: source.opMode || DEFAULT_STATE.opMode,
    inputMode: source.inputMode || DEFAULT_STATE.inputMode,
    soundOn: typeof source.soundOn === "boolean" ? source.soundOn : DEFAULT_STATE.soundOn,
    theme: source.theme || DEFAULT_STATE.theme,
    powerups: { ...DEFAULT_STATE.powerups },
    stats: {},
    daily: { ...DEFAULT_STATE.daily },
    dailyStreak: { ...DEFAULT_STATE.dailyStreak },
    history: {},
  };
}

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
    dailyStreak: { ...DEFAULT_STATE.dailyStreak, ...(raw.dailyStreak || {}) },
    history: { ...(raw.history || {}) },
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
  _scheduleRemoteSave();
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

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function yesterdayStr() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Bucket stats by the "table" being practised. For division, the divisor is the table.
export function recordAnswer({ a, b, op, correct, ms }) {
  const tableKey = op === "÷" ? String(b) : String(Math.max(a, b));
  const today = todayStr();
  updateState((s) => {
    const cur = s.stats[tableKey] || { correct: 0, wrong: 0, totalMs: 0 };
    const histCur = s.history[today] || { correct: 0, wrong: 0 };
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
      history: {
        ...s.history,
        [today]: {
          correct: histCur.correct + (correct ? 1 : 0),
          wrong: histCur.wrong + (correct ? 0 : 1),
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

export function setInputMode(mode) {
  updateState((s) => ({ ...s, inputMode: mode }));
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
  // Universal streak credit — every finished run counts (Boss/QuickFire/
  // Streak/LongMul/LongDiv/Lesson all eventually flow through here OR call
  // markCompletedActivityToday directly).
  return markCompletedActivityToday();
}

export function bumpBossLevel() {
  updateState((s) => ({
    ...s,
    bossLevel: s.bossLevel + 1,
    bossLevelsCleared: s.bossLevelsCleared + 1,
  }));
}

export function setDailyResult({ date, score, total }) {
  updateState((s) => {
    const prev = s.dailyStreak || { count: 0, lastDate: null };
    let count = prev.count;
    if (prev.lastDate === date) {
      // already counted today; no change
    } else if (prev.lastDate === yesterdayStr()) {
      count = (prev.count || 0) + 1;
    } else {
      count = 1;
    }
    return {
      ...s,
      daily: { date, score, total, completed: true },
      dailyStreak: { count, lastDate: date },
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Universal "I finished an activity today" hook.
//   - Idempotent for the rest of today (already counted → returns wasFirst:false)
//   - Bumps the daily streak count (adds 1 if yesterday counted, else resets to 1)
//   - At milestone thresholds, awards bonus gems (added straight to coins for
//     now since gems are server-side; the celebration UI shows the badge).
// Returns the new streak state plus what just happened so callers can play
// the right end-of-run animations.
// ─────────────────────────────────────────────────────────────────────────
const STREAK_GEM_REWARDS = {
  1: 1,
  3: 3,
  7: 5,
  14: 8,
  25: 15,
  50: 25,
  100: 50,
  200: 75,
  365: 150,
};

export function markCompletedActivityToday() {
  const today = todayStr();
  const s = getState();
  const prev = s.dailyStreak || { count: 0, lastDate: null };
  if (prev.lastDate === today) {
    return {
      wasFirst: false,
      streak: prev.count,
      gemsAwarded: 0,
      isStreakStart: false,
    };
  }
  const isStreakStart = prev.lastDate !== yesterdayStr();
  const nextCount = isStreakStart ? 1 : (prev.count || 0) + 1;
  const gemsAwarded = STREAK_GEM_REWARDS[nextCount] || 0;
  updateState((cur) => ({
    ...cur,
    dailyStreak: { count: nextCount, lastDate: today },
  }));
  return {
    wasFirst: true,
    streak: nextCount,
    gemsAwarded,
    isStreakStart,
  };
}

export function resetPreferences() {
  updateState((s) => ({
    ...s,
    selectedTables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
    opMode: "mul",
    inputMode: "type",
    soundOn: true,
    theme: "light",
  }));
}

export function resetStats() {
  updateState((s) => ({
    ...s,
    coins: 0,
    xp: 0,
    bestStreak: 0,
    bestQuickFire: 0,
    bossLevel: 1,
    bossLevelsCleared: 0,
    powerups: { extraTime: 0, skip: 0, freeze: 0, doubler: 0 },
    stats: {},
    totalCorrect: 0,
    totalWrong: 0,
    history: {},
    daily: { date: null, score: 0, total: 0, completed: false },
    dailyStreak: { count: 0, lastDate: null },
  }));
}

export function resetAll() {
  localStorage.removeItem(KEY);
  localStorage.removeItem("tt_arena_state_v1");
  subscribers.forEach((cb) => cb(getState()));
}
