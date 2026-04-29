import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, SkipForward, Snowflake, Sparkles, Coins } from "lucide-react";
import { getState, subscribe, spendCoins, addPowerup } from "@/lib/storage";
import { sfx } from "@/lib/sound";

const ITEMS = [
  { key: "extraTime", name: "Extra Time", sub: "Adds 15 seconds to a timed run", price: 30, Icon: Plus, color: "bg-emerald-300 text-zinc-950" },
  { key: "skip", name: "Skip", sub: "Skip the current question", price: 20, Icon: SkipForward, color: "bg-blue-300 text-zinc-950" },
  { key: "freeze", name: "Freeze", sub: "Pauses the timer for 5 seconds", price: 40, Icon: Snowflake, color: "bg-cyan-300 text-zinc-950" },
  { key: "doubler", name: "Coin Doubler", sub: "x2 coins for the rest of the run", price: 75, Icon: Sparkles, color: "bg-amber-300 text-zinc-950" },
];

const Shop = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const buy = (item) => {
    if (state.coins < item.price) {
      toast.error(`Need ${item.price - state.coins} more coins`);
      return;
    }
    if (spendCoins(item.price)) {
      addPowerup(item.key, 1);
      sfx.coin();
      toast.success(`+1 ${item.name}`);
    }
  };

  return (
    <div className="space-y-7" data-testid="shop-page">
      <div>
        <Link
          to="/"
          className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
          data-testid="back-link"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="flex items-end justify-between mt-2 flex-wrap gap-3">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Powerup Shop</h1>
          <div className="flex items-center gap-2 brut-border bg-amber-300 text-zinc-950 px-3 py-2">
            <Coins size={16} />
            <span className="font-mono font-bold text-lg tabular-nums">{state.coins}</span>
          </div>
        </div>
        <p className="mt-2 text-muted max-w-xl text-sm">
          Spend coins on edge-cases. Powerups stack across runs and modes.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ITEMS.map((item) => {
          const Icon = item.Icon;
          const owned = state.powerups[item.key] || 0;
          const can = state.coins >= item.price;
          return (
            <div
              key={item.key}
              className="surface brut-border brut-shadow p-5 flex flex-col"
              data-testid={`shop-item-${item.key}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className={`w-12 h-12 brut-border grid place-items-center ${item.color}`}>
                  <Icon size={20} strokeWidth={2.5} />
                </div>
                <div className="brut-border-soft surface-2 px-2 py-1 text-[10px] uppercase tracking-widest font-bold text-fg">
                  Owned · {owned}
                </div>
              </div>
              <h3 className="text-lg font-bold tracking-tight text-fg">{item.name}</h3>
              <p className="text-sm text-muted mt-1 flex-1">{item.sub}</p>
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono font-bold text-xl text-fg">
                  <Coins size={18} className="text-amber-500" />
                  {item.price}
                </div>
                <button
                  data-testid={`buy-${item.key}`}
                  onClick={() => buy(item)}
                  disabled={!can}
                  className={`brut-border brut-shadow font-bold px-4 py-2 uppercase tracking-wider text-xs transition-all ${
                    can
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none"
                      : "surface-2 text-muted cursor-not-allowed"
                  }`}
                >
                  Buy
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Shop;
