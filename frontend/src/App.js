import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "sonner";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import QuickFire from "@/pages/QuickFire";
import Streak from "@/pages/Streak";
import Boss from "@/pages/Boss";
import Stats from "@/pages/Stats";
import Shop from "@/pages/Shop";

function App() {
  return (
    <div className="App dotted-bg">
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/play/quickfire" element={<QuickFire />} />
            <Route path="/play/streak" element={<Streak />} />
            <Route path="/play/boss" element={<Boss />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/shop" element={<Shop />} />
          </Routes>
        </Layout>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              border: "2px solid #18181b",
              boxShadow: "4px 4px 0 0 #18181b",
              borderRadius: 0,
              fontFamily: "Outfit, sans-serif",
              fontWeight: 600,
            },
          }}
        />
      </BrowserRouter>
    </div>
  );
}

export default App;
