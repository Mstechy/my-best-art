export type MarketplaceRole = "admin" | "seller" | "buyer";

/** Accept only same-site application paths, including paths with query strings. */
export function getSafeRedirect(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/auth/login") || value.startsWith("/auth/register")) return null;
  return value;
}

/** Preserve user intent, otherwise use the role's normal workspace. */
export function getPostLoginDestination(
  role: MarketplaceRole | null,
  requested?: string | null,
): string {
  return getSafeRedirect(requested) ?? (role === "admin" || role === "seller" ? `/${role}/dashboard` : "/");
}

