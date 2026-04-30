import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bell, CheckCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

export default function Notifications() {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    const { data } = await api.get("/notifications?limit=50");
    setItems(data?.items || []);
    setUnread(data?.unread_count || 0);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  const readOne = async (id) => {
    setBusyId(id);
    try {
      await api.post(`/notifications/${id}/read`);
      await load();
    } finally {
      setBusyId("");
    }
  };

  const acceptInvite = async (note) => {
    const inviteId = note?.data?.invite_id;
    if (!inviteId) return;
    setBusyId(note.id);
    try {
      await api.post(`/family/invites/${inviteId}/accept`);
      toast.success("Family invite accepted");
      await load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not accept invite");
    } finally {
      setBusyId("");
    }
  };

  const readAll = async () => {
    try {
      await api.post("/notifications/read-all");
      await load();
    } catch {
      toast.error("Could not mark notifications as read");
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" data-testid="notifications-page">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1">
            <ArrowLeft size={12} /> Back
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-2">Notifications</h1>
          <p className="text-sm text-muted mt-1">Invites, updates, and account notices.</p>
        </div>
        {unread > 0 && (
          <button onClick={readAll} className="brut-border surface-2 text-fg px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 flex items-center gap-2">
            <CheckCheck size={14} /> Mark all read
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="surface brut-border p-8 text-center text-muted">
          <Bell size={20} className="mx-auto mb-3" />
          Nothing here yet.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((note) => {
            const isInvite = note.kind === "family_invite";
            const busy = busyId === note.id;
            return (
              <div key={note.id} className={`surface brut-border p-4 ${note.unread ? "border-blue-500" : ""}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={`w-10 h-10 brut-border grid place-items-center ${isInvite ? "bg-blue-600 text-white" : "surface-2 text-fg"}`}>
                      {isInvite ? <Users size={16} /> : <Bell size={16} />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-fg flex items-center gap-2">
                        {note.title}
                        {note.unread && <span className="text-[10px] uppercase tracking-[0.25em] text-blue-600">New</span>}
                      </div>
                      <div className="text-sm text-muted mt-1 leading-relaxed">{note.body}</div>
                    </div>
                  </div>
                  <div className="text-[11px] text-muted whitespace-nowrap">
                    {note.created_at ? new Date(note.created_at).toLocaleDateString() : ""}
                  </div>
                </div>
                <div className="mt-3 flex gap-2 justify-end">
                  {isInvite && note.unread && (
                    <button disabled={busy} onClick={() => acceptInvite(note)} className="brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white disabled:opacity-50">
                      Accept invite
                    </button>
                  )}
                  {note.unread && (
                    <button disabled={busy} onClick={() => readOne(note.id)} className="brut-border surface-2 text-fg px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50">
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
