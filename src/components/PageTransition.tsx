import { ReactNode } from "react";
import { useLocation } from "react-router-dom";

/**
 * Page transition — deliberately NOT framer-motion.
 *
 * The previous implementation wrapped every route in <AnimatePresence> +
 * <motion.div>. During transitions framer-motion measures the page
 * (PopChild/PopChildMeasure) and pins inline width/position styles on the
 * wrapper so the exiting page keeps its size. On mobile — especially when
 * the transition is interrupted (tab/app switch, slow paint) — those inline
 * styles were never cleaned up, leaving the ENTIRE page (including
 * position:fixed children like the bottom tab bar) trapped in a narrow
 * measured column with dead space on the right.
 *
 * A keyed plain <div> with a CSS-only fade-in achieves the same polish with
 * zero measurement, zero inline styles, and zero exit-phase bookkeeping:
 * the old page unmounts immediately, the new one mounts full-width.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  const location = useLocation();

  return (
    <div key={location.pathname} className="w-full animate-page-fade">
      {children}
    </div>
  );
}

