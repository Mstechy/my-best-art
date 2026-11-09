import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("electronics category hierarchy migration", () => {
  it("keeps phone category ids stable and assigns Phones & Accessories under Electronics", () => {
    const migration = readFileSync("supabase/migrations/20261109130000_normalize_electronics_category_tree.sql", "utf8");
    expect(migration).toContain("child.slug = 'phones-accessories'");
    expect(migration).toContain("parent.slug = 'electronics'");
    expect(migration).toContain("child.parent_id IS DISTINCT FROM parent.id");
    expect(migration).not.toContain("DELETE FROM public.categories");
    expect(migration).not.toContain("DELETE FROM public.products");
  });
});
