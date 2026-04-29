import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Lock, Heart, ArrowRight, Settings as SettingsIcon, LogOut } from "lucide-react";
import { api, formatErr } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export default function Paywall() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [busy, setBusy] = useState(false);
  const [blurb, setBlurb] = useState("");
  useEffect(() => {
    api.get("/cms/public").then((r) => setBlurb(r.data?.paywall_blurb || "")).catch(() => {});
  }, []);

  const startCheckout = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/stripe/checkout", { origin: window.location.origin });
      window.location.href = data.url;
    } catch (ex) {
      toast.error(formatErr(ex.response?.data?.detail) || "Could not start checkout");
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto" data-testid="paywall-page">
      <div className="surface brut-border brut-shadow p-7 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 brut-border bg-amber-300 grid place-items-center text-zinc-950">
            <Lock size={22} />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
              Trial ended
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-fg mt-1">
              Hello {user?.name || "friend"} — your 2-day trial is up.
            </h1>
          </div>
        </div>

        <p className="text-sm text-muted leading-relaxed" data-testid="paywall-blurb">
          {blurb || (
            <>
              Our service is just <span className="font-bold text-fg">$5 CAD/month</span> — that goes
              straight to keeping the servers humming and helping the devs keep building. Your account
              is tied to your email and IP, so making a new one won't grant another free trial.
            </>
          )}
        </p>

        <div className="surface-2 brut-border-soft p-4 flex items-baseline gap-3">
          <div className="text-4xl font-bold tracking-tight text-fg" data-testid="paywall-price">
            $5
          </div>
          <div className="text-sm text-muted">CAD / month · cancel anytime</div>
        </div>

        <button
          onClick={startCheckout}
          disabled={busy}
          data-testid="paywall-subscribe"
          className="w-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-sm py-3.5 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {busy ? "Redirecting…" : "Subscribe with Stripe"} <ArrowRight size={16} />
        </button>

        <div className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <Heart size={12} className="text-rose-500" /> Thanks for supporting an indie project.
        </div>

        <div className="flex items-center justify-between pt-3 border-t-2 border-fg/10">
          <button
            onClick={() => nav("/settings")}
            data-testid="paywall-settings"
            className="text-xs font-bold uppercase tracking-wider text-muted hover:text-fg flex items-center gap-1.5"
          >
            <SettingsIcon size={13} /> Settings
          </button>
          <button
            onClick={async () => { await logout(); nav("/login", { replace: true }); }}
            data-testid="paywall-logout"
            className="text-xs font-bold uppercase tracking-wider text-muted hover:text-fg flex items-center gap-1.5"
          >
            <LogOut size={13} /> Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
