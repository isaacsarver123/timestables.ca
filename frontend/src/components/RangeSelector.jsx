import { useState, useEffect } from "react";
import { getState, setSelectedTables, subscribe } from "@/lib/storage";

const ALL = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12

export const RangeSelector = () => {
  const [selected, setSelected] = useState(getState().selectedTables);

  useEffect(() => {
    const unsub = subscribe(() => setSelected(getState().selectedTables));
    return () => unsub();
  }, []);

  const toggle = (n) => {
    const next = selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n];
    if (next.length === 0) return; // require at least one
    setSelectedTables(next);
  };

  const setPreset = (preset) => {
    if (preset === "easy") setSelectedTables([2, 3, 4, 5]);
    if (preset === "core") setSelectedTables([2, 3, 4, 5, 6, 7, 8, 9, 10]);
    if (preset === "all") setSelectedTables(ALL);
    if (preset === "tough") setSelectedTables([6, 7, 8, 9, 11, 12]);
  };

  return (
    <div className="bg-white brut-border brut-shadow p-6" data-testid="range-selector">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
            01 · Pick your tables
          </div>
          <h3 className="text-xl sm:text-2xl font-black tracking-tight">Practice Set</h3>
        </div>
        <div className="flex gap-2 flex-wrap">
          {[
            ["easy", "2–5"],
            ["core", "2–10"],
            ["all", "1–12"],
            ["tough", "Tough"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className="px-3 py-1.5 brut-border bg-white text-xs font-bold uppercase tracking-wider hover:bg-zinc-100 active:translate-y-0.5"
              data-testid={`preset-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
        {ALL.map((n) => {
          const active = selected.includes(n);
          return (
            <button
              key={n}
              onClick={() => toggle(n)}
              data-testid={`table-toggle-${n}`}
              className={`aspect-square brut-border font-mono text-xl font-black grid place-items-center transition-all ${
                active
                  ? "bg-blue-600 text-white brut-shadow-sm"
                  : "bg-white text-zinc-500 hover:bg-zinc-100"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-3 text-xs font-mono text-zinc-500">
        {selected.length} of 12 selected · tap to toggle
      </div>
    </div>
  );
};

export default RangeSelector;
