import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  RotateCcw,
  AlertTriangle,
  Download,
  Upload,
  Lock,
} from "lucide-react";
import {
  getState,
  subscribe,
  setSoundOn,
  setTheme,
  resetAll,
  resetPreferences,
  resetStats,
} from "@/lib/storage";
import { setSoundEnabled } from "@/lib/sound";

const Settings = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);

  const toggleSound = () => {
    const next = !state.soundOn;
    setSoundOn(next);
    setSoundEnabled(next);
  };
  const toggleTheme = () => setTheme(state.theme === "dark" ? "light" : "dark");

  const confirmAnd = (msg, fn, success) => {
    if (window.confirm(msg)) {
      fn();
      toast.success(success);
    }
  };

  const exportData = () => {
    const data = JSON.stringify(getState(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `times-tables-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Exported");
  };

  const importData = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (parsed && typeof parsed === "object") {
          localStorage.setItem("tt_arena_state_v2", JSON.stringify(parsed));
          window.location.reload();
        } else {
          toast.error("Invalid file");
        }
      } catch {
        toast.error("Could not parse file");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-7 max-w-3xl" data-testid="settings-page">
      <div>
        <Link
          to="/"
          className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
          data-testid="back-link"
        >
          <ArrowLeft size={12} /> Back
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2">Settings</h1>
        <p className="text-sm text-muted mt-1">
          Tweak preferences, manage your data, account features coming soon.
        </p>
      </div>

      {/* Preferences */}
      <section className="surface brut-border p-5 space-y-4" data-testid="settings-preferences">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Preferences
        </h2>
        <Row
          label="Theme"
          sub={state.theme === "dark" ? "Dark mode" : "Light mode"}
          icon={state.theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
        >
          <button
            onClick={toggleTheme}
            data-testid="settings-toggle-theme"
            className="brut-border surface-2 text-fg px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Switch to {state.theme === "dark" ? "Light" : "Dark"}
          </button>
        </Row>
        <Row
          label="Sound effects"
          sub={state.soundOn ? "On" : "Off"}
          icon={state.soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
        >
          <button
            onClick={toggleSound}
            data-testid="settings-toggle-sound"
            className="brut-border surface-2 text-fg px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            Turn {state.soundOn ? "Off" : "On"}
          </button>
        </Row>
      </section>

      {/* Account placeholder */}
      <section className="surface brut-border p-5 space-y-3" data-testid="settings-account">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Account
        </h2>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 brut-border surface-2 grid place-items-center text-muted">
            <Lock size={16} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-fg">Sign-in &amp; sync</div>
            <div className="text-xs text-muted mt-0.5">
              Cross-device save, leaderboards, and subscription tiers are coming soon.
            </div>
          </div>
          <button
            disabled
            data-testid="settings-signin-disabled"
            className="brut-border-soft surface-2 text-muted px-3 py-1.5 text-xs font-bold uppercase tracking-wider cursor-not-allowed"
          >
            Coming soon
          </button>
        </div>
      </section>

      {/* Data */}
      <section className="surface brut-border p-5 space-y-3" data-testid="settings-data">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
          Data
        </h2>
        <div className="grid sm:grid-cols-2 gap-2.5">
          <button
            onClick={exportData}
            data-testid="settings-export"
            className="brut-border surface-2 text-fg p-3 text-left hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-start gap-3"
          >
            <div className="w-9 h-9 brut-border surface grid place-items-center text-fg">
              <Download size={16} />
            </div>
            <div>
              <div className="font-bold text-sm">Export</div>
              <div className="text-xs text-muted">Download your save as a JSON file</div>
            </div>
          </button>
          <label
            className="brut-border surface-2 text-fg p-3 text-left hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-start gap-3 cursor-pointer"
            data-testid="settings-import"
          >
            <div className="w-9 h-9 brut-border surface grid place-items-center text-fg">
              <Upload size={16} />
            </div>
            <div>
              <div className="font-bold text-sm">Import</div>
              <div className="text-xs text-muted">Replace state from a JSON file</div>
            </div>
            <input
              type="file"
              accept="application/json"
              className="hidden"
              onChange={importData}
            />
          </label>
        </div>
      </section>

      {/* Reset */}
      <section className="surface brut-border p-5 space-y-3" data-testid="settings-reset">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium flex items-center gap-2">
          <AlertTriangle size={12} className="text-amber-600" /> Reset
        </h2>
        <ResetRow
          label="Reset preferences"
          sub="Theme, sound, operation, answer style, selected tables"
          testid="reset-preferences"
          onClick={() =>
            confirmAnd(
              "Reset preferences to defaults? Your stats and coins will be kept.",
              resetPreferences,
              "Preferences reset"
            )
          }
        />
        <ResetRow
          label="Reset stats"
          sub="Coins, XP, streaks, history, daily, boss progression"
          testid="reset-stats"
          onClick={() =>
            confirmAnd(
              "Reset all stats and progress? Preferences will be kept.",
              resetStats,
              "Stats reset"
            )
          }
        />
        <ResetRow
          label="Reset everything"
          danger
          sub="Wipe all data — stats AND preferences"
          testid="reset-all"
          onClick={() =>
            confirmAnd(
              "WIPE EVERYTHING? This cannot be undone.",
              resetAll,
              "All data cleared"
            )
          }
        />
      </section>
    </div>
  );
};

const Row = ({ label, sub, icon, children }) => (
  <div className="flex items-center gap-3 py-1">
    <div className="w-9 h-9 brut-border surface-2 grid place-items-center text-fg">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-bold text-fg text-sm">{label}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
    {children}
  </div>
);

const ResetRow = ({ label, sub, onClick, testid, danger }) => (
  <div
    className={`flex items-center gap-3 brut-border-soft p-3 ${
      danger ? "bg-red-50 dark:bg-red-950/30" : ""
    }`}
  >
    <div
      className={`w-9 h-9 brut-border grid place-items-center ${
        danger ? "bg-red-500 text-white" : "surface-2 text-fg"
      }`}
    >
      <RotateCcw size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="font-bold text-fg text-sm">{label}</div>
      <div className="text-xs text-muted">{sub}</div>
    </div>
    <button
      onClick={onClick}
      data-testid={testid}
      className={`brut-border px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
        danger
          ? "bg-red-500 text-white hover:bg-red-600"
          : "surface-2 text-fg hover:bg-zinc-200 dark:hover:bg-zinc-700"
      }`}
    >
      {danger ? "Wipe" : "Reset"}
    </button>
  </div>
);

export default Settings;
