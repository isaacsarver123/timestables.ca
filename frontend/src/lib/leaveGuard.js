import { useEffect, useState, useCallback } from "react";
import { useBlocker, useNavigate } from "react-router-dom";

/**
 * useNavGuard
 * ------------------------------------------------------------------
 * Blocks ANY React Router navigation (Link click, programmatic navigate,
 * back/forward) while `armed` is true. Returns the state the caller
 * needs to drive a confirmation modal.
 *
 *   const guard = useNavGuard(running);
 *   <ConfirmLeaveModal open={guard.open} onCancel={guard.cancel} onConfirm={guard.confirm} />
 *
 * Existing in-page "Quit" buttons can still use `guard.tryGo(path)` — it
 * falls through to the router-level blocker, which pops the same modal.
 * Also wires `beforeunload` so closing the tab / reload prompts.
 */
export const useNavGuard = (armed) => {
  const navigate = useNavigate();
  const [manualPending, setManualPending] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);

  // Router-level blocker: intercepts any nav while `armed` is true.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (!armed) return false;
    // Don't block internal replaces to the same path.
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (!armed) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [armed]);

  // Explicit "Quit" buttons inside the page keep using this. When `armed`
  // is true, let the router blocker handle the modal — call navigate() and
  // the blocker will intercept it.
  const tryGo = useCallback(
    (path) => {
      if (!armed) {
        navigate(path);
        return;
      }
      setManualPending(path);
      setManualOpen(true);
    },
    [armed, navigate]
  );

  // Unified modal state — open if either the blocker tripped or tryGo fired.
  const open = blocker.state === "blocked" || manualOpen;

  const cancel = useCallback(() => {
    if (blocker.state === "blocked") blocker.reset();
    setManualOpen(false);
    setManualPending(null);
  }, [blocker]);

  const confirm = useCallback(() => {
    if (blocker.state === "blocked") {
      blocker.proceed();
    } else if (manualPending) {
      setManualOpen(false);
      const p = manualPending;
      setManualPending(null);
      navigate(p);
    }
  }, [blocker, manualPending, navigate]);

  return { open, tryGo, cancel, confirm };
};
