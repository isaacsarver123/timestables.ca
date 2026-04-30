import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, SkipForward, Snowflake, Sparkles, Coins, Gem, Zap, ShoppingCart } from "lucide-react";
import { getState, subscribe, spendCoins, addPowerup } from "@/lib/storage";
import { sfx } from "@/lib/sound";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// Coin-priced mini-powerups (local state).
const COIN_ITEMS = [
  { key: "extraTime", name: "Extra Time", sub: "Adds 15 seconds to a timed run", price: 30, Icon: Plus, color: "bg-emerald-300 text-zinc-950" },
  { key: "skip",      name: "Skip",       sub: "Skip the current question",    price: 20, Icon: SkipForward, color: "bg-blue-300 text-zinc-950" },
  { key: "freeze",    name: "Freeze",     sub: "Pauses the timer for 5 seconds", price: 40, Icon: Snowflake,  color: "bg-cyan-300 text-zinc-950" },
  { key: "doubler",   name: "Coin Doubler", sub: "x2 coins for the rest of the run", price: 75, Icon: Sparkles, color: "bg-amber-300 text-zinc-950" },
];

function fmtCountdown(s) {
  if (s <= 0) return "0s";
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${String(r).padStart(2, "0")}s` : `${r}s`;
}

const Shop = () => {
  const [state, setState] = useState(getState());
  const { user, refresh } = useAuth();
  const [catalog, setCatalog] = useState(null);
  const [busy, setBusy] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => subscribe(() => setState(getState())), []);

  // Refresh shop catalog on mount and after every purchase.
  const loadCatalog = async () => {
    try {
      const { data } = await api.get("/shop/catalog");
      setCatalog(data);
    } catch (e) {
      // fall through — user-level state isn't fatal for the page
    }
  };
  useEffect(() => { loadCatalog(); }, []);

  // Tick once per second so the XP Boost countdown updates live.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const buyCoinItem = (item) => {
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

  const buyGemItem = async (endpoint, name) => {
    setBusy(endpoint);
    try {
      await api.post(`/shop/${endpoint}`);
      sfx.coin();
      toast.success(name);
      await Promise.all([loadCatalog(), refresh?.()]);
    } catch (e) {
      const msg = e?.response?.data?.detail || "Purchase failed";
      toast.error(typeof msg === "string" ? msg : "Purchase failed");
    } finally {
      setBusy(null);
    }
  };

  const buyGemPack = async (packId) => {
    setBusy(`pack-${packId}`);
    try {
      const { data } = await api.post("/stripe/gems-checkout", {
        pack_id: packId,
        origin: window.location.origin,
      });
      if (data?.url) window.location.href = data.url;
    } catch (e) {
      const msg = e?.response?.data?.detail || "Checkout failed";
      toast.error(typeof msg === "string" ? msg : "Checkout failed");
    } finally {
      setBusy(null);
    }
  };

  // Live XP-boost seconds remaining (ticks every second).
  const xpBoostUntil = catalog?.user?.xp_boost_until || user?.xp_boost_until;
  const boostSecsLeft = (() => {
    if (!xpBoostUntil) return 0;
    try {
      const ms = new Date(xpBoostUntil).getTime() - Date.now();
      return Math.max(0, Math.floor(ms / 1000));
    } catch (e) {
      return 0;
    }
  })();
  const boostActive = boostSecsLeft > 0;
  const gems = catalog?.user?.gems ?? user?.gems ?? 0;
  const freezes = catalog?.user?.streak_freezes ?? user?.streak_freezes ?? 0;
  const xpBoostCost = catalog?.items?.xp_boost_30m?.cost ?? 50;
  const freezeCost = catalog?.items?.streak_freeze?.cost ?? 100;
  const freezeCap = catalog?.items?.streak_freeze?.cap ?? 2;

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
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Shop</h1>
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className="flex items-center gap-2 brut-border bg-amber-300 text-zinc-950 px-3 py-2"
              data-testid="shop-coin-balance"
            >
              <Coins size={16} />
              <span className="font-mono font-bold text-lg tabular-nums">{state.coins}</span>
            </div>
            <div
              className="flex items-center gap-2 brut-border bg-cyan-300 text-zinc-950 px-3 py-2"
              data-testid="shop-gem-balance"
            >
              <Gem size={16} />
              <span className="font-mono font-bold text-lg tabular-nums">{gems}</span>
            </div>
          </div>
        </div>
        <p className="mt-2 text-muted max-w-xl text-sm">
          Gems fuel meta-progression (XP boosts, streak saves). Coins fuel per-run powerups.
        </p>
      </div>

      {/* ── Meta-progression tiles ───────────────────────────────── */}
      <section aria-labelledby="meta-heading">
        <h2
          id="meta-heading"
          className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold mb-3"
        >
          Meta boosts · spend gems
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* XP Boost */}
          <div
            className="surface brut-border brut-shadow p-5 flex flex-col"
            data-testid="shop-item-xp-boost"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-12 h-12 brut-border grid place-items-center bg-violet-300 text-zinc-950">
                <Zap size={20} strokeWidth={2.5} />
              </div>
              <div
                className={`brut-border-soft px-2 py-1 text-[10px] uppercase tracking-widest font-bold ${
                  boostActive
                    ? "bg-violet-500 text-white"
                    : "surface-2 text-fg"
                }`}
                data-testid="shop-xp-boost-status"
              >
                {boostActive ? `Active · ${fmtCountdown(boostSecsLeft)}` : "Not active"}
              </div>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-fg">XP Boost</h3>
            <p className="text-sm text-muted mt-1 flex-1">
              2× XP on every lesson finish for 30 minutes. Buying again stacks the timer.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono font-bold text-xl text-fg">
                <Gem size={18} className="text-cyan-500" />
                {xpBoostCost}
              </div>
              <button
                data-testid="buy-xp-boost"
                onClick={() => buyGemItem("buy-xp-boost", "XP Boost · 30 minutes")}
                disabled={busy === "buy-xp-boost" || gems < xpBoostCost}
                className={`brut-border brut-shadow font-bold px-4 py-2 uppercase tracking-wider text-xs transition-all ${
                  gems >= xpBoostCost && busy !== "buy-xp-boost"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-violet-500 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none"
                    : "surface-2 text-muted cursor-not-allowed"
                }`}
              >
                {busy === "buy-xp-boost" ? "…" : boostActive ? "Extend" : "Buy"}
              </button>
            </div>
          </div>

          {/* Streak Freeze */}
          <div
            className="surface brut-border brut-shadow p-5 flex flex-col"
            data-testid="shop-item-streak-freeze"
          >
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="w-12 h-12 brut-border grid place-items-center bg-cyan-300 text-zinc-950">
                <Snowflake size={20} strokeWidth={2.5} />
              </div>
              <div
                className="brut-border-soft surface-2 px-2 py-1 text-[10px] uppercase tracking-widest font-bold text-fg"
                data-testid="shop-freeze-owned"
              >
                Owned · {freezes} / {freezeCap}
              </div>
            </div>
            <h3 className="text-lg font-bold tracking-tight text-fg">Streak Freeze</h3>
            <p className="text-sm text-muted mt-1 flex-1">
              Auto-saves your streak once if you miss a day. You can hold {freezeCap} at a time.
            </p>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-mono font-bold text-xl text-fg">
                <Gem size={18} className="text-cyan-500" />
                {freezeCost}
              </div>
              <button
                data-testid="buy-streak-freeze"
                onClick={() => buyGemItem("buy-streak-freeze", "+1 Streak Freeze")}
                disabled={busy === "buy-streak-freeze" || gems < freezeCost || freezes >= freezeCap}
                className={`brut-border brut-shadow font-bold px-4 py-2 uppercase tracking-wider text-xs transition-all ${
                  gems >= freezeCost && freezes < freezeCap && busy !== "buy-streak-freeze"
                    ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-cyan-500 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none"
                    : "surface-2 text-muted cursor-not-allowed"
                }`}
              >
                {freezes >= freezeCap ? "Max" : busy === "buy-streak-freeze" ? "…" : "Buy"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Gem packs ─────────────────────────────────────────── */}
      <section aria-labelledby="gem-packs-heading">
        <h2
          id="gem-packs-heading"
          className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold mb-3"
        >
          Get gems · Stripe checkout
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(catalog?.gem_packs || {}).map(([packId, pack]) => (
            <div
              key={packId}
              className="surface brut-border brut-shadow p-5 flex flex-col"
              data-testid={`gem-pack-${packId}`}
            >
              <div className="w-12 h-12 brut-border bg-cyan-300 text-zinc-950 grid place-items-center mb-3">
                <Gem size={20} strokeWidth={2.5} />
              </div>
              <div className="font-mono font-black text-3xl text-fg tabular-nums">
                {pack.gems.toLocaleString()}
              </div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-muted font-medium mb-3">
                gems
              </div>
              <button
                data-testid={`buy-pack-${packId}`}
                onClick={() => buyGemPack(packId)}
                disabled={busy === `pack-${packId}`}
                className="mt-auto brut-border brut-shadow font-bold py-2.5 uppercase tracking-wider text-xs bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-cyan-500 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all flex items-center justify-center gap-2"
              >
                <ShoppingCart size={13} />
                ${pack.amount_cad.toFixed(2)} CAD
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── Per-run coin powerups (local) ─────────────────────── */}
      <section aria-labelledby="coin-heading">
        <h2
          id="coin-heading"
          className="text-[10px] uppercase tracking-[0.25em] text-muted font-bold mb-3"
        >
          Per-run powerups · spend coins
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {COIN_ITEMS.map((item) => {
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
                    onClick={() => buyCoinItem(item)}
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
      </section>
    </div>
  );
};

export default Shop;
