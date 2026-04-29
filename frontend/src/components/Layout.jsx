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
import { api } from "@/lib/api";

export const Layout = ({ children }) => {
  const [state, setState] = useState(getState());
  const location = useLocation();
  const { user } = useAuth();
  const [footerText, setFooterText] = useState("timestables.ca · v3");
  useEffect(() => {
    api.get("/cms/public").then((r) => {
      if (r.data?.footer_text) setFooterText(r.data.footer_text);
    }).catch(() => {});
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
    { to: "/learn", label: "Learn", icon: BookOpen, testid: "nav-learn" },
    { to: "/play/daily", label: "Daily", icon: CalendarCheck, testid: "nav-daily" },
    { to: "/stats", label: "Stats", icon: BarChart3, testid: "nav-stats" },
    { to: "/shop", label: "Shop", icon: Store, testid: "nav-shop" },
    { to: "/settings", label: "Settings", icon: SettingsIcon, testid: "nav-settings" },
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

          <div className="flex items-center gap-1.5">
            {isAuthed && state.dailyStreak?.count > 0 && (
              <div
                className="flex items-center gap-1 px-2 py-1.5 brut-border bg-amber-300 text-zinc-950"
                data-testid="hud-streak"
                title={`${state.dailyStreak.count}-day Daily streak`}
              >
                <Flame size={13} />
                <span className="font-mono text-xs font-bold tabular-nums">
                  {state.dailyStreak.count}
                </span>
              </div>
            )}
            <button
              onClick={toggleTheme}
              data-testid="toggle-theme"
              className="p-2 rounded-md text-muted hover:text-fg hover:surface-2 transition-colors"
              aria-label="Toggle theme"
              title={state.theme === "dark" ? "Switch to light" : "Switch to dark"}
            >
              {state.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {isAuthed && (
              <button
                onClick={toggleSound}
                data-testid="toggle-sound"
                className="p-2 rounded-md text-muted hover:text-fg hover:surface-2 transition-colors"
                aria-label="Toggle sound"
                title={state.soundOn ? "Sound on" : "Sound off"}
              >
                {state.soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
              </button>
            )}
            {isAuthed && (
              <>
                <div
                  className="flex items-center gap-1.5 px-2.5 py-1.5 brut-border surface"
                  data-testid="hud-coins"
                >
                  <Coins size={14} className="text-amber-500" />
                  <span className="font-mono text-sm tabular-nums text-fg font-semibold">
                    {state.coins}
                  </span>
                </div>
                <div
                  className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 brut-border surface min-w-[68px]"
                  data-testid="hud-level"
                >
                  <span className="font-mono text-xs text-muted tabular-nums">L{Math.min(level, 9999)}</span>
                  <div className="w-10 h-1 surface-2 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600"
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                </div>
                <Link
                  to="/settings"
                  data-testid="hud-user"
                  title={user.email}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 brut-border ${
                    isAdmin ? "bg-amber-300 text-zinc-950" : "surface"
                  } hover:bg-blue-600 hover:text-white`}
                >
                  {isAdmin ? <ShieldCheck size={13} /> : <UserIcon size={13} />}
                  <span className="hidden sm:inline font-mono text-xs font-semibold max-w-[110px] truncate">
                    {user.name}
                  </span>
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
