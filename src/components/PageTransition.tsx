import { ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";

// Opacity-only. Do NOT animate y/translate/scale here: a transform on this
// wrapper makes framer-motion measure the page (PopChild/PopChildMeasure)
// and pin inline width/position styles while the previous page exits, which
// briefly renders the incoming page at a stale measured width (content
// squeezed left, empty space on the right) before snapping to full width.
const pageVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const pageTransition = {
  type: "tween" as const,
  ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  duration: 0.25,
};

export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        variants={pageVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={pageTransition}
        className="w-full"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
