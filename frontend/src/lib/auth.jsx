import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "./api";
import { initRemoteSync, disableRemoteSync } from "./storage";

// user states:
//   undefined  → still checking
//   null       → not logged in
//   {...}      → logged in
const AuthContext = createContext({ user: undefined, refresh: () => {}, logout: async () => {} });

export const AuthProvider = ({ children }) => {
  const [user, setUserState] = useState(undefined);

  const setUser = useCallback((u) => {
    setUserState(u);
    if (u) initRemoteSync();
    else disableRemoteSync();
  }, []);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }, [setUser]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    setUser(null);
  }, [setUser]);

  return (
    <AuthContext.Provider value={{ user, setUser, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
