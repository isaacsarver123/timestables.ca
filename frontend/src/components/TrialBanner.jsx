import { useState } from "react";
import { Clock, X, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api, formatErr } from "@/lib/api";
import { toast } from "sonner";

export const TrialBanner = () => {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() =>
    sessionStorage.getItem("tt_trial_banner_dismissed") === "1"
  );

  if (!user || !user.in_trial || user.subscription_status === "active") return null;

  const secs = user.trial_seconds_left || 0;
  const hours = Math.floor(secs / 3600);
  const days = Math.floor(hours / 24);
  const remH = hours % 24;
  const urgent = secs < 12 * 3600; // < 12h

  if (dismissed && !urgent) return null;

  const label =
    days >= 1
      ? `${days}d ${remH}h left in trial`
      : hours >= 1
      ? `${hours}h left in trial`
      : `< 1h left — trial ending`;

  const subscribe = async () => {
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
    <div
      data-testid="trial-banner"
      className={`mb-5 brut-border ${
        urgent ? "bg-rose-200 dark:bg-rose-950/40" : "bg-amber-200 dark:bg-amber-950/40"
      } px-4 py-2.5 flex items-center gap-3 text-zinc-950 dark:text-amber-100`}
    >
      <Clock size={15} className="shrink-0" />
      <div className="flex-1 text-sm font-bold" data-testid="trial-banner-label">
        {label}
      </div>
      <button
        onClick={subscribe}
        disabled={busy}
        data-testid="trial-banner-subscribe"
        className="bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border-soft font-bold text-xs uppercase tracking-wider px-3 py-1.5 hover:bg-blue-600 hover:text-white disabled:opacity-50 flex items-center gap-1"
      >
        Subscribe <ArrowRight size={12} />
      </button>
      {!urgent && (
        <button
          onClick={() => {
            sessionStorage.setItem("tt_trial_banner_dismissed", "1");
            setDismissed(true);
          }}
          aria-label="Dismiss"
          data-testid="trial-banner-dismiss"
          className="text-zinc-700 hover:text-zinc-950 dark:text-amber-200"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
};

export default TrialBanner;
