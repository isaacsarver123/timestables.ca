import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

/**
 * Tiny green-pulse badge that pops over the corner of a target area when an
 * answer is correct. Drop into any question component:
 *
 *   <div className="relative">
 *     ...
 *     <CorrectPulse show={status === "correct"} />
 *   </div>
 */
export const CorrectPulse = ({ show, label = "Correct!" }) => (
  <AnimatePresence>
    {show && (
      <motion.div
        key="pulse"
        initial={{ opacity: 0, scale: 0.6, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: -4 }}
        transition={{ type: "spring", stiffness: 420, damping: 20 }}
        className="absolute -top-3 -right-3 z-10 pointer-events-none flex items-center gap-1.5 brut-border bg-emerald-500 text-white px-2.5 py-1 font-bold text-xs uppercase tracking-wider"
        data-testid="correct-pulse"
      >
        <motion.span
          animate={{ scale: [1, 1.25, 1] }}
          transition={{ repeat: Infinity, duration: 0.9 }}
          className="grid place-items-center"
        >
          <Check size={14} strokeWidth={3} />
        </motion.span>
        {label}
      </motion.div>
    )}
  </AnimatePresence>
);

export default CorrectPulse;
