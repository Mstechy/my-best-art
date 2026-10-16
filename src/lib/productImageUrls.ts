export function getProductCardImageUrl(originalUrl: string | null | undefined) {
  if (!originalUrl || !originalUrl.includes("/original-")) return originalUrl ?? null;
  const [withoutQuery, query] = originalUrl.split("?", 2);
  const cardUrl = withoutQuery.replace(/\/original-(.+?)(?:\.[^/.]+)?$/i, "/card-$1.webp");
  if (cardUrl === withoutQuery) return originalUrl;
  return query ? `${cardUrl}?${query}` : cardUrl;
}
