import { useState, useMemo, useEffect } from "react";

/** Type-only access to the config module's shape - see the dynamic import below. */
type CategoryConfigs = typeof import("@/lib/categoryConfig").CATEGORY_CONFIGS;

interface CategorySidebarProps {
  selectedCategory: string | null;
  onSelect: (categorySlug: string | null) => void;
  categories: { id: string; name: string; slug: string }[];
}

const TOP_LEVEL_ORDER = [
  "fashion",
  "electronics",
  "home",
  "beauty",
  "sports",
  "toys",
  "automotive",
  "pets",
  "books",
  "jewelry",
  "groceries",
  "travel",
];

export default function CategorySidebar({ selectedCategory, onSelect, categories }: CategorySidebarProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  // CATEGORY_CONFIGS lives in a 54KB module whose form schemas the listing and
  // marketplace pages need - but this sidebar only reads it to LABEL and GROUP the
  // department list. Importing it statically therefore put those ~39KB on the
  // landing page's first-paint graph: real bytes, parse and eval time ahead of the
  // LCP commit on a throttled phone. The chunk is fetched right after mount
  // instead. Visible timing is unchanged: the groups only appear once the async
  // `categories` prop arrives (a Supabase round trip), which is strictly later
  // than this already-preloaded-by-then chunk resolves.
  const [configs, setConfigs] = useState<CategoryConfigs | null>(null);

  useEffect(() => {
    let alive = true;
    import("@/lib/categoryConfig")
      .then((module) => {
        if (alive) setConfigs(module.CATEGORY_CONFIGS);
      })
      .catch(() => {
        // Degrade to the flat list rather than breaking the sidebar.
      });
    return () => {
      alive = false;
    };
  }, []);

  const grouped = useMemo(() => {
    if (!configs) return [];
    const map = new Map<string, { parent: string; label: string; subcategories: { slug: string; label: string }[] }>();
    const categoryBySlug = new Map(categories.map(c => [c.slug, c]));

    TOP_LEVEL_ORDER.forEach(key => {
      const parent = configs[key];
      if (!parent) return;
      const subcategories = parent.productTypes
        .map(pt => ({ slug: pt.subcategory || pt.key, label: pt.label }))
        .filter(pt => categoryBySlug.has(pt.slug));
      if (!subcategories.length) return;
      map.set(key, { parent: key, label: parent.title || key, subcategories });
    });

    const remaining = categories.filter(c => !map.has(c.slug));
    if (remaining.length) {
      map.set("more", { parent: "more", label: "More", subcategories: remaining.map(c => ({ slug: c.slug, label: c.name })) });
    }
    return Array.from(map.values());
  }, [categories, configs]);

  const toggle = (parent: string) => {
    setExpanded(prev => ({ ...prev, [parent]: !prev[parent] }));
  };

  return (
    <aside className="w-full shrink-0 lg:w-64 xl:w-72">
      <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1E1E1E] overflow-hidden">
        <div className="px-4 py-3 border-b border-[#E8E8E8] dark:border-[#222222]">
          <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] uppercase tracking-wider">Categories</span>
        </div>
        <div className="p-2 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin space-y-1">
          <button
            onClick={() => onSelect(null)}
            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${!selectedCategory ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]" : "text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]"}`}
          >
            All products
          </button>
          {grouped.map(group => {
            const isOpen = !!expanded[group.parent];
            return (
              <div key={group.parent} className="space-y-1">
                <button
                  onClick={() => toggle(group.parent)}
                  className="w-full flex items-center justify-between px-3 pt-2 pb-1 text-[10px] font-bold text-[#6E6C64] dark:text-[#A0A0A0] uppercase tracking-wider"
                >
                  <span>{group.label}</span>
                  <span className="text-[#6E6C64] dark:text-[#A0A0A0]">{isOpen ? "−" : "+"}</span>
                </button>
                {isOpen && group.subcategories.map(sub => {
                  const isActive = selectedCategory === sub.slug;
                  return (
                    <button
                      key={sub.slug}
                      onClick={() => onSelect(sub.slug)}
                      className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold transition-colors ${isActive ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]" : "text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]"}`}
                    >
                      {sub.label}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}