import axios from "axios";

const BASE = process.env.REACT_APP_BACKEND_URL;

export const api = axios.create({
  baseURL: `${BASE}/api`,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ---- automatic refresh on 401 -------------------------------------------
// If any request returns 401, try POST /auth/refresh once; on success retry
// the original request. This keeps the user "signed in" across page reloads
// and after the 1-hour access token expires (refresh cookie lasts 14 days).
let _refreshing = null;
api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const url = original.url || "";
    const skip =
      original._retry ||
      url.includes("/auth/refresh") ||
      url.includes("/auth/login") ||
      url.includes("/auth/register") ||
      url.includes("/auth/me"); // /auth/me probes auth — let it 401 cleanly so AuthProvider sets user=null

    if (status === 401 && !skip) {
      original._retry = true;
      try {
        if (!_refreshing) {
          _refreshing = api.post("/auth/refresh").finally(() => { _refreshing = null; });
        }
        await _refreshing;
        return api(original);
      } catch (e) {
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export function formatErr(detail) {
  if (detail == null) return "Something went wrong.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail
      .map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e)))
      .join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}
