export type ProductModerationState = "waiting" | "changes_requested";

export interface ProductModerationRecord {
  id: string;
  title: string;
  status: string;
  is_approved: boolean;
  created_at: string;
  updated_at?: string | null;
  moderation_reason?: string | null;
  moderation_next_action?: string | null;
  moderation_updated_at?: string | null;
}

export interface ProductModerationItem extends ProductModerationRecord {
  state: ProductModerationState;
  waitingSince: string;
  ownerLabel: string;
  reason: string;
  nextAction: string;
}

export function getModerationWaitingSince(product: ProductModerationRecord): string {
  return product.moderation_updated_at || product.updated_at || product.created_at;
}

export function formatModerationAge(isoDate: string, now = new Date()): string {
  const timestamp = new Date(isoDate).getTime();
  const current = now.getTime();
  if (!Number.isFinite(timestamp) || timestamp > current) return "Just now";

  const minutes = Math.max(0, Math.floor((current - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m waiting`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h waiting`;
  const days = Math.floor(hours / 24);
  return `${days}d waiting`;
}

export function toProductModerationItem(product: ProductModerationRecord): ProductModerationItem | null {
  if (product.is_approved || product.status === "archived" || product.status === "draft" && !product.moderation_reason) return null;

  const changesRequested = Boolean(product.moderation_reason?.trim());
  return {
    ...product,
    state: changesRequested ? "changes_requested" : "waiting",
    waitingSince: getModerationWaitingSince(product),
    ownerLabel: changesRequested ? "You" : "Tradibu moderation",
    reason: changesRequested ? product.moderation_reason!.trim() : "Your listing is in the approval queue.",
    nextAction: changesRequested
      ? product.moderation_next_action?.trim() || "Update the listing and submit it again for review."
      : "No action needed yet. We will review the listing before it goes live.",
  };
}

export function buildProductModerationQueue(products: ProductModerationRecord[]): ProductModerationItem[] {
  return products
    .map(toProductModerationItem)
    .filter((item): item is ProductModerationItem => Boolean(item))
    .sort((a, b) => new Date(a.waitingSince).getTime() - new Date(b.waitingSince).getTime());
}
