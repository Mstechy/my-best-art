import { type ReactNode, useEffect, useState } from "react";

/**
 * Defers non-critical shell work until after the first paint.
 *
 * The audit that motivated this showed 88% of Largest Contentful Paint was
 * Render Delay: the hero image was downloaded and decoded in 263 ms and still
 * did not paint for over five seconds, because the main thread was busy. Every
 * component mounted during boot competes with that first paint for the same
 * thread, and these children - a Supabase realtime subscription and an
 * analytics beacon - are not needed to show a single pixel.
 *
 * The trigger is `load` plus two animation frames, not a timeout: the first
 * frame only schedules a paint and the second confirms the browser has actually
 * put it on screen. A timeout is deliberately avoided because a timer fires on
 * schedule whether or not the main thread is free, which is exactly the mistake
 * that put Sentry on the critical path earlier.
 *
 * When the document has already finished loading - every client-side
 * navigation after the first view - the children mount straight away, so
 * nothing is held back for the rest of the session.
 */
export default function AfterFirstPaint({ children }: { children: ReactNode }) {
  const [painted, setPainted] = useState(false);

  useEffect(() => {
    if (document.readyState === "complete") {
      setPainted(true);
      return;
    }
    const afterPaint = () => {
      requestAnimationFrame(() => requestAnimationFrame(() => setPainted(true)));
    };
    window.addEventListener("load", afterPaint, { once: true });
    return () => window.removeEventListener("load", afterPaint);
  }, []);

  return painted ? children : null;
}
