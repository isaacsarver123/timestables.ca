import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import PaywallGuard from "@/components/PaywallGuard";
import Home from "@/pages/Home";
import QuickFire from "@/pages/QuickFire";
import Streak from "@/pages/Streak";
import Boss from "@/pages/Boss";
import Stats from "@/pages/Stats";
import Shop from "@/pages/Shop";
import Learn from "@/pages/Learn";
import Daily from "@/pages/Daily";
import LongMul from "@/pages/LongMul";
import LongDiv from "@/pages/LongDiv";
import Settings from "@/pages/Settings";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Paywall from "@/pages/Paywall";
import Admin from "@/pages/Admin";
import Lessons from "@/pages/Lessons";
import Profile from "@/pages/Profile";
import AvatarEditor from "@/pages/AvatarEditor";
import PublicProfile from "@/pages/PublicProfile";
import { BillingSuccess, BillingCancel } from "@/pages/BillingResult";
import { AuthProvider } from "@/lib/auth";
import { initRemoteSync, getState, subscribe } from "@/lib/storage";
import { setSoundEnabled } from "@/lib/sound";

function ThemeRoot({ children }) {
  const [theme, setThemeState] = useState(getState().theme || "light");
  useEffect(() => {
    const apply = () => {
      const t = getState().theme || "light";
      setThemeState(t);
      const html = document.documentElement;
      if (t === "dark") html.classList.add("dark");
      else html.classList.remove("dark");
      setSoundEnabled(getState().soundOn);
    };
    apply();
    const unsub = subscribe(apply);
    return () => unsub();
  }, []);
  return (
    <div className="App dotted-bg" data-theme={theme}>
      {children}
    </div>
  );
}

function App() {
  useEffect(() => { initRemoteSync(); }, []);
  return (
    <ThemeRoot>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Layout><Login /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/billing/success" element={<Layout><BillingSuccess /></Layout>} />
            <Route path="/billing/cancel" element={<Layout><BillingCancel /></Layout>} />

            {/* Settings is reachable even when paywalled, so users can manage billing/logout */}
            <Route
              path="/settings"
              element={<Layout><PaywallGuard allowExpired><Settings /></PaywallGuard></Layout>}
            />

            {/* Admin (auth required, no paywall) */}
            <Route
              path="/admin"
              element={<Layout><PaywallGuard allowExpired><Admin /></PaywallGuard></Layout>}
            />

            {/* Paywall page (accessible directly too) */}
            <Route path="/paywall" element={<Layout><PaywallGuard allowExpired><Paywall /></PaywallGuard></Layout>} />

            {/* Gated app */}
            <Route path="/" element={<Layout><PaywallGuard><Home /></PaywallGuard></Layout>} />
            <Route path="/learn" element={<Layout><PaywallGuard><Learn /></PaywallGuard></Layout>} />
            <Route path="/play/quickfire" element={<Layout><PaywallGuard><QuickFire /></PaywallGuard></Layout>} />
            <Route path="/play/streak" element={<Layout><PaywallGuard><Streak /></PaywallGuard></Layout>} />
            <Route path="/play/boss" element={<Layout><PaywallGuard><Boss /></PaywallGuard></Layout>} />
            <Route path="/play/daily" element={<Layout><PaywallGuard><Daily /></PaywallGuard></Layout>} />
            <Route path="/play/long-mul" element={<Layout><PaywallGuard><LongMul /></PaywallGuard></Layout>} />
            <Route path="/play/long-div" element={<Layout><PaywallGuard><LongDiv /></PaywallGuard></Layout>} />
            <Route path="/lessons" element={<Layout><PaywallGuard><Lessons /></PaywallGuard></Layout>} />
            <Route path="/profile" element={<Layout><PaywallGuard allowExpired><Profile /></PaywallGuard></Layout>} />
            <Route path="/profile/avatar" element={<Layout><PaywallGuard allowExpired><AvatarEditor /></PaywallGuard></Layout>} />
            <Route path="/u/:username" element={<Layout><PaywallGuard><PublicProfile /></PaywallGuard></Layout>} />
            <Route path="/stats" element={<Layout><PaywallGuard><Stats /></PaywallGuard></Layout>} />
            <Route path="/shop" element={<Layout><PaywallGuard><Shop /></PaywallGuard></Layout>} />
          </Routes>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                border: "2px solid var(--app-line)",
                boxShadow: "4px 4px 0 0 var(--app-shadow)",
                borderRadius: 0,
                fontFamily: "Outfit, sans-serif",
                fontWeight: 600,
                background: "var(--app-surface)",
                color: "var(--app-fg)",
              },
            }}
          />
        </BrowserRouter>
      </AuthProvider>
    </ThemeRoot>
  );
}

export default App;
