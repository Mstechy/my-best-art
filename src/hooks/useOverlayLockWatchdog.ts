import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Self-healing guard against stuck body scroll locks.
 *
 * Radix dialogs/sheets/selects lock the <body> (overflow:hidden +
 * pointer-events:none via react-remove-scroll) while open. In some races
 * (nested overlays, closing during a route transition, quick minimize,
 * component unmounting while locked) the lock is never released and the
 * whole site freezes — no scrolling, no clicks — until a refresh.
 *
 * This watchdog watches <body>. Whenever a body lock is present but NO
 * Radix overlay is actually open (nothing with [data-state="open"]),
 * the stale lock is cleared. Legit locks (a dialog really open, or a
 * non-Radix drawer) are left untouched.
 */
export function useOverlayLockWatchdog() {
  const location = useLocation();

  useEffect(() => {
    let timer: number | undefined;

    const check = () => {
      const body = document.body;
      const overflowLocked = body.style.overflow === "hidden";
      const pointerBlocked = body.style.pointerEvents === "none";
      if (!overflowLocked && !pointerBlocked) return;
      // Any active Radix overlay (dialog, sheet, popover, dropdown, select,
      // tooltip) marks itself with data-state="open". If none exists, any
      // remaining inline body lock is stale and must be cleared.
      if (document.querySelector('[data-state="open"]') !== null) return;
      if (overflowLocked) body.style.removeProperty("overflow");
      if (pointerBlocked) body.style.removeProperty("pointer-events");
      body.style.removeProperty("padding-right");
    };

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 150);
    };

    // Portals mount/unmount as direct children of <body>; Radix also flips
    // body style/attributes around locks.
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      attributes: true,
      attributeFilter: ["style", "class", "data-scroll-locked", "data-state"],
    });

    // A route change can unmount an overlay abruptly (e.g. browser Back while
    // the listing dialog is open) — re-check after navigation settles.
    schedule();

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [location.pathname, location.key]);
}
