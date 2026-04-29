import { useState, useEffect } from "react";
import { getState, setSelectedTables, subscribe } from "@/lib/storage";

const ALL = Array.from({ length: 20 }, (_, i) => i + 1);

export const RangeSelector = () => {
  const [state, setState] = useState(getState());

  useEffect(() => {
    const unsub = subscribe(() => setState(getState()));
    return () => unsub();
  }, []);

  const selected = state.selectedTables;

  const toggle = (n) => {
    const next = selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n];
    if (next.length === 0) return;
    setSelectedTables(next);
  };

  const setPreset = (preset) => {
    if (preset === "easy") setSelectedTables([2, 3, 4, 5]);
    if (preset === "core") setSelectedTables([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    if (preset === "twelve") setSelectedTables([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    if (preset === "all") setSelectedTables(ALL);
    if (preset === "tough") setSelectedTables([6, 7, 8, 9, 11, 12, 13, 14, 17, 19]);
  };

  return (
    <div className="surface brut-border p-5 sm:p-6" data-testid="range-selector">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
            Settings
          </div>
          <h3 className="text-base sm:text-lg font-bold tracking-tight text-fg mt-0.5">
            Tables &amp; operation
          </h3>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {[
            ["easy", "2–5"],
            ["core", "2–10"],
            ["twelve", "2–12"],
            ["all", "1–20"],
            ["tough", "Tough"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className="px-2.5 py-1 brut-border-soft surface text-[11px] font-semibold uppercase tracking-wider text-fg hover:surface-2"
              data-testid={`preset-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-10 gap-1.5 sm:gap-2">
        {ALL.map((n) => {
          const active = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              data-testid={`table-toggle-${n}`}
              className={`aspect-square brut-border font-mono text-sm sm:text-base font-bold grid place-items-center transition-all ${
                active
                  ? "bg-blue-600 text-white"
                  : "surface text-muted hover:surface-2"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>

      <div className="mt-4 text-xs font-mono text-muted">
        {selected.length} of 20 selected · tap to toggle
      </div>
    </div>
  );
};

export default RangeSelector;
