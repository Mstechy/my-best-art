/**
 * Skip-to-content link (WCAG 2.4.1 Bypass Blocks).
 *
 * Rendered once for the whole SPA so every route - public storefront, product
 * page, legal pages, dashboards - gets the bypass block without each layout
 * having to remember it. It targets the first <main> landmark and focuses it
 * programmatically, so no page needs a hard-coded `id` on its <main>: the
 * click handler adopts whatever main element the current route rendered,
 * gives it the `main-content` id and `tabindex="-1"` (a main is not
 * focusable by default), and moves focus there.
 *
 * Hidden until focused: `sr-only` for the resting state, then Tailwind's
 * `not-sr-only` restores layout the moment the link receives keyboard focus.
 */
export default function SkipLink() {
  return (
    <a
      href="#main-content"
      onClick={(event) => {
        const main = document.querySelector("main");
        if (!main) return;
        event.preventDefault();
        if (main.id !== "main-content") main.id = "main-content";
        main.setAttribute("tabindex", "-1");
        (main as HTMLElement).focus();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-[#111111] focus:px-5 focus:py-3 focus:text-sm focus:font-bold focus:text-white focus:shadow-lg dark:focus:bg-[#FAF5F2] dark:focus:text-[#111111]"
    >
      Skip to main content
    </a>
  );
}
