import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, Sparkles } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Register() {
  const { setUser } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      setErr("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const { data } = await api.post("/auth/register", { email, password, name });
      setUser(data);
      toast.success("Account created — 2-day free trial started.");
      nav("/", { replace: true });
    } catch (ex) {
      setErr(formatErr(ex.response?.data?.detail) || ex.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto" data-testid="register-page">
      <div className="mb-7">
        <div className="text-xs font-semibold uppercase tracking-widest text-muted">Create account</div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-fg mt-1">Start your 2-day free trial.</h1>
        <p className="text-sm text-muted mt-2">
          No card required for the trial. After 2 days, $5 CAD/month keeps the lights on.
        </p>
      </div>

      <form onSubmit={submit} className="surface brut-border p-5 space-y-4">
        <Field label="Name (optional)" testid="register-name"
               value={name} onChange={setName} placeholder="Alex" />
        <Field label="Email" testid="register-email" type="email"
               value={email} onChange={setEmail} placeholder="you@example.com" autoFocus />
        <Field label="Password" testid="register-password" type="password"
               value={password} onChange={setPassword} placeholder="At least 6 characters" />
        {err && (
          <div className="text-xs font-bold text-rose-600 dark:text-rose-400" data-testid="register-error">
            {err}
          </div>
        )}
        <div className="flex items-start gap-2 text-[11px] text-muted bg-amber-50 dark:bg-amber-900/20 brut-border-soft p-2.5">
          <Sparkles size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <span>One trial per email. Reusing a known email won't grant another trial.</span>
        </div>
        <button
          type="submit"
          disabled={busy}
          data-testid="register-submit"
          className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-sm py-3 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {busy ? "Creating…" : "Create account & start trial"} <ArrowRight size={16} />
        </button>
      </form>

      <div className="text-center text-sm text-muted mt-5" data-testid="register-login-link">
        Already have an account?{" "}
        <Link to="/login" className="font-bold text-fg underline decoration-2 underline-offset-2">
          Sign in
        </Link>
      </div>
    </div>
  );
}

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
      required={type !== "text"}
      className="w-full brut-border surface-2 text-fg font-mono text-base px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
    />
  </label>
);
