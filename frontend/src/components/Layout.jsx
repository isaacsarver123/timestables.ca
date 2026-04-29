import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  Coins,
  BarChart3,
  Store,
  Home as HomeIcon,
  BookOpen,
  CalendarCheck,
  Volume2,
  VolumeX,
  Sun,
  Moon,
  Settings as SettingsIcon,
  Flame,
  LogIn,
  User as UserIcon,
  ShieldCheck,
  GraduationCap,
  Gem,
} from "lucide-react";
import {
  getState,
  subscribe,
  progressToNextLevel,
  setSoundOn,
  setTheme,
} from "@/lib/storage";
import { setSoundEnabled } from "@/lib/sound";
import { useAuth } from "@/lib/auth";
import TrialBanner from "@/components/TrialBanner";
import { loadCms, subscribeCms, getCmsCached } from "@/lib/cms";

// Compact a count for the header pills:
//   0–9999      → exact ("1023")
//   10k–999k    → "12k"
//   1m+         → "1.2m"
// Keeps the HUD width predictable when coin balances climb.
function formatCount(n) {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  if (v < 10000) return v.toLocaleString();
  if (v < 1_000_000) return `${Math.floor(v / 1000)}k`;
  if (v < 10_000_000) return `${(v / 1_000_000).toFixed(1)}m`;
  return `${Math.floor(v / 1_000_000)}m`;
}

export const Layout = ({ children }) => {
  const [state, setState] = useState(getState());
  const location = useLocation();
  const { user } = useAuth();
  const [footerText, setFooterText] = useState(
    () => (getCmsCached()?.footer_text || "timestables.ca · v5")
  );
  useEffect(() => {
    loadCms().then((d) => {
      if (d?.footer_text) setFooterText(d.footer_text);
    });
    const off = subscribeCms((d) => {
      if (d?.footer_text) setFooterText(d.footer_text);
    });
    return () => off();
  }, []);

  useEffect(() => {
    const unsub = subscribe(() => setState(getState()));
    return () => unsub();
  }, []);

  const { level, pct } = progressToNextLevel(state.xp);
  const isAuthed = !!user; // user object means signed in
  const isAdmin = !!user?.is_admin;

  const navItems = [
    { to: "/", label: "Play", icon: HomeIcon, testid: "nav-home" },
    { to: "/lessons", label: "Lesson", icon: GraduationCap, testid: "nav-lessons" },
    { to: "/learn", label: "Learn", icon: BookOpen, testid: "nav-learn" },
    { to: "/play/daily", label: "Daily", icon: CalendarCheck, testid: "nav-daily" },
    { to: "/stats", label: "Stats", icon: BarChart3, testid: "nav-stats" },
    { to: "/shop", label: "Shop", icon: Store, testid: "nav-shop" },
    { to: "/profile", label: "Profile", icon: UserIcon, testid: "nav-profile" },
  ];
  if (isAdmin) {
    navItems.push({ to: "/admin", label: "Admin", icon: ShieldCheck, testid: "nav-admin" });
  }

  const toggleSound = () => {
    const next = !state.soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };
  const toggleTheme = () => setTheme(state.theme === "dark" ? "light" : "dark");

  return (
    <div className="min-h-screen flex flex-col">
      <header
        className="sticky top-0 z-40 surface brut-border-soft border-t-0 border-x-0"
        data-testid="app-header"
      >
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <Link to={isAuthed ? "/" : "/login"} className="flex items-center gap-2.5 group" data-testid="brand-link">
            <div className="w-9 h-9 brut-border surface grid place-items-center font-mono font-bold text-base group-hover:bg-blue-600 group-hover:text-white transition-colors">
              ×
            </div>
            <div className="leading-[0.95]">
              <div className="font-bold tracking-tight text-base sm:text-lg text-fg whitespace-nowrap">
                Times<span className="hidden sm:inline"> </span><br className="sm:hidden" />Tables<span className="text-blue-600">.ca</span>
              </div>
            </div>
          </Link>

          {isAuthed && (
            <nav className="hidden md:flex items-center gap-1" data-testid="main-nav">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-testid={item.testid}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium text-sm transition-colors ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-muted hover:text-fg hover:surface-2"
                    }`}
                  >
                    <Icon size={15} />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="flex items-center gap-1 min-w-0 shrink-0">
            {isAuthed && state.dailyStreak?.count > 0 && (
              <div
                className="flex items-center gap-0.5 px-1.5 py-1 brut-border bg-amber-300 text-zinc-950"
                data-testid="hud-streak"
                title={`${state.dailyStreak.count}-day Daily streak`}
              >
                <Flame size={12} />
                <span className="font-mono text-[11px] font-bold tabular-nums">
                  {formatCount(state.dailyStreak.count)}
                </span>
              </div>
            )}
            <button
              onClick={toggleTheme}
              data-testid="toggle-theme"
              className="p-1.5 rounded-md text-muted hover:text-fg hover:surface-2 transition-colors"
              aria-label="Toggle theme"
              title={state.theme === "dark" ? "Switch to light" : "Switch to dark"}
            >
              {state.theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
            {isAuthed && (
              <button
                onClick={toggleSound}
                data-testid="toggle-sound"
                className="p-1.5 rounded-md text-muted hover:text-fg hover:surface-2 transition-colors"
                aria-label="Toggle sound"
                title={state.soundOn ? "Sound on" : "Sound off"}
              >
                {state.soundOn ? <Volume2 size={14} /> : <VolumeX size={14} />}
              </button>
            )}
            {isAuthed && (
              <>
                <Link
                  to="/shop"
                  className="flex items-center gap-1 px-1.5 py-1 brut-border surface hover:bg-amber-100 dark:hover:bg-amber-950/40 hover:-translate-y-px transition-all"
                  data-testid="hud-coins"
                  title={`${state.coins.toLocaleString()} coins · go to Shop`}
                  aria-label="Open Shop"
                >
                  <Coins size={12} className="text-amber-500 shrink-0" />
                  <span className="font-mono text-[11px] tabular-nums text-fg font-semibold">
                    {formatCount(state.coins)}
                  </span>
                </Link>
                <Link
                  to="/shop"
                  className="flex items-center gap-1 px-1.5 py-1 brut-border surface hover:bg-cyan-100 dark:hover:bg-cyan-950/40 hover:-translate-y-px transition-all"
                  data-testid="hud-gems"
                  title={`${(user?.gems ?? 0).toLocaleString()} gems · go to Shop`}
                  aria-label="Open Shop"
                >
                  <Gem size={12} className="text-cyan-500 shrink-0" />
                  <span className="font-mono text-[11px] tabular-nums text-fg font-semibold">
                    {formatCount(user?.gems ?? 0)}
                  </span>
                </Link>
                <Link
                  to="/settings"
                  data-testid="hud-user"
                  title={`${user.name} · ${user.email}`}
                  aria-label="Profile / settings"
                  className={`flex items-center gap-1 px-1.5 py-1 brut-border ${
                    isAdmin ? "bg-amber-300 text-zinc-950" : "surface"
                  } hover:bg-blue-600 hover:text-white`}
                >
                  {isAdmin ? <ShieldCheck size={12} /> : <UserIcon size={12} />}
                  <span className="hidden xl:inline font-mono text-[11px] font-semibold max-w-[80px] truncate">
                    {user.name}
                  </span>
                </Link>
                <Link
                  to="/settings"
                  data-testid="hud-settings"
                  title="Settings"
                  aria-label="Settings"
                  className="p-1.5 rounded-md text-muted hover:text-fg hover:surface-2 transition-colors"
                >
                  <SettingsIcon size={14} />
                </Link>
              </>
            )}
            {user === null && (
              <Link
                to="/login"
                data-testid="hud-login"
                className="flex items-center gap-1.5 px-2.5 py-1.5 brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 hover:bg-blue-600 hover:text-white text-xs font-bold uppercase tracking-wider"
              >
                <LogIn size={13} /> Sign in
              </Link>
            )}
          </div>
        </div>

        {/* Mobile nav — only when authed */}
        {isAuthed && (
          <div className="md:hidden brut-border-soft border-x-0 border-b-0" data-testid="mobile-nav">
            <div className="max-w-6xl mx-auto px-2 py-2 flex justify-between gap-1 overflow-x-auto">
              {navItems.map((item) => {
                const active = location.pathname === item.to;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    data-testid={`m-${item.testid}`}
                    className={`flex-1 min-w-[60px] flex flex-col items-center gap-1 py-1.5 rounded-md text-[11px] font-medium ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                        : "text-muted"
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-5 sm:px-8 py-8 sm:py-10">
        {isAuthed && <TrialBanner />}
        {children}
      </main>

      <footer className="brut-border-soft border-x-0 border-b-0 surface">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex justify-between items-center text-[11px] text-muted font-mono">
          <span data-testid="footer-text">{footerText}</span>
          <span>×  ÷  =</span>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
