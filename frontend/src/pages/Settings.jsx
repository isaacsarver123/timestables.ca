import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  RotateCcw,
  AlertTriangle,
  CreditCard,
  LogIn,
  LogOut,
  CheckCircle2,
  Clock3,
  ExternalLink,
  ShieldCheck,
  Infinity as InfinityIcon,
  Users,
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
import { useAuth } from "@/lib/auth";
import { api, formatErr } from "@/lib/api";
import CardOnFile from "@/components/CardOnFile";

const FAMILY_MIN_SLOTS = 2;
const FAMILY_INCLUDED_SLOTS = 5;
const FAMILY_MAX_SLOTS = 10;
const clampFamilySlots = (value) => Math.min(FAMILY_MAX_SLOTS, Math.max(FAMILY_MIN_SLOTS, Number(value) || FAMILY_INCLUDED_SLOTS));

const Settings = () => {
  const [state, setState] = useState(getState());
  useEffect(() => subscribe(() => setState(getState())), []);
  const { user, logout, refresh } = useAuth();
  const nav = useNavigate();
  const [cms, setCms] = useState(null);
  useEffect(() => {
    api.get("/cms/public").then((r) => setCms(r.data)).catch(() => {});
  }, []);

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

  const startCheckout = async (plan = "individual", familySlots = FAMILY_INCLUDED_SLOTS) => {
    try {
      const { data } = await api.post("/stripe/checkout", {
        origin: window.location.origin,
        plan,
        family_slots: familySlots,
      });
      window.location.href = data.url;
    } catch (ex) {
      toast.error(formatErr(ex.response?.data?.detail) || "Could not start checkout");
    }
  };

  const openPortal = async () => {
    try {
      const { data } = await api.post("/stripe/portal", { origin: window.location.origin });
      window.location.href = data.url;
    } catch (ex) {
      toast.error(formatErr(ex.response?.data?.detail) || "Could not open billing portal");
    }
  };

  const changePlan = async (plan = "family", familySlots = FAMILY_INCLUDED_SLOTS) => {
    try {
      const { data } = await api.post("/stripe/change-plan", {
        plan,
        family_slots: familySlots,
      });
      await refresh();
      toast.success(
        data?.plan_kind === "family"
          ? `Switched to Max Family${data?.family_slots ? ` (${data.family_slots} seats)` : ""}`
          : "Subscription updated"
      );
    } catch (ex) {
      toast.error(formatErr(ex.response?.data?.detail) || "Could not update subscription");
    }
  };

  const handleLogout = async () => {
    await logout();
    toast.success("Signed out");
    nav("/login");
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
          Account, billing, preferences, and your data — all in one place.
        </p>
      </div>

      {/* Account */}
      <section className="surface brut-border p-5 space-y-4" data-testid="settings-account">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Account</h2>
        {user ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 brut-border bg-blue-600 text-white grid place-items-center font-bold text-lg">
                {(user.name || user.email)[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-fg truncate" data-testid="settings-user-name">{user.name}</div>
                <div className="text-xs text-muted truncate" data-testid="settings-user-email">{user.email}</div>
              </div>
              <button
                onClick={handleLogout}
                data-testid="settings-logout"
                className="brut-border surface-2 text-fg px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-rose-500 hover:text-white flex items-center gap-1"
              >
                <LogOut size={12} /> Sign out
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <div className="font-bold text-fg">You're signed out</div>
              <div className="text-xs text-muted mt-0.5">Sign in to sync progress across devices.</div>
            </div>
            <Link
              to="/login"
              data-testid="settings-signin"
              className="brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-1.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white flex items-center gap-1"
            >
              <LogIn size={12} /> Sign in
            </Link>
          </div>
        )}
      </section>

      {/* Billing */}
      {user && (
        <section className="surface brut-border p-5 space-y-4" data-testid="settings-billing">
          <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Billing</h2>
          <BillingPanel
            user={user}
            onSubscribe={startCheckout}
            onChangePlan={changePlan}
            onPortal={openPortal}
          />
          {user?.billing?.plan_kind === "family" && ["active", "trialing", "past_due"].includes(user?.subscription_status) && (
            <FamilyManager />
          )}
        </section>
      )}

      {/* Preferences */}
      <section className="surface brut-border p-5 space-y-4" data-testid="settings-preferences">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">Preferences</h2>
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

      {/* Need help? section moved to the bottom of the page. */}
      {/* Data — Import removed per request; nothing else here for now. */}

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

      {/* Need help? — moved to the bottom, plain text per request */}
      <section className="border-t-2 border-fg/15 pt-6 pb-2" data-testid="settings-help">
        <h2 className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-2">Need help?</h2>
        <p className="text-sm text-muted leading-relaxed">
          Stuck or have feedback? Contact us via email at{" "}
          <a
            href={`mailto:${cms?.support_email || "isaacsarver@icloud.com"}`}
            data-testid="settings-help-email"
            className="font-bold text-fg underline decoration-2 underline-offset-2 hover:text-blue-600 break-all"
          >
            {cms?.support_email || "isaacsarver@icloud.com"}
          </a>
          {" "}or by phone at{" "}
          <a
            href={`tel:${(cms?.support_phone || "8259623425").replace(/[^0-9+]/g, "")}`}
            data-testid="settings-help-phone"
            className="font-bold text-fg underline decoration-2 underline-offset-2 hover:text-blue-600"
          >
            {cms?.support_phone || "825-962-3425"}
          </a>
          .
        </p>
      </section>
    </div>
  );
};

const BillingPanel = ({ user, onSubscribe, onChangePlan, onPortal }) => {
  const sub = user.billing || {};
  const status = user.subscription_status;
  const active = ["active", "trialing", "past_due"].includes(status);
  const isFamily = sub.plan_kind === "family";
  const isIndividual = sub.plan_kind !== "family";
  const [familySlots, setFamilySlots] = useState(clampFamilySlots(sub.family_slots || FAMILY_INCLUDED_SLOTS));
  const [family, setFamily] = useState(null);
  const [showSeatPicker, setShowSeatPicker] = useState(false);
  const [familyBusy, setFamilyBusy] = useState(false);

  useEffect(() => {
    if (!user) return;
    api.get("/family/me").then(({ data }) => setFamily(data?.family || null)).catch(() => setFamily(null));
  }, [user, sub.plan_kind, sub.family_slots]);

  useEffect(() => {
    if (isFamily && (sub.family_slots || family?.max_slots)) {
      setFamilySlots(clampFamilySlots(sub.family_slots || family?.max_slots || FAMILY_INCLUDED_SLOTS));
    }
  }, [isFamily, sub.family_slots, family?.max_slots]);

  const niceDate = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }); }
    catch { return iso; }
  };

  const familyPrice = 15 + Math.max(0, familySlots - FAMILY_INCLUDED_SLOTS) * 5;
  const isUpgrade = active && isIndividual;

  const handleFamilyAction = async () => {
    setFamilyBusy(true);
    try {
      if (isUpgrade) await onChangePlan("family", familySlots);
      else await onSubscribe("family", familySlots);
    } finally {
      setFamilyBusy(false);
    }
  };

  const FamilyOfferCard = ({ buttonLabel, testid }) => (
    <div className="brut-border-soft surface-2 p-4 space-y-3" data-testid={testid}>
      <div className="font-bold text-fg flex items-center gap-2"><Users size={14} /> TimesTables, MAX Family</div>
      <div className="text-xs text-muted">$15/month includes 5 total seats, then +$5 per extra seat up to 10.</div>
      <button
        onClick={handleFamilyAction}
        disabled={familyBusy}
        data-testid={`${testid}-primary`}
        className="w-full brut-border bg-blue-600 text-white px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-700 flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <CreditCard size={13} /> {familyBusy ? "Working…" : `${buttonLabel} — $${familyPrice} CAD/mo`}
      </button>
      <button
        type="button"
        onClick={() => setShowSeatPicker((v) => !v)}
        data-testid={`${testid}-toggle-seats`}
        className="text-xs font-bold text-fg underline underline-offset-2 hover:text-blue-600"
      >
        {showSeatPicker ? "Done choosing seats" : "Need more or fewer seats?"}
      </button>
      {showSeatPicker && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2 text-[10px] uppercase tracking-[0.25em] text-muted font-medium">
            <span>Seats</span>
            <span>{familySlots}</span>
          </div>
          <input
            type="range"
            min={FAMILY_MIN_SLOTS}
            max={FAMILY_MAX_SLOTS}
            step={1}
            value={familySlots}
            onInput={(e) => setFamilySlots(clampFamilySlots(e.target.value))}
            onChange={(e) => setFamilySlots(clampFamilySlots(e.target.value))}
            aria-label="Family seats"
            className="w-full h-8 cursor-pointer accent-blue-600"
          />
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted">
            <span>{FAMILY_MIN_SLOTS} seats min</span>
            <span>{FAMILY_MAX_SLOTS} seats max</span>
          </div>
          <div className="text-[11px] text-muted">{familySlots} total seats, ${familyPrice} CAD/month.</div>
        </div>
      )}
    </div>
  );

  if (user.is_admin) {
    return (
      <div className="space-y-3" data-testid="billing-admin">
        <div className="flex items-center gap-2">
          <ShieldCheck size={16} className="text-amber-500" />
          <span className="font-bold text-fg text-sm">Admin account</span>
        </div>
        <div className="brut-border-soft surface-2 p-4 flex items-center gap-3">
          <InfinityIcon size={28} className="text-fg" />
          <div>
            <div className="font-bold text-fg" data-testid="billing-admin-label">Infinite free use</div>
            <div className="text-xs text-muted">No billing — admins use the site as a paying customer.</div>
          </div>
        </div>
      </div>
    );
  }

  if (active && (sub.last4 || sub.current_period_end)) {
    return (
      <div className="space-y-4" data-testid="billing-active">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-500" />
          <span className="font-bold text-fg text-sm">
            {isFamily ? "Family" : "Subscribed"} · ${Number(sub.amount_cad || 5).toFixed(2)} CAD / {sub.interval}
          </span>
        </div>
        <Tile label="Plan" value={isFamily ? "TimesTables, MAX Family" : "TimesTables"} testid="billing-plan-kind" />
        {isFamily && (
          <Tile label="Seats" value={`${sub.family_slots || family?.max_slots || FAMILY_INCLUDED_SLOTS} total`} sub="Owner included" testid="billing-family-slots" />
        )}
        <Tile label="Next billing" value={niceDate(sub.current_period_end)} testid="billing-next" />
        <CardOnFile brand={sub.brand} last4={sub.last4} testid="billing-card" />
        {isFamily && family && (
          <div className="brut-border-soft surface-2 p-3 space-y-2" data-testid="family-members-summary">
            <div className="flex items-center gap-2 font-bold text-fg text-sm"><Users size={14} /> Family members</div>
            <div className="text-xs text-muted">{family.members?.length || 1} joined, {family.pending_invites?.filter((x) => x.status === "pending").length || 0} pending, {family.max_slots || FAMILY_INCLUDED_SLOTS} total slots.</div>
          </div>
        )}
        {isUpgrade && (
          <div className="brut-border-soft surface-2 p-4 space-y-3" data-testid="billing-upgrade-family">
            <div>
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium mb-1">Current plan</div>
              <div className="font-bold text-fg">TimesTables</div>
              <div className="text-xs text-muted mt-1">Need more? Switch to TimesTables, MAX Family anytime.</div>
            </div>
            <FamilyOfferCard buttonLabel="Switch to TimesTables, MAX Family" testid="billing-switch-family" />
          </div>
        )}
        <p className="text-[11px] text-muted leading-relaxed" data-testid="billing-charge-line">
          ${Number(sub.amount_cad || 5).toFixed(2)} CAD will be charged to your <span className="font-bold text-fg">{sub.brand ? sub.brand : "card"}</span> ending in <span className="font-mono font-bold text-fg">{sub.last4 || "—"}</span> each {sub.interval}.
        </p>
        {sub.cancel_at_period_end && (
          <div className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 brut-border-soft p-2.5">
            Subscription will cancel at the end of the current period.
          </div>
        )}
        <button
          onClick={onPortal}
          data-testid="billing-portal"
          className="w-full brut-border surface-2 text-fg px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white flex items-center justify-center gap-2"
        >
          Manage subscription <ExternalLink size={12} />
        </button>
      </div>
    );
  }

  const TrialCopy = user.in_trial ? (
    <p className="text-xs text-muted">$5 CAD/month individual, or family from $15/month. Your account ({user.email}) is locked to one trial.</p>
  ) : null;

  return (
    <div className="space-y-4" data-testid={user.in_trial ? "billing-trial" : "billing-expired"}>
      <div className="flex items-center gap-2">
        {user.in_trial ? <Clock3 size={16} className="text-amber-500" /> : <AlertTriangle size={16} className="text-rose-500" />}
        <span className="font-bold text-fg text-sm">
          {user.in_trial
            ? `Free trial — ${Math.floor((user.trial_seconds_left || 0) / 86400) > 0 ? `${Math.floor((user.trial_seconds_left || 0) / 86400)}d ` : ""}${Math.floor(((user.trial_seconds_left || 0) % 86400) / 3600)}h remaining`
            : "Trial ended — subscribe to continue"}
        </span>
      </div>
      {TrialCopy}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="brut-border-soft surface-2 p-4 space-y-3">
          <div className="font-bold text-fg">TimesTables</div>
          <div className="text-xs text-muted">One learner, full access.</div>
          <button
            onClick={() => onSubscribe("individual")}
            data-testid="billing-subscribe-individual"
            className="w-full brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-2.5 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white flex items-center justify-center gap-2"
          >
            <CreditCard size={13} /> Subscribe — $5 CAD/mo
          </button>
        </div>
        <FamilyOfferCard buttonLabel="Subscribe" testid="billing-subscribe-family" />
      </div>
    </div>
  );
};

const FamilyManager = () => {
  const [family, setFamily] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    const { data } = await api.get("/family/me");
    setFamily(data?.family || null);
  };

  useEffect(() => { load().catch(() => {}); }, []);

  useEffect(() => {
    if (!pickerOpen || search.trim().length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    api.get(`/profile/search?q=${encodeURIComponent(search.trim())}`).then(({ data }) => {
      if (live) setResults(data?.results || []);
    }).catch(() => {
      if (live) setResults([]);
    });
    return () => { live = false; };
  }, [search, pickerOpen]);

  const invite = async (userId) => {
    setBusyId(userId);
    try {
      await api.post("/family/invite", { invitee_user_id: userId });
      toast.success("Family invite sent");
      setPickerOpen(false);
      setSearch("");
      setResults([]);
      await load();
    } catch (e) {
      toast.error(formatErr(e.response?.data?.detail) || "Could not send invite");
    } finally {
      setBusyId("");
    }
  };

  if (!family) return null;

  const joined = family.members || [];
  const pending = (family.pending_invites || []).filter((x) => x.status === "pending");
  const used = joined.length + pending.length;
  const slots = Array.from({ length: family.max_slots || 6 }, (_, i) => joined[i] || pending[i - joined.length] || null);

  return (
    <div className="pt-2 space-y-3" data-testid="family-manager">
      <div>
        <div className="font-bold text-fg flex items-center gap-2"><Users size={14} /> Family members</div>
        <div className="text-xs text-muted mt-1">Fill empty slots by clicking the plus and searching by name or username.</div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {slots.map((entry, idx) => {
          const isPending = entry && entry.invitee;
          const person = isPending ? entry.invitee : entry;
          const isEmpty = !entry;
          return (
            <button
              key={`${idx}:${person?.id || "empty"}`}
              onClick={() => isEmpty && setPickerOpen(true)}
              disabled={!isEmpty}
              className={`brut-border p-3 min-h-[110px] text-left ${isEmpty ? "surface-2 hover:bg-blue-50 dark:hover:bg-blue-950/30" : "surface"}`}
            >
              {isEmpty ? (
                <div className="h-full grid place-items-center text-center text-muted">
                  <div>
                    <div className="w-10 h-10 mx-auto brut-border grid place-items-center mb-2">+</div>
                    <div className="text-xs font-bold uppercase tracking-wider">Add member</div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="font-bold text-fg truncate">{person?.name || "Pending"}</div>
                  <div className="text-xs text-muted truncate">{person?.username ? `@${person.username}` : isPending ? "Invite pending" : "Member"}</div>
                  {isPending && <div className="mt-2 text-[10px] uppercase tracking-[0.25em] text-amber-600">Pending</div>}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="text-xs text-muted">{used} of {family.max_slots || 6} slots in use.</div>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm p-4 grid place-items-center">
          <div className="w-full max-w-xl surface brut-border p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-bold text-fg">Invite a family member</div>
                <div className="text-xs text-muted">Search by name or username.</div>
              </div>
              <button onClick={() => setPickerOpen(false)} className="brut-border surface-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider">Close</button>
            </div>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full brut-border bg-transparent px-3 py-2.5 text-sm text-fg focus:outline-none"
            />
            <div className="space-y-2 max-h-[45vh] overflow-auto">
              {results.map((r) => (
                <div key={r.id} className="brut-border-soft surface-2 p-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-fg truncate">{r.name}</div>
                    <div className="text-xs text-muted truncate">{r.username ? `@${r.username}` : "No username yet"}</div>
                  </div>
                  <button disabled={busyId === r.id} onClick={() => invite(r.id)} className="brut-border bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 px-3 py-2 text-xs font-bold uppercase tracking-wider hover:bg-blue-600 hover:text-white disabled:opacity-50">
                    Invite
                  </button>
                </div>
              ))}
              {search.trim().length >= 2 && results.length === 0 && (
                <div className="text-sm text-muted text-center py-6">No users found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Tile = ({ label, value, sub, testid }) => (
  <div className="brut-border-soft surface-2 p-3" data-testid={testid}>
    <div className="text-[10px] uppercase tracking-[0.25em] text-muted font-medium">{label}</div>
    <div className="font-bold text-fg text-base mt-1">{value}</div>
    {sub && <div className="text-[10px] uppercase tracking-wider text-muted mt-0.5">{sub}</div>}
  </div>
);

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
