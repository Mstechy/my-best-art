import { useEffect, useRef } from "react";

const SCROLL_KEY = "marketplace_scroll_position";

export function useScrollRestoration() {
  const restoredRef = useRef(false);

  useEffect(() => {
    const saved = sessionStorage.getItem(SCROLL_KEY);
    if (saved) {
      const pos = parseInt(saved, 10);
      if (!isNaN(pos) && pos > 0) {
        requestAnimationFrame(() => {
          window.scrollTo(0, pos);
        });
      }
      sessionStorage.removeItem(SCROLL_KEY);
    }
    restoredRef.current = true;
  }, []);

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
