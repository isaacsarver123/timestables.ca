import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";

/**
 * Global "nav guard" for in-lesson navigation.
 * ------------------------------------------------------------------
 * While a lesson is in play, we want the confirmation modal to pop
 * for ANY nav — in-page Quit button AND top-nav Link clicks.
 *
 * Implementation: a module-level `_armed` boolean + a listener set.
 * Top-nav Link clicks call `requestGuardedNav(path, doNav)`; if armed,
 * the listeners (the active Lessons page) handle the modal and decide
 * whether to call `doNav()`.
 *
 * Also wires `beforeunload` so tab-close / reload prompts the browser
 * "Changes you made may not be saved" dialog.
 */

let _armed = false;
const _listeners = new Set();

export const isNavGuardArmed = () => _armed;

export const requestGuardedNav = (path, doNav) => {
  if (!_armed || _listeners.size === 0) {
    doNav();
    return;
  }
  // Fire at the first listener (there's only ever one active at a time).
  const iter = _listeners.values();
  const cb = iter.next().value;
  cb(path, doNav);
};

/**
 *   const guard = useNavGuard(running);
 *   <ConfirmLeaveModal open={guard.open} onCancel={guard.cancel} onConfirm={guard.confirm} />
 *   <button onClick={() => guard.tryGo('/')}>Quit</button>
 */
export const useNavGuard = (armed) => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(null); // { doNav } | { path }

  // Subscribe to nav requests while armed.
  useEffect(() => {
    _armed = !!armed;
    if (!armed) {
      return () => {};
    }
    const cb = (path, doNav) => {
      setPending({ doNav });
      setOpen(true);
    };
    _listeners.add(cb);
    return () => {
      _listeners.delete(cb);
      _armed = false;
    };
  }, [armed]);

  // Also prompt for tab-close / reload.
  useEffect(() => {
    if (!armed) return;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [armed]);

  const tryGo = useCallback(
    (path) => {
      if (!armed) {
        navigate(path);
        return;
      }
      setPending({ path });
      setOpen(true);
    },
    [armed, navigate]
  );

  const cancel = useCallback(() => {
    setOpen(false);
    setPending(null);
  }, []);

  const confirm = useCallback(() => {
    setOpen(false);
    if (pending?.doNav) {
      pending.doNav();
    } else if (pending?.path) {
      navigate(pending.path);
    }
    setPending(null);
  }, [pending, navigate]);

  return { open, tryGo, cancel, confirm };
};
