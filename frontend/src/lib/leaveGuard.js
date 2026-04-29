import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * useNavGuard
 * ------------------------------------------------------------------
 * Pages call `tryGo(path)` instead of `navigate(path)`. If `armed` is
 * true (i.e. the user is mid-game), navigation is held and a modal is
 * shown via `open`. `confirm()` performs the deferred nav, `cancel()`
 * dismisses it. Also wires `beforeunload` so closing the tab prompts.
 *
 *   const guard = useNavGuard(running);
 *   <button onClick={() => guard.tryGo('/')}>Home</button>
 *   <ConfirmLeaveModal open={guard.open} onCancel={guard.cancel} onConfirm={guard.confirm} />
 */
export const useNavGuard = (armed) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!armed) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [armed]);

  const tryGo = useCallback((path) => {
    if (!armed) { navigate(path); return; }
    setPending(path);
    setOpen(true);
  }, [armed, navigate]);

  const cancel = useCallback(() => { setOpen(false); setPending(null); }, []);
  const confirm = useCallback(() => {
    setOpen(false);
    if (pending) navigate(pending);
    setPending(null);
  }, [pending, navigate]);

  return { open, tryGo, cancel, confirm };
};
