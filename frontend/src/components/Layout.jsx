import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { Coins, Sparkles, BarChart3, Store, Home as HomeIcon } from "lucide-react";
import { getState, subscribe, progressToNextLevel } from "@/lib/storage";

export const Layout = ({ children }) => {
  const [state, setState] = useState(getState());
  const location = useLocation();

  useEffect(() => {
    const unsub = subscribe(() => setState(getState()));
    return () => unsub();
  }, []);

  const { level, pct } = progressToNextLevel(state.xp);

  const navItems = [
    { to: "/", label: "Play", icon: HomeIcon, testid: "nav-home" },
    { to: "/stats", label: "Stats", icon: BarChart3, testid: "nav-stats" },
    { to: "/shop", label: "Shop", icon: Store, testid: "nav-shop" },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-40 bg-white border-b-2 border-zinc-900"
        data-testid="app-header"
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 group" data-testid="brand-link">
            <div className="w-10 h-10 brut-border bg-zinc-950 text-white grid place-items-center font-black font-mono text-lg group-hover:bg-blue-600 transition-colors">
              ×
            </div>
            <div className="leading-none">
              <div className="font-black tracking-tighter text-lg sm:text-xl">TIMES.ARENA</div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-zinc-500 font-bold">
                Math · Reps · Mastery
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-2" data-testid="main-nav">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-testid={item.testid}
                  className={`flex items-center gap-2 px-4 py-2 brut-border font-bold text-sm transition-all ${
                    active
                      ? "bg-zinc-950 text-white"
                      : "bg-white hover:bg-zinc-100"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <div
              className="flex items-center gap-2 px-3 py-2 brut-border bg-amber-300"
              data-testid="hud-coins"
            >
              <Coins size={16} className="text-zinc-900" />
              <span className="font-mono font-bold text-sm tabular-nums">
                {state.coins}
              </span>
            </div>
            <div
              className="hidden sm:flex items-center gap-2 px-3 py-2 brut-border bg-white"
              data-testid="hud-level"
            >
              <Sparkles size={14} className="text-blue-600" />
              <span className="font-mono font-bold text-xs">LV {level}</span>
              <div className="w-16 h-2 bg-zinc-200 brut-border overflow-hidden">
                <div
                  className="h-full bg-blue-600"
                  style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Mobile nav */}
        <div className="md:hidden border-t-2 border-zinc-900 bg-white" data-testid="mobile-nav">
          <div className="max-w-7xl mx-auto px-5 py-2 flex justify-between gap-2">
            {navItems.map((item) => {
              const active = location.pathname === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  data-testid={`m-${item.testid}`}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 brut-border font-bold text-xs ${
                    active ? "bg-zinc-950 text-white" : "bg-white"
                  }`}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-5 sm:px-8 py-8 sm:py-12">
        {children}
      </main>

      <footer className="border-t-2 border-zinc-900 bg-white">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-4 flex justify-between items-center text-xs font-bold text-zinc-500 uppercase tracking-widest">
          <span>v1 · Local Save</span>
          <span className="font-mono">x · ÷ · =</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
