import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import Paywall from "@/pages/Paywall";

/**
 * Three-state route guard:
 *   user undefined → loading
 *   user null      → redirect to /login
 *   user.has_access false → render Paywall (NOT redirect, so they can still access /settings)
 *   else → render children
 */
export const PaywallGuard = ({ children, allowExpired = false }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (user === undefined) {
    return (
      <div className="text-center py-20 text-muted text-sm" data-testid="auth-loading">
        Loading…
      </div>
    );
  }
  if (user === null) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (!user.has_access && !allowExpired) {
    return <Paywall />;
  }
  return children;
};

export default PaywallGuard;
