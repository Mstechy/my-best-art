import { ReactNode } from "react";

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
 * Do not add another layout wrapper here. Public pages such as Home already
 * own their full-width surface; an outer wrapper is the only shared element
 * that can briefly inherit a stale measured width during dashboard-to-home
 * navigation. Routes now mount directly at viewport width.
 */
export default function PageTransition({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

