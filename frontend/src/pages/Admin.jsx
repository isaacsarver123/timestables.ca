import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  ArrowLeft,
  Users,
  TrendingUp,
  DollarSign,
  Receipt,
  Search,
  Save,
  Megaphone,
  ShieldCheck,
  LayoutDashboard,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Admin() {
  const { user } = useAuth();
  const [tab, setTab] = useState("dashboard");

  if (user === undefined) return <div className="text-muted">Loading…</div>;
  if (!user || !user.is_admin) return <Navigate to="/" replace />;

  return (
    <div className="space-y-6" data-testid="admin-page">
      <div>
        <Link
          to="/"
          className="text-xs font-semibold uppercase tracking-widest text-muted hover:text-fg flex items-center gap-1"
          data-testid="admin-back"
        >
          <ArrowLeft size={12} /> Back to app
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <ShieldCheck size={22} className="text-amber-500" />
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg">Admin · {user.name}</h1>
        </div>
      </div>

      <div className="flex gap-2 brut-border surface p-1.5 w-fit" data-testid="admin-tabs">
        <Tab id="dashboard" cur={tab} setCur={setTab} icon={<LayoutDashboard size={14} />} label="Dashboard" />
        <Tab id="users" cur={tab} setCur={setTab} icon={<Users size={14} />} label="Users" />
        <Tab id="cms" cur={tab} setCur={setTab} icon={<Pencil size={14} />} label="CMS" />
      </div>

      {tab === "dashboard" && <Dashboard />}
      {tab === "users" && <UsersTab />}
      {tab === "cms" && <CmsTab />}
    </div>
  );
}

const Tab = ({ id, cur, setCur, icon, label }) => (
  <button
    onClick={() => setCur(id)}
    data-testid={`admin-tab-${id}`}
    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
      cur === id
        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
        : "text-muted hover:text-fg"
    }`}
  >
    {icon} {label}
  </button>
);

// ----------------------------------------------------- Dashboard
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    api.get("/admin/stats").then((r) => setStats(r.data)).catch((e) => setErr(formatErr(e.response?.data?.detail) || e.message));
  }, []);
  if (err) return <div className="text-rose-600 text-sm" data-testid="admin-stats-error">{err}</div>;
  if (!stats) return <div className="text-muted text-sm">Loading stats…</div>;

  return (
    <div className="space-y-5" data-testid="admin-dashboard">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={<Users size={16} />} label="Users" value={stats.total_users} testid="stat-users" />
        <Stat icon={<TrendingUp size={16} />} label="Active subs" value={stats.active_subs} testid="stat-subs" />
        <Stat icon={<DollarSign size={16} />} label="MRR (CAD)" value={`$${stats.mrr_cad.toFixed(2)}`} testid="stat-mrr" />
        <Stat icon={<Receipt size={16} />} label="Total revenue" value={`$${stats.total_revenue_cad.toFixed(2)}`} testid="stat-revenue" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Signups · last 30 days" testid="signups-chart">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={stats.signups_30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-line)" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip />
              <Area type="monotone" dataKey="count" stroke="#2563eb" fill="#2563eb" fillOpacity={0.2} />
            </AreaChart>
          </ResponsiveContainer>
        </Panel>
        <Panel title="Revenue · last 30 days (CAD)" testid="revenue-chart">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats.revenue_30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--app-line)" opacity={0.3} />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} hide />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="amount" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      <Panel title="Recent payments" testid="recent-payments">
        {stats.recent_payments.length === 0 ? (
          <div className="text-xs text-muted py-4 text-center">No payments yet.</div>
        ) : (
          <div className="divide-y divide-fg/10">
            {stats.recent_payments.map((p, i) => (
              <div key={i} className="flex items-center justify-between py-2 text-sm" data-testid={`payment-row-${i}`}>
                <div className="font-mono text-xs text-fg truncate flex-1">{p.email}</div>
                <div className="font-mono text-xs text-muted px-3">
                  {p.completed_at ? new Date(p.completed_at).toLocaleString() : "—"}
                </div>
                <div className="font-bold tabular-nums">
                  ${Number(p.amount).toFixed(2)} {String(p.currency || "").toUpperCase()}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

const Stat = ({ icon, label, value, testid }) => (
  <div className="surface brut-border p-3" data-testid={testid}>
    <div className="flex items-center gap-2 text-muted">
      {icon}
      <div className="text-[10px] uppercase tracking-[0.25em] font-medium">{label}</div>
    </div>
    <div className="text-2xl font-bold tracking-tight text-fg mt-1.5 tabular-nums">{value}</div>
  </div>
);

const Panel = ({ title, children, testid }) => (
  <div className="surface brut-border p-4" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-3">{title}</div>
    {children}
  </div>
);

// ----------------------------------------------------- Users
function UsersTab() {
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");

  const load = async (qs = "") => {
    try {
      const { data } = await api.get(`/admin/users${qs ? `?q=${encodeURIComponent(qs)}` : ""}`);
      setUsers(data.users);
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Could not load users");
    }
  };
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4" data-testid="admin-users">
      <div className="flex items-center gap-2">
        <div className="flex-1 brut-border surface flex items-center gap-2 px-3 py-2">
          <Search size={14} className="text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") load(q); }}
            placeholder="Search by email…"
            data-testid="admin-users-search"
            className="flex-1 bg-transparent focus:outline-none text-sm text-fg"
          />
        </div>
        <button
          onClick={() => load(q)}
          data-testid="admin-users-search-btn"
          className="brut-border surface-2 text-fg px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white"
        >
          Search
        </button>
      </div>

      <div className="surface brut-border divide-y divide-fg/10">
        {users.length === 0 ? (
          <div className="text-xs text-muted py-6 text-center">No users.</div>
        ) : (
          users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-3 py-2.5 text-sm" data-testid={`admin-user-${u.id}`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-fg truncate">{u.email}</div>
                <div className="text-[11px] text-muted truncate">{u.name}</div>
              </div>
              <Pill label={u.role} kind={u.role === "admin" ? "amber" : "neutral"} />
              <Pill
                label={
                  u.subscription_status === "active" || u.subscription_status === "trialing"
                    ? u.subscription_status
                    : u.in_trial
                    ? "trial"
                    : "free / expired"
                }
                kind={
                  u.subscription_status === "active" ? "emerald"
                  : u.in_trial ? "blue"
                  : "rose"
                }
              />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const Pill = ({ label, kind }) => {
  const styles = {
    amber: "bg-amber-200 text-zinc-950",
    emerald: "bg-emerald-200 text-emerald-950",
    blue: "bg-blue-200 text-blue-950",
    rose: "bg-rose-200 text-rose-950",
    neutral: "surface-2 text-muted",
  }[kind || "neutral"];
  return (
    <span className={`brut-border-soft px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${styles}`}>
      {label}
    </span>
  );
};

// ----------------------------------------------------- CMS
function CmsTab() {
  const [doc, setDoc] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get("/admin/cms").then((r) => setDoc(r.data)).catch(() => {});
  }, []);

  const set = (k, v) => setDoc((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/cms", doc);
      setDoc(data);
      toast.success("Saved");
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Save failed");
    } finally { setBusy(false); }
  };

  if (!doc) return <div className="text-muted text-sm">Loading CMS…</div>;
  return (
    <div className="space-y-4 max-w-2xl" data-testid="admin-cms">
      <div className="surface brut-border p-4 space-y-3">
        <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Hero</h3>
        <Field label="Title" value={doc.hero_title || ""} onChange={(v) => set("hero_title", v)} testid="cms-hero-title" />
        <Field label="Subtitle" value={doc.hero_subtitle || ""} onChange={(v) => set("hero_subtitle", v)} testid="cms-hero-subtitle" />
      </div>
      <div className="surface brut-border p-4 space-y-3">
        <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Paywall</h3>
        <Field label="Blurb" value={doc.paywall_blurb || ""} onChange={(v) => set("paywall_blurb", v)} testid="cms-paywall-blurb" multiline />
      </div>
      <div className="surface brut-border p-4 space-y-3">
        <h3 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium flex items-center gap-2">
          <Megaphone size={12} /> Announcement bar
        </h3>
        <Field label="Message" value={doc.announcement || ""} onChange={(v) => set("announcement", v)} testid="cms-announcement" />
        <label className="flex items-center gap-2 text-sm text-fg">
          <input
            type="checkbox"
            checked={!!doc.announcement_active}
            onChange={(e) => set("announcement_active", e.target.checked)}
            data-testid="cms-announcement-active"
          />
          Show on site
        </label>
      </div>
      <button
        onClick={save}
        disabled={busy}
        data-testid="cms-save"
        className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-sm px-5 py-2.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 transition-all flex items-center gap-2"
      >
        <Save size={14} /> {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

const Field = ({ label, value, onChange, testid, multiline }) => (
  <label className="block">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-1.5">{label}</div>
    {multiline ? (
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className="w-full brut-border surface-2 text-fg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-y"
      />
    ) : (
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        data-testid={testid}
        className="w-full brut-border surface-2 text-fg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
      />
    )}
  </label>
);
