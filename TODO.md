# TODO

## ✅ Fixed
- [x] Fixed duplicate `useAuth()` call in SellerDashboard.tsx (was calling it twice)
- [x] Added `refetchProfile` to second `useEffect` dependency array in SellerDashboard.tsx
- [x] Removed unused `Eye` import from SellerDashboard.tsx
- [x] Fixed `as never` type cast in useAuth.tsx with proper eslint suppression

## Known minor issues (non-breaking)
- SellerCollections.tsx has a very long single return statement (maintainability) 
- Use `@vitejs/plugin-react-oxc` when convenient to remove `esbuild` deprecation warning