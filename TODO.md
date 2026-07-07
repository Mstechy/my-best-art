# TODO

- [ ] Update src/pages/seller/SellerDashboard.tsx
  - [ ] Fix liveness check useEffect to depend only on user/user.id
  - [ ] Add polling every 4s until profiles.is_approved becomes true
  - [ ] Prevent state updates after unmount via isCancelled
  - [ ] Gate rendering with checkingApproval screen while status unknown
  - [ ] Keep refetchProfile only when isApproved becomes true
  - [ ] Validate lookup key for profiles row (prefer user_id; fallback to id if needed)
  - [ ] Ensure stats/other effects run only after approval is known

