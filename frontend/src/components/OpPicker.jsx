import { useEffect, useState } from "react";
import { getState, setOpMode, subscribe } from "@/lib/storage";

const OPTIONS = [
  { key: "mul", label: "Multiplication", symbol: "×" },
  { key: "div", label: "Division", symbol: "÷" },
  { key: "mixed", label: "Both", symbol: "× ÷" },
];

export const OpPicker = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);
  return (
    <div className="surface brut-border p-4 sm:p-5" data-testid="op-picker">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium">
            Operation
          </div>
          <h3 className="text-base font-bold tracking-tight text-fg mt-0.5">
            What do you want to practise?
          </h3>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3" data-testid="op-mode-chips">
        {OPTIONS.map((o) => {
          const active = state.opMode === o.key;
          return (
            <button
              key={o.key}
              onClick={() => setOpMode(o.key)}
              data-testid={`op-${o.key}`}
              className={`brut-border px-3 py-3 sm:py-4 transition-all flex flex-col items-center justify-center gap-1 ${
                active
                  ? "bg-blue-600 text-white brut-shadow-sm"
                  : "surface text-fg hover:surface-2"
              }`}
            >
              <div className="font-mono text-2xl font-black leading-none">{o.symbol}</div>
              <div className="text-[11px] sm:text-xs font-bold uppercase tracking-wider">
                {o.label}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default OpPicker;
