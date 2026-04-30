// ── tiny CMS cache shared across pages ────────────────────────────────────
// Layout calls `loadCms()` on mount; game modes / Question pull `getFlashMs()`.
// Falls back to localStorage for instant boot, then refreshes from the API.
import { api } from "./api";

const KEY = "tt_cms_cache_v1";
const DEFAULT_FLASH_MS = 3000;
const DEFAULT_LESSON_MOTION = {
  driftAmount: 1.0,
  mouseForce: 0.75,
  mouseRadius: 1.8,
};

let cache = {};
try {
  const raw = localStorage.getItem(KEY);
  if (raw) cache = JSON.parse(raw) || {};
} catch (_) {
  cache = {};
}

const listeners = new Set();
const notify = () => listeners.forEach((fn) => { try { fn(cache); } catch (_) {} });

export async function loadCms() {
  try {
    const { data } = await api.get("/cms/public");
    cache = data || {};
    try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch (_) {}
    notify();
    return cache;
  } catch (_) {
    return cache;
  }
}

export function getCmsCached() {
  return cache;
}

export function getFlashMs() {
  const v = parseInt(cache?.wrong_answer_flash_ms, 10);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_FLASH_MS;
}

export function getLessonMotionSettings() {
  const driftAmount = Number(cache?.lesson_drift_amount);
  const mouseForce = Number(cache?.lesson_mouse_force);
  const mouseRadius = Number(cache?.lesson_mouse_radius);
  return {
    driftAmount: Number.isFinite(driftAmount) ? driftAmount : DEFAULT_LESSON_MOTION.driftAmount,
    mouseForce: Number.isFinite(mouseForce) ? mouseForce : DEFAULT_LESSON_MOTION.mouseForce,
    mouseRadius: Number.isFinite(mouseRadius) ? mouseRadius : DEFAULT_LESSON_MOTION.mouseRadius,
  };
}

export function subscribeCms(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
