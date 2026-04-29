import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

/**
 * "Don't leave" modal used by every game mode.
 *   <ConfirmLeaveModal open={openLeave} onCancel={...} onConfirm={...} />
 */
export const ConfirmLeaveModal = ({
  open,
  onCancel,
  onConfirm,
  title = "Heads up — leaving now?",
  body = "Your run will end. The XP and coins you've already earned this round are safe.",
  confirmLabel = "Yes, leave",
  cancelLabel = "No, stay",
}) => (
  <AnimatePresence>
    {open && (
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 grid place-items-center bg-black/55 backdrop-blur-sm p-4"
        onClick={onCancel}
        data-testid="confirm-leave-modal"
      >
        <motion.div
          initial={{ scale: 0.92, y: 12, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => e.stopPropagation()}
          className="surface brut-border brut-shadow w-full max-w-sm p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 brut-border bg-amber-300 grid place-items-center text-zinc-950 shrink-0">
              <AlertTriangle size={22} strokeWidth={2.5} />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-fg text-lg leading-tight" data-testid="confirm-leave-title">
                {title}
              </h3>
              <p className="text-sm text-muted mt-1" data-testid="confirm-leave-body">{body}</p>
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-1">
            <button
              onClick={onConfirm}
              data-testid="confirm-leave-yes"
              className="flex-1 bg-rose-500 text-white brut-border font-bold uppercase tracking-wider text-xs px-4 py-3 hover:bg-rose-600 active:translate-x-1 active:translate-y-1 transition-all"
            >
              {confirmLabel}
            </button>
            <button
              onClick={onCancel}
              data-testid="confirm-leave-no"
              autoFocus
              className="flex-1 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950 brut-border brut-shadow font-bold uppercase tracking-wider text-xs px-4 py-3 hover:bg-blue-600 hover:text-white active:translate-x-1 active:translate-y-1 active:brut-shadow-none transition-all"
            >
              {cancelLabel}
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default ConfirmLeaveModal;
