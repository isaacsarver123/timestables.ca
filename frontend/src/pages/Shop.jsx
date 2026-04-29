import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, SkipForward, Snowflake, Sparkles, Coins } from "lucide-react";
import { getState, subscribe, spendCoins, addPowerup } from "@/lib/storage";

const ITEMS = [
  {
    key: "extraTime",
    name: "Extra Time",
    sub: "Adds 15 seconds to a timed run",
    price: 30,
    Icon: Plus,
    color: "bg-emerald-300",
  },
  {
    key: "skip",
    name: "Skip",
    sub: "Skip the current question",
    price: 20,
    Icon: SkipForward,
    color: "bg-blue-300",
  },
  {
    key: "freeze",
    name: "Freeze",
    sub: "Pauses the timer for 5 seconds",
    price: 40,
    Icon: Snowflake,
    color: "bg-cyan-300",
  },
  {
    key: "doubler",
    name: "Coin Doubler",
    sub: "x2 coins for the rest of the run",
    price: 75,
    Icon: Sparkles,
    color: "bg-amber-300",
  },
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
      toast.success(`+1 ${item.name}`);
    }
  };

  return (
    <div className="space-y-8" data-testid="shop-page">
      <div>
        <Link
          to="/"
          className="text-xs font-bold uppercase tracking-widest text-zinc-500 hover:text-zinc-900 flex items-center gap-1"
          data-testid="back-link"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <div className="flex items-end justify-between mt-2 flex-wrap gap-3">
          <h1 className="text-4xl sm:text-5xl font-black tracking-tighter">Powerup Shop</h1>
          <div className="flex items-center gap-2 brut-border bg-amber-300 px-4 py-2.5">
            <Coins size={18} />
            <span className="font-mono font-black text-xl tabular-nums">{state.coins}</span>
          </div>
        </div>
        <p className="mt-2 text-zinc-600 max-w-xl">
          Spend coins on edge-cases. Powerups stack across runs and modes — buy ahead of a tough boss.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ITEMS.map((item) => {
          const Icon = item.Icon;
          const owned = state.powerups[item.key] || 0;
          const can = state.coins >= item.price;
          return (
            <div
              key={item.key}
              className="bg-white brut-border brut-shadow p-6 flex flex-col"
              data-testid={`shop-item-${item.key}`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className={`w-14 h-14 brut-border grid place-items-center ${item.color}`}>
                  <Icon size={24} strokeWidth={2.5} />
                </div>
                <div className="brut-border bg-zinc-100 px-2 py-1 text-[10px] uppercase tracking-widest font-bold">
                  Owned · {owned}
                </div>
              </div>
              <h3 className="text-2xl font-black tracking-tight">{item.name}</h3>
              <p className="text-sm text-zinc-600 mt-1 flex-1">{item.sub}</p>
              <div className="mt-5 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono font-black text-2xl">
                  <Coins size={20} className="text-amber-600" />
                  {item.price}
                </div>
                <button
                  data-testid={`buy-${item.key}`}
                  onClick={() => buy(item)}
                  disabled={!can}
                  className={`brut-border brut-shadow font-bold px-5 py-2.5 uppercase tracking-wider text-sm transition-all ${
                    can
                      ? "bg-zinc-950 text-white hover:bg-blue-600 active:translate-x-1 active:translate-y-1 active:shadow-none"
                      : "bg-zinc-100 text-zinc-400 cursor-not-allowed"
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
