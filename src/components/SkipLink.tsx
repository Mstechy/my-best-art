import { useLayoutEffect } from "react";

/**
 * Skip-to-content link (WCAG 2.4.1 Bypass Blocks).
 *
 * Rendered once for the whole SPA so every route - public storefront, product
 * page, legal pages, dashboards - gets the bypass block without each layout
 * having to remember it. It targets the first <main> landmark and focuses it
 * programmatically, so no page needs a hard-coded `id` on its <main>: the
 * component adopts whatever main element the current route rendered, gives it
 * the `main-content` id and `tabindex="-1"` (a main is not focusable by
 * default), and moves focus there.
 *
 * The adoption is EAGER, not deferred to the click. Accessibility scanners
 * (axe's `skip-link` rule, which both the Lighthouse accessibility and
 * Agentic Browsing categories run) resolve `href="#main-content"` WITHOUT
 * activating the link, so an id that only the click handler creates reads as
 * "No skip link target" and fails the audit even though clicking works for
 * humans - that single broken target was what held the site at 99/100.
 *
 * A mount-time pass is not enough on its own: React.lazy routes render no
 * <main> until their chunk lands (after this component has already mounted),
 * and every navigation replaces the element wholesale. The MutationObserver
 * re-adopts whenever that happens. It watches childList only - the id and
 * tabindex writes below are attribute mutations - so adoption can never
 * retrigger itself, and once the target is in place it is a guarded no-op.
 *
 * Hidden until focused: `sr-only` for the resting state, then Tailwind's
 * `not-sr-only` restores layout the moment the link receives keyboard focus.
 */

/**
 * Point the first <main> at the fragment the href names and make it focusable
 * (fragment navigation and .focus() both need an explicit tabindex on a main).
 * Returns the adopted element, or null when the route rendered no <main>.
 */
function adoptMainTarget(): HTMLElement | null {
  const main = document.querySelector<HTMLElement>("main");
  if (!main) return null;
  if (main.id !== "main-content") main.id = "main-content";
  main.setAttribute("tabindex", "-1");
  return main;
}

export default function SkipLink() {
  // Layout effect so the target exists from the first painted frame, before
  // any scanner (or fast keyboard user) can observe the page.
  useLayoutEffect(() => {
    adoptMainTarget();
    const observer = new MutationObserver(adoptMainTarget);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return (
    <a
      href="#main-content"
      onClick={(event) => {
        const main = adoptMainTarget();
        if (!main) return;
        event.preventDefault();
        main.focus();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#111111] focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg dark:focus:bg-[#FAF5F2] dark:focus:text-[#111111]"
    >
      Skip to main content
    </a>
  );
}
