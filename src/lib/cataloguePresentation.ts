export type CategoryPresentationNode = {
  id: string;
  name: string;
  parent_id?: string | null;
};

/**
 * Keep category labels understandable anywhere a seller or buyer chooses a
 * department. The database remains the source of truth; this only presents a
 * child category with its parent when the parent is available.
 */
export function getCategoryPathLabel(
  category: CategoryPresentationNode,
  categories: readonly CategoryPresentationNode[],
): string {
  const parentId = category.parent_id;
  if (!parentId || parentId === category.id) return category.name;

  const parent = categories.find((candidate) => candidate.id === parentId);
  return parent ? `${parent.name} / ${category.name}` : category.name;
}

export type ProductFact = { key: string; label: string; value: string };

const fallbackLabel = (key: string) =>
  key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase()).trim();

/**
 * Build the small, high-signal fact list shown above a product's full details.
 * Missing fields are omitted; this is intentionally not a placeholder grid.
 */
export function getProductFactEntries(input: {
  attributes?: Record<string, string | null | undefined> | null;
  topLevel?: Record<string, string | null | undefined>;
  labels?: Record<string, string>;
  keys: readonly string[];
  limit?: number;
}): ProductFact[] {
  const attributes = input.attributes ?? {};
  const topLevel = input.topLevel ?? {};
  const facts: ProductFact[] = [];
  const seen = new Set<string>();

  for (const key of input.keys) {
    const value = String(topLevel[key] ?? attributes[key] ?? "").trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    facts.push({ key, label: input.labels?.[key] ?? fallbackLabel(key), value });
    if (facts.length >= (input.limit ?? 6)) break;
  }

  return facts;
}
