import { useEffect, useState } from "react";
import { getState, setOpMode, setInputMode, subscribe } from "@/lib/storage";

const OPS = [
  { key: "mul", label: "Multiplication", symbol: "×" },
  { key: "div", label: "Division", symbol: "÷" },
  { key: "mixed", label: "Both", symbol: "× ÷" },
];

const INPUTS = [
  { key: "type", label: "Type answer" },
  { key: "choices", label: "Pick answer" },
];

export const OpPicker = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  return (
    <div className="surface brut-border-soft p-4" data-testid="op-picker">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
            Operation
          </div>
          <div className="flex gap-1.5" data-testid="op-mode-chips">
            {OPS.map((o) => {
              const active = state.opMode === o.key;
              return (
                <button
                  key={o.key}
                  onClick={() => setOpMode(o.key)}
                  data-testid={`op-${o.key}`}
                  className={`flex-1 brut-border px-3 py-2 transition-colors flex items-center justify-center gap-2 text-xs font-bold ${
                    active
                      ? "bg-blue-600 text-white"
                      : "surface text-fg hover:surface-2"
                  }`}
                >
                  <span className="font-mono text-base font-black leading-none">
                    {o.symbol}
                  </span>
                  <span className="hidden sm:inline">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium mb-2">
            Answer style (short modes)
          </div>
          <div className="flex gap-1.5" data-testid="input-mode-chips">
            {INPUTS.map((i) => {
              const active = state.inputMode === i.key;
              return (
                <button
                  key={i.key}
                  onClick={() => setInputMode(i.key)}
                  data-testid={`input-${i.key}`}
                  className={`flex-1 brut-border px-3 py-2 transition-colors text-xs font-bold ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                      : "surface text-fg hover:surface-2"
                  }`}
                >
                  {i.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OpPicker;
