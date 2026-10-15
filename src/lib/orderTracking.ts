export function buildBuyerOrderTrackingUrl(orderId: string, origin: string): string {
  const url = new URL("/buyer/tracking", origin);
  url.searchParams.set("order", orderId);
  return url.toString();
}
