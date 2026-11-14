import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const SCROLL_KEY = "marketplace_scroll_position";

export function useScrollRestoration() {
  const location = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // A fresh visit to the storefront must always open at the merchandising
    // entry point. Restore only for a real browser Back/Forward navigation with
    // a non-default history entry; the old global restore ran after every mount
    // and could reopen `/` halfway down the feed, hiding the hero entirely.
    const canRestore = navigationType === "POP" && location.key !== "default";
    if (!canRestore) {
      sessionStorage.removeItem(SCROLL_KEY);
      window.scrollTo(0, 0);
    }

    if (!canRestore) return;
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (!saved) return;
    // Read once, then clear: a saved offset is a one-shot intent, and leaving it
    // behind would also restore it on the NEXT visit to this route, after the
    // shopper had deliberately scrolled somewhere else.
    sessionStorage.removeItem(SCROLL_KEY);
    const pos = parseInt(saved, 10);
    if (isNaN(pos) || pos <= 0) return;

    // The feed renders from the IndexedDB cache, but its first paint can still be
    // shorter than the position being restored - a scroll request beyond the
    // document's height is silently clamped to the bottom, which would drop the
    // shopper somewhere they never were. So the restore waits, frame by frame, until
    // the document is tall enough to honour it, and gives up after ~2s.
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let attempts = 0;
    let settled = false;

    // Reading `scrollHeight` forces a synchronous layout of the whole document.
    // Polling it once per animation frame for up to 120 frames was a measured
    // source of forced reflows, so the wait watches document SIZE instead and
    // reads the height only at the moment it is about to act on it.
    const tryRestore = () => {
      if (settled) return;
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll >= pos - 2 || attempts >= 120) {
        settled = true;
        observer?.disconnect();
        window.scrollTo(0, pos);
      }
    };

    const restore = () => {
      if (settled) return;
      attempts += 1;
      if (typeof ResizeObserver === "function" && !observer) {
        observer = new ResizeObserver(() => tryRestore());
        observer.observe(document.documentElement);
      }
      tryRestore();
      if (!settled) frame = requestAnimationFrame(restore);
    };
    frame = requestAnimationFrame(restore);

    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [location.key, navigationType]);

  const saveScroll = () => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
  };

  // Save scroll when navigating away (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => saveScroll();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      saveScroll();
    };
  }, []);

  return { saveScroll };
}
