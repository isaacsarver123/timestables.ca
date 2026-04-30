import { Link, useLocation, useNavigate } from "react-router-dom";
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
  Zap,
  Bell,
  Sparkles,
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
import { requestGuardedNav } from "@/lib/leaveGuard";
import TrialBanner from "@/components/TrialBanner";
import { loadCms, subscribeCms, getCmsCached } from "@/lib/cms";
import { api } from "@/lib/api";
import { toast } from "sonner";

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

// XP Boost HUD pill — only rendered while a boost is active. Shows "2× MM:SS"
// with a live countdown that ticks every second and hides itself on expiry.
function XpBoostPill({ boostUntil, active }) {
  const [secs, setSecs] = useState(() => {
    if (!boostUntil) return 0;
    const ms = new Date(boostUntil).getTime() - Date.now();
    return Math.max(0, Math.floor(ms / 1000));
  });
  useEffect(() => {
    if (!boostUntil) { setSecs(0); return; }
    const compute = () => {
      const ms = new Date(boostUntil).getTime() - Date.now();
      setSecs(Math.max(0, Math.floor(ms / 1000)));
    };
    compute();
    const id = setInterval(compute, 1000);
    return () => clearInterval(id);
  }, [boostUntil]);
  if (!active || secs <= 0) return null;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  const txt = `2× ${m}:${String(s).padStart(2, "0")}`;
  return (
    <Link
      to="/shop"
      data-testid="hud-xp-boost"
      title={`XP Boost active — ${txt}`}
      aria-label="XP Boost active"
      className="flex items-center gap-1 px-1.5 py-1 brut-border bg-violet-500 text-white hover:-translate-y-px transition-all"
    >
      <Zap size={12} className="shrink-0" />
      <span className="font-mono text-[11px] tabular-nums font-semibold">{txt}</span>
    </Link>
  );
}

export const Layout = ({ children }) => {
  const [state, setState] = useState(getState());
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [footerText, setFooterText] = useState(
    () => (getCmsCached()?.footer_text || "timestables.ca · v5")
  );
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [pendingInvite, setPendingInvite] = useState(null);
  const [showTour, setShowTour] = useState(false);
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

  useEffect(() => {
    if (!user) {
      setUnreadNotifications(0);
      setPendingInvite(null);
      return;
    }
    let live = true;
    api.get("/notifications?limit=12").then(({ data }) => {
      if (!live) return;
      setUnreadNotifications(data?.unread_count || 0);
      const invite = (data?.items || []).find((item) => item.unread && item.kind === "family_invite");
      setPendingInvite(invite || null);
    }).catch(() => {});
    return () => { live = false; };
  }, [user]);

  useEffect(() => {
    if (!user?.id || !user?.created_at) return;
    const seenKey = `tt-tour-seen:${user.id}`;
    if (localStorage.getItem(seenKey) === "1") return;
    const ageMs = Date.now() - new Date(user.created_at).getTime();
    if (ageMs >= 0 && ageMs < 15 * 60 * 1000) setShowTour(true);
  }, [user?.id, user?.created_at]);

  const markTourSeen = () => {
    if (user?.id) localStorage.setItem(`tt-tour-seen:${user.id}`, "1");
    setShowTour(false);
  };

  const dismissInvitePrompt = async () => {
    setPendingInvite(null);
  };

  const acceptInvitePrompt = async () => {
    const inviteId = pendingInvite?.data?.invite_id;
    if (!inviteId) return;
    try {
      await api.post(`/family/invites/${inviteId}/accept`);
      toast.success("Family invite accepted");
      setUnreadNotifications((n) => Math.max(0, n - 1));
      setPendingInvite(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not accept invite");
    }
  };

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
    { to: "/notifications", label: "Notifications", icon: Bell, testid: "nav-notifications" },
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
                    onClick={(e) => {
                      // If a lesson-nav guard is armed, let the active page
                      // intercept and show its confirmation modal.
                      e.preventDefault();
                      requestGuardedNav(item.to, () => navigate(item.to));
                    }}
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
                <XpBoostPill boostUntil={user?.xp_boost_until} active={user?.xp_boost_active} />
                <Link
                  to="/notifications"
                  data-testid="hud-notifications"
                  title={unreadNotifications > 0 ? `${unreadNotifications} unread notifications` : "Notifications"}
                  aria-label="Notifications"
                  className={`relative flex items-center gap-1 px-1.5 py-1 brut-border ${
                    unreadNotifications > 0 ? "bg-blue-600 text-white" : (isAdmin ? "bg-amber-300 text-zinc-950" : "surface")
                  } hover:bg-blue-600 hover:text-white`}
                >
                  <Bell size={12} />
                  {unreadNotifications > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] leading-[18px] text-center font-bold brut-border border-white dark:border-zinc-950">
                      {unreadNotifications > 9 ? "9+" : unreadNotifications}
                    </span>
                  )}
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

      {showTour && <WelcomeTourModal onClose={markTourSeen} />}
      {pendingInvite && (
        <FamilyInviteModal
          invite={pendingInvite}
          onAccept={acceptInvitePrompt}
          onLater={dismissInvitePrompt}
        />
      )}

      <footer className="brut-border-soft border-x-0 border-b-0 surface overflow-x-hidden">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-3 flex flex-wrap justify-between items-center gap-2 text-[11px] text-muted font-mono min-w-0">
          <span data-testid="footer-text" className="min-w-0 break-words">{footerText}</span>
          <span className="shrink-0">×  ÷  =</span>
        </div>
      </footer>
    </div>
  );
};

const WelcomeTourModal = ({ onClose }) => (
  <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm p-4 grid place-items-center">
    <div className="w-full max-w-lg surface brut-border p-6 space-y-4">
      <div className="flex items-center gap-2 text-blue-600">
        <Sparkles size={18} />
        <span className="text-xs font-bold uppercase tracking-[0.25em]">Welcome tour</span>
      </div>
      <div>
        <h3 className="text-2xl font-black tracking-tight text-fg">You’re in. Here’s the quick tour.</h3>
        <p className="text-sm text-muted mt-2">This only shows once for new accounts.</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-3 text-sm">
        <TourCard title="Play" body="Quick games, daily challenges, boss fights, and your regular practice flow." />
        <TourCard title="Lessons" body="Guided lesson path with visual questions, checkpoints, and tests." />
        <TourCard title="Shop + stats" body="Use coins and gems, track streaks, and see how fast you’re improving." />
        <TourCard title="Profile + notifications" body="Set your username, add friends, and watch for family-plan invites." />
      </div>
      <button
        onClick={onClose}
        className="w-full brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-4 py-3 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white"
      >
        Got it
      </button>
    </div>
  </div>
);

const TourCard = ({ title, body }) => (
  <div className="brut-border-soft surface-2 p-3">
    <div className="font-bold text-fg">{title}</div>
    <div className="text-muted text-xs mt-1 leading-relaxed">{body}</div>
  </div>
);

const FamilyInviteModal = ({ invite, onAccept, onLater }) => (
  <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm p-4 grid place-items-center">
    <div className="w-full max-w-md surface brut-border p-6 space-y-4">
      <div className="flex items-center gap-2 text-blue-600">
        <Bell size={18} />
        <span className="text-xs font-bold uppercase tracking-[0.25em]">Family invite</span>
      </div>
      <div>
        <h3 className="text-xl font-black tracking-tight text-fg">You’ve been invited</h3>
        <p className="text-sm text-muted mt-2">{invite?.body || "You have a pending family invite."}</p>
      </div>
      <div className="flex gap-2">
        <button onClick={onLater} className="flex-1 brut-border surface-2 text-fg px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700">
          Later
        </button>
        <button onClick={onAccept} className="flex-1 brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white">
          Accept invite
        </button>
      </div>
    </div>
  </div>
);

export default Layout;
