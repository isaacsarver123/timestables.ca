import { useEffect, useState } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const BillingSuccess = () => {
  const [params] = useSearchParams();
  const { refresh } = useAuth();
  const [status, setStatus] = useState("checking"); // checking | paid | pending | error
  const sessionId = params.get("session_id");

  useEffect(() => {
    if (!sessionId) { setStatus("error"); return; }
    let attempts = 0;
    let cancelled = false;
    const poll = async () => {
      try {
        const { data } = await api.get(`/stripe/status/${sessionId}`);
        if (cancelled) return;
        if (data.payment_status === "paid") {
          await refresh();
          setStatus("paid");
          return;
        }
        if (data.status === "expired") { setStatus("error"); return; }
        if (++attempts >= 6) { setStatus("pending"); return; }
        setTimeout(poll, 1500);
      } catch {
        if (!cancelled) setStatus("error");
      }
    };
    poll();
    return () => { cancelled = true; };
  }, [sessionId, refresh]);

  return (
    <div className="max-w-md mx-auto" data-testid="billing-success-page">
      <div className="surface brut-border brut-shadow p-7 text-center space-y-4">
        {status === "checking" && (
          <>
            <Loader2 className="mx-auto animate-spin text-blue-600" size={36} />
            <h1 className="text-2xl font-bold text-fg">Confirming payment…</h1>
            <p className="text-sm text-muted">Hang tight, this only takes a moment.</p>
          </>
        )}
        {status === "paid" && (
          <>
            <CheckCircle2 className="mx-auto text-emerald-500" size={42} />
            <h1 className="text-2xl font-bold text-fg" data-testid="billing-success-title">You're in!</h1>
            <p className="text-sm text-muted">Thanks for supporting timestables.ca.</p>
            <Link to="/" data-testid="billing-success-home"
                  className="inline-block bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-sm px-5 py-2.5">
              Back to practice
            </Link>
          </>
        )}
        {status === "pending" && (
          <>
            <Loader2 className="mx-auto text-amber-500" size={36} />
            <h1 className="text-2xl font-bold text-fg">Still processing…</h1>
            <p className="text-sm text-muted">Your payment is taking a moment. Refresh in a few seconds.</p>
            <Link to="/settings" className="inline-block brut-border surface-2 text-fg px-4 py-2 text-sm font-bold uppercase">View billing</Link>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="mx-auto text-rose-500" size={42} />
            <h1 className="text-2xl font-bold text-fg">Payment didn't go through</h1>
            <Link to="/" className="inline-block brut-border surface-2 text-fg px-4 py-2 text-sm font-bold uppercase">Try again</Link>
          </>
        )}
      </div>
    </div>
  );
};

export const BillingCancel = () => {
  const nav = useNavigate();
  return (
    <div className="max-w-md mx-auto" data-testid="billing-cancel-page">
      <div className="surface brut-border p-7 text-center space-y-4">
        <h1 className="text-2xl font-bold text-fg">Checkout cancelled</h1>
        <p className="text-sm text-muted">No charge was made. You can subscribe anytime.</p>
        <button onClick={() => nav("/")} className="brut-border surface-2 text-fg px-4 py-2 text-sm font-bold uppercase">
          Back home
        </button>
      </div>
    </div>
  );
};
