// Small helpers used by the product page to filter out obvious placeholder /
// gibberish content that sellers may have typed while testing.

export function isLikelyTestData(value?: string | null): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length < 10) return true;
  // No spaces at all — a single mashed word usually means junk
  if (!/\s/.test(v)) return true;
  // Almost no vowels — random keyboard mash
  const letters = v.replace(/[^a-zA-Z]/g, "");
  if (letters.length > 6) {
    const vowels = letters.match(/[aeiouAEIOU]/g)?.length ?? 0;
    if (vowels / letters.length < 0.15) return true;
  }
  return false;
}

export function isLikelyTestFeature(value?: string | null): boolean {
  if (!value) return true;
  const v = value.trim();
  if (v.length < 3) return true;
  // A single "word" with no vowels — junk
  if (!/\s/.test(v) && !/[aeiouAEIOU]/.test(v)) return true;
  return false;
}

export function formatWarranty(raw?: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v) return null;
  // If seller stored a plain number like "1" or "2", turn it into years
  const n = Number(v);
  if (!Number.isNaN(n) && Number.isFinite(n) && String(n) === v) {
    if (n <= 0) return null;
    return `${n} Year${n === 1 ? "" : "s"} Warranty`;
  }
  return v;
}

export function maskName(name?: string | null): string {
  const n = (name || "Buyer").trim();
  if (n.length <= 2) return n[0] + "*";
  return `${n[0]}***${n[n.length - 1]}`;
}

export function deliveryEstimateRange(from = new Date()): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const start = new Date(from);
  start.setDate(start.getDate() + 5);
  const end = new Date(from);
  end.setDate(end.getDate() + 12);
  return `${fmt(start)} - ${fmt(end)}`;
}
