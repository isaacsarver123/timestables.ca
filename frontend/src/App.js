import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import { useEffect, useState } from "react";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import QuickFire from "@/pages/QuickFire";
import Streak from "@/pages/Streak";
import Boss from "@/pages/Boss";
import Stats from "@/pages/Stats";
import Shop from "@/pages/Shop";
import Learn from "@/pages/Learn";
import Daily from "@/pages/Daily";
import { getState, subscribe } from "@/lib/storage";
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
  return (
    <ThemeRoot>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/play/quickfire" element={<QuickFire />} />
            <Route path="/play/streak" element={<Streak />} />
            <Route path="/play/boss" element={<Boss />} />
            <Route path="/play/daily" element={<Daily />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/shop" element={<Shop />} />
          </Routes>
        </Layout>
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
    </ThemeRoot>
  );
}

export default App;
