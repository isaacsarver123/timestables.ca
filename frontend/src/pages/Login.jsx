import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Login() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/auth/login", { email, password });
      setUser(data);
      toast.success(`Welcome back, ${data.name}`);
      nav(loc.state?.from || "/", { replace: true });
    } catch (ex) {
      setErr(formatErr(ex.response?.data?.detail) || ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto" data-testid="login-page">
      <AuthTabs active="login" />

      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Sign in</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mt-1">Welcome back.</h1>
        <p className="text-sm text-muted mt-2">
          Pick up where you left off. Your progress syncs across every device you sign in on.
        </p>
      </div>

      <form onSubmit={submit} className="surface brut-border p-5 space-y-4">
        <Field label="Email" testid="login-email" type="email"
               value={email} onChange={setEmail} placeholder="you@example.com" autoFocus />
        <Field label="Password" testid="login-password" type="password"
               value={password} onChange={setPassword} placeholder="••••••••" />
        {err && (
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400" data-testid="login-error">
            {err}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          data-testid="login-submit"
          className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-sm py-3 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {busy ? "Signing in…" : "Sign in"} <ArrowRight size={16} />
        </button>
      </form>

      <div className="text-center text-sm text-muted mt-5" data-testid="login-register-link">
        New here?{" "}
        <Link to="/register" className="font-bold text-fg underline decoration-2 underline-offset-2">
          Create an account
        </Link>
      </div>
    </div>
  );
}

export const AuthTabs = ({ active }) => (
  <div className="flex gap-2 brut-border surface p-1.5 mb-6 w-fit mx-auto" data-testid="auth-tabs">
    <Link
      to="/login"
      data-testid="auth-tab-login"
      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
        active === "login"
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
          : "text-muted hover:text-fg"
      }`}
    >
      <LogIn size={13} /> Sign in
    </Link>
    <Link
      to="/register"
      data-testid="auth-tab-register"
      className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold uppercase tracking-wider ${
        active === "register"
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950"
          : "text-muted hover:text-fg"
      }`}
    >
      <UserPlus size={13} /> Sign up
    </Link>
  </div>
);

const Field = ({ label, testid, type = "text", value, onChange, placeholder, autoFocus }) => (
  <label className="block">
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-1.5">{label}</div>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      data-testid={testid}
      required
      className="w-full brut-border surface-2 text-fg font-mono text-base px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    />
  </label>
);
