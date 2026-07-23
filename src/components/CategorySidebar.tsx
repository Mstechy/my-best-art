import { useState, useMemo } from "react";
import { CATEGORY_CONFIGS } from "@/lib/categoryConfig";

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

  const grouped = useMemo(() => {
    const map = new Map<string, { parent: string; label: string; subcategories: { slug: string; label: string }[] }>();
    const categoryBySlug = new Map(categories.map(c => [c.slug, c]));

    TOP_LEVEL_ORDER.forEach(key => {
      const parent = CATEGORY_CONFIGS[key];
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
  }, [categories]);

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
                  className="w-full flex items-center justify-between px-3 pt-2 pb-1 text-[10px] font-bold text-[#888880] dark:text-[#A0A0A0] uppercase tracking-wider"
                >
                  <span>{group.label}</span>
                  <span className="text-[#888880] dark:text-[#A0A0A0]">{isOpen ? "−" : "+"}</span>
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