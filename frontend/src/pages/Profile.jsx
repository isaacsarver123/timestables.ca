import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Plus, Search, UserPlus, Lock } from "lucide-react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AvatarSVG from "@/components/AvatarSVG";

export default function Profile() {
  const { user, refresh } = useAuth();
  const [me, setMe] = useState(null);
  const [editing, setEditing] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [suggestions, setSuggestions] = useState([]);

  useEffect(() => {
    api.get("/profile/me").then((r) => setMe(r.data)).catch(() => {});
    api.get("/profile/suggestions").then((r) => setSuggestions(r.data.suggestions)).catch(() => {});
  }, []);

  if (!me) return <div className="text-muted text-sm">Loading…</div>;

  const refreshAll = async () => {
    const r1 = await api.get("/profile/me"); setMe(r1.data);
    const r2 = await api.get("/profile/suggestions"); setSuggestions(r2.data.suggestions);
    await refresh();
  };

  return (
    <div className="max-w-3xl mx-auto" data-testid="profile-page">
      {/* Purple banner header */}
      <div
        className="brut-border brut-shadow relative px-5 sm:px-7 pt-7 pb-16 text-white"
        style={{ background: "linear-gradient(135deg, #7C3AED 0%, #6D28D9 60%, #4C1D95 100%)" }}
        data-testid="profile-header"
      >
        <button
          onClick={() => setEditing(true)}
          data-testid="profile-edit"
          className="absolute right-4 top-4 brut-border-soft bg-white/15 backdrop-blur px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-white/25"
        >
          <Pencil size={11} className="inline -mt-0.5 mr-1" /> Edit
        </button>

        <div className="flex flex-col items-center text-center">
          <Link to="/profile/avatar" data-testid="profile-avatar-link" className="relative">
            <AvatarSVG config={me.avatar} size={120} />
            <span className="absolute bottom-0 right-0 brut-border bg-white text-zinc-950 grid place-items-center w-8 h-8 text-xs font-bold">
              <Pencil size={13} />
            </span>
          </Link>
          <div className="mt-4 font-black text-2xl sm:text-3xl tracking-tight" data-testid="profile-name">
            {me.name}
          </div>
          {me.username ? (
            <div className="text-white/70 text-sm mt-0.5" data-testid="profile-handle">@{me.username}</div>
          ) : (
            <div className="text-white/60 text-xs mt-1 italic">Set a username to be findable</div>
          )}
          {me.bio && <div className="text-white/85 text-sm mt-2 max-w-md" data-testid="profile-bio">{me.bio}</div>}

          <div className="flex gap-6 mt-4 text-sm">
            <div className="text-center" data-testid="profile-following">
              <div className="font-bold text-2xl tabular-nums">{me.following}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Following</div>
            </div>
            <div className="text-center" data-testid="profile-followers">
              <div className="font-bold text-2xl tabular-nums">{me.followers}</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/70">Followers</div>
            </div>
          </div>

          <button
            onClick={() => setShowAdd(true)}
            data-testid="profile-add-friends"
            className="mt-5 bg-white text-purple-700 brut-border font-bold uppercase tracking-wider text-xs px-5 py-2.5 hover:bg-purple-50 flex items-center gap-2"
          >
            <Plus size={14} /> Add Friends
          </button>
        </div>
      </div>

      {/* Friend Suggestions */}
      <section className="mt-7" data-testid="profile-suggestions">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Friend Suggestions</h2>
        </div>
        {suggestions.length === 0 ? (
          <div className="text-xs text-muted text-center py-6 brut-border-soft surface-2">
            No suggestions right now — try the Add Friends search.
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map((s) => (
              <SuggestionRow key={s.id} user={s} onAction={refreshAll} />
            ))}
          </div>
        )}
      </section>

      {editing && (
        <EditProfileModal
          me={me}
          onClose={() => setEditing(false)}
          onSaved={async () => { setEditing(false); await refreshAll(); }}
        />
      )}
      {showAdd && (
        <AddFriendsModal
          onClose={() => setShowAdd(false)}
          onAction={refreshAll}
        />
      )}
    </div>
  );
}

const SuggestionRow = ({ user, onAction }) => {
  const [busy, setBusy] = useState(false);
  const follow = async () => {
    if (!user.username) {
      toast.error("This user hasn't set a username yet");
      return;
    }
    setBusy(true);
    try {
      await api.post(`/u/${user.username}/follow`);
      toast.success(`Followed ${user.name}`);
      onAction();
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Couldn't follow");
    } finally { setBusy(false); }
  };
  return (
    <div className="surface brut-border p-3 flex items-center gap-3" data-testid={`suggestion-${user.id}`}>
      <Link to={user.username ? `/u/${user.username}` : "#"} className="shrink-0">
        <AvatarSVG config={user.avatar} size={48} />
      </Link>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-fg truncate">{user.name}</div>
        {user.username && <div className="text-xs text-muted truncate">@{user.username}</div>}
      </div>
      <button
        onClick={follow}
        disabled={busy}
        data-testid={`suggestion-follow-${user.id}`}
        className="brut-border-soft bg-purple-600 text-white px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
      >
        <UserPlus size={12} /> Follow
      </button>
    </div>
  );
};

const EditProfileModal = ({ me, onClose, onSaved }) => {
  const [name, setName] = useState(me.name);
  const [username, setUsername] = useState(me.username || "");
  const [bio, setBio] = useState(me.bio || "");
  const [isPrivate, setIsPrivate] = useState(!!me.is_private);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/profile", { name, username: username || undefined, bio, is_private: isPrivate });
      toast.success("Profile saved");
      onSaved();
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Save failed");
    } finally { setBusy(false); }
  };

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm p-4" data-testid="profile-edit-modal">
      <div onClick={(e) => e.stopPropagation()} className="surface brut-border brut-shadow w-full max-w-md p-5 space-y-4">
        <h3 className="font-bold text-fg text-lg">Edit profile</h3>
        <Field label="Name" value={name} onChange={setName} testid="profile-edit-name" />
        <Field label="Username (3–20, a-z 0-9 _)" value={username} onChange={(v) => setUsername(v.toLowerCase().replace(/[^a-z0-9_]/g, ""))} testid="profile-edit-username" prefix="@" />
        <Field label="Bio" value={bio} onChange={setBio} testid="profile-edit-bio" multiline />
        <label className="flex items-center gap-2 text-sm text-fg">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} data-testid="profile-edit-private" />
          <Lock size={12} /> Private profile (people can't follow you)
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 brut-border surface-2 text-fg px-3 py-2.5 text-xs font-bold uppercase tracking-wider">Cancel</button>
          <button onClick={save} disabled={busy} data-testid="profile-edit-save" className="flex-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs px-3 py-2.5 hover:bg-blue-600 hover:text-white disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
};

const AddFriendsModal = ({ onClose, onAction }) => {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (q.length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/profile/search?q=${encodeURIComponent(q)}`);
        setResults(data.results);
      } catch { /* */ }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm p-4" data-testid="add-friends-modal">
      <div onClick={(e) => e.stopPropagation()} className="surface brut-border brut-shadow w-full max-w-md p-5 space-y-3">
        <h3 className="font-bold text-fg text-lg">Add friends</h3>
        <div className="brut-border surface-2 flex items-center gap-2 px-3 py-2">
          <Search size={14} className="text-muted" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search username or name…" data-testid="add-friends-search" className="flex-1 bg-transparent focus:outline-none text-sm text-fg" />
        </div>
        <div className="space-y-1.5 max-h-72 overflow-y-auto">
          {results.length === 0 && q.length >= 2 && <div className="text-xs text-muted text-center py-4">No matches.</div>}
          {results.map((u) => <SuggestionRow key={u.id} user={u} onAction={onAction} />)}
        </div>
        <button onClick={onClose} className="w-full brut-border surface-2 text-fg px-3 py-2 text-xs font-bold uppercase tracking-wider">Done</button>
      </div>
    </div>
  );
};

const Field = ({ label, value, onChange, testid, multiline, prefix }) => (
  <label className="block">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-1.5">{label}</div>
    <div className={`brut-border surface-2 flex items-center px-3 py-2 ${multiline ? "py-1" : ""}`}>
      {prefix && <span className="font-mono text-muted text-sm mr-1">{prefix}</span>}
      {multiline ? (
        <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="flex-1 bg-transparent focus:outline-none text-fg text-sm resize-y" />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} data-testid={testid} className="flex-1 bg-transparent focus:outline-none text-fg text-sm" />
      )}
    </div>
  </label>
);
