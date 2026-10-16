import { readMigrated } from "@/lib/legacyBrandStorage";

/**
 * Anonymous visitor identity shared by discovery tracking (productDiscovery)
 * and the cart hook (useCart). Both used to keep their own copy of this under
 * the pre-rebrand key; one module means the id - and its migration from the
 * legacy storage entry - cannot drift between the two consumers again.
 */
const VISITOR_KEY = "tradibu_visitor_id";
const LEGACY_VISITOR_KEY = "markethub_visitor_id";

export function getVisitorId(): string {
  let id = readMigrated(VISITOR_KEY, LEGACY_VISITOR_KEY);
  if (!id) {
    id = crypto.randomUUID();
    try {
      window.localStorage.setItem(VISITOR_KEY, id);
    } catch {
      // A per-session id is still usable when storage is unavailable.
    }
  }
  return id;
}
