import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import AvatarSVG, { DEFAULT_AVATAR, AVATAR_OPTIONS } from "@/components/AvatarSVG";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const TABS = [
  { key: "skin",       label: "Body" },
  { key: "bg",         label: "Background" },
  { key: "hair",       label: "Hair" },
  { key: "hairColor",  label: "Hair color" },
  { key: "expression", label: "Expression" },
  { key: "glasses",    label: "Glasses" },
  { key: "hat",        label: "Hat" },
];

export default function AvatarEditor() {
  const { user, refresh } = useAuth();
  const nav = useNavigate();
  const [config, setConfig] = useState({ ...DEFAULT_AVATAR, ...(user?.avatar || {}) });
  const [tab, setTab] = useState("skin");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user?.avatar) setConfig({ ...DEFAULT_AVATAR, ...user.avatar });
  }, [user]);

  const set = (k, v) => setConfig((c) => ({ ...c, [k]: v }));
  const randomize = () => {
    const next = {};
    for (const k of Object.keys(AVATAR_OPTIONS)) {
      const arr = AVATAR_OPTIONS[k];
      next[k] = arr[Math.floor(Math.random() * arr.length)];
    }
    setConfig(next);
  };

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/profile", { avatar: config });
      toast.success("Avatar saved");
      await refresh();
      nav("/profile");
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-2xl mx-auto" data-testid="avatar-editor-page">
      <button onClick={() => nav("/profile")} data-testid="avatar-back" className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1">
        <ArrowLeft size={12} /> Back
      </button>
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2 mb-4">Create Avatar</h1>

      <div className="flex flex-col items-center mb-5">
        <div className="brut-border-soft p-3" data-testid="avatar-preview">
          <AvatarSVG config={config} size={180} />
        </div>
        <button onClick={randomize} data-testid="avatar-randomize" className="mt-3 brut-border-soft surface-2 text-fg px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white flex items-center gap-1.5">
          <RefreshCw size={12} /> Randomize
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 brut-border surface p-1.5 overflow-x-auto" data-testid="avatar-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-testid={`avatar-tab-${t.key}`}
            className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider shrink-0 ${
              tab === t.key
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
                : "text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Option grid */}
      <div className="surface brut-border p-4 mt-3 grid grid-cols-3 sm:grid-cols-4 gap-2.5" data-testid="avatar-options">
        {AVATAR_OPTIONS[tab].map((opt) => {
          const preview = { ...config, [tab]: opt };
          const active = config[tab] === opt;
          return (
            <button
              key={opt}
              onClick={() => set(tab, opt)}
              data-testid={`avatar-opt-${tab}-${opt}`}
              className={`brut-border-soft p-2 transition-colors flex flex-col items-center gap-1 ${
                active
                  ? "bg-purple-600 text-white"
                  : "surface-2 text-fg hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <AvatarSVG config={preview} size={56} />
              <span className="text-[10px] font-bold uppercase tracking-wider">{opt}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2">
        <button onClick={() => nav("/profile")} className="brut-border surface-2 text-fg px-3 py-2.5 text-xs font-bold uppercase tracking-wider">
          Cancel
        </button>
        <button onClick={save} disabled={busy} data-testid="avatar-save" className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs px-3 py-2.5 hover:bg-blue-600 hover:text-white disabled:opacity-50 flex items-center justify-center gap-2">
          <Save size={13} /> {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
