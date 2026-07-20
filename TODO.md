# TODO

## Fix ProductDetailPage render loop / maximum update depth
- [ ] Inspect `src/pages/ProductDetailPage.tsx` for effects with unstable dependencies (functions or state setters) causing repeated renders.
- [ ] Implement standard React fix (move functions inside effects or memoize with `useCallback`, ensure effects run only when `id` changes).
- [ ] Ensure no cross-effect loops (e.g., `setState` inside effect triggers dependency change).
- [ ] Run typecheck/build to confirm no TS errors.
- [ ] Run dev server and manually verify product page loads without looping.

