import { useEffect, useRef, useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ChevronRight, ChevronDown, X, LayoutGrid, Store, Globe, Check } from "lucide-react";
import { CATEGORY_CONFIGS } from "@/lib/categoryConfig";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import LanguageSwitcher from "@/components/LanguageSwitcher";

interface CategoryDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: { id: string; name: string; slug: string }[];
  onSelectCategory?: (slug: string | null) => void;
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

export default function CategoryDrawer({ open, onClose, categories, onSelectCategory }: CategoryDrawerProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const { currency } = useCurrency();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Group categories into parent → subcategories structure
  const grouped = (() => {
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
      map.set("more", { parent: "more", label: t("nav.moreCategories", "More"), subcategories: remaining.map(c => ({ slug: c.slug, label: c.name })) });
    }
    return Array.from(map.values());
  })();

  // Body scroll lock
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Escape key + focus trap
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Focus first focusable element when opened
  useEffect(() => {
    if (open && panelRef.current) {
      const focusable = panelRef.current.querySelector<HTMLElement>("button, a, [tabindex]");
      focusable?.focus();
    }
  }, [open]);

  const toggle = useCallback((parent: string) => {
    setExpanded(prev => ({ ...prev, [parent]: !prev[parent] }));
  }, []);

  const handleSelect = useCallback((slug: string | null) => {
    onSelectCategory?.(slug);
    onClose();
    navigate(slug ? `/categories/${slug}` : "/marketplace");
  }, [onSelectCategory, onClose, navigate]);

  const dashboardPath = role === "admin" ? "/admin/dashboard" : role === "seller" ? "/seller/dashboard" : "/buyer/dashboard";

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={t("nav.categories", "Categories")}
        className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out dark:bg-[#1E1E1E] sm:max-w-sm ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E8E8E8] p-4 dark:border-[#222222]">
          <h2 className="flex items-center gap-2 text-base font-bold text-[#111111] dark:text-[#FAF5F2]">
            <LayoutGrid className="h-5 w-5 text-[#F6C75D]" />
            {t("nav.allDepartments", "All Departments")}
          </h2>
          <button
            onClick={onClose}
            aria-label={t("nav.close", "Close")}
            className="rounded-full p-2 text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#2A2A2D] dark:hover:text-[#FAF5F2]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Category list */}
        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => handleSelect(null)}
            className="w-full rounded-lg px-4 py-3 text-left text-sm font-medium text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            {t("nav.allProducts", "All Products")}
          </button>

          {grouped.map(group => {
            const isOpen = !!expanded[group.parent];
            return (
              <div key={group.parent}>
                <button
                  onClick={() => toggle(group.parent)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between rounded-lg px-4 py-3 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
                >
                  <span>{group.label}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 text-[#888880]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[#888880]" />
                  )}
                </button>

                {/* Sub-category expandable panel */}
                <div
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0"}`}
                >
                  {group.subcategories.map(sub => (
                    <button
                      key={sub.slug}
                      onClick={() => handleSelect(sub.slug)}
                      className="flex w-full items-center gap-2 rounded-lg py-2 pl-8 pr-4 text-left text-xs font-normal text-[#888880] transition-colors hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FAF5F2]"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0" />
                      {sub.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer utilities */}
        <div className="mt-auto border-t border-[#E8E8E8] p-4 dark:border-[#222222]">
          {/* Language / Currency */}
          <div className="mb-3 flex items-center justify-between text-xs text-[#888880] dark:text-[#A0A0A0]">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              {currency.code} ({currency.symbol})
            </span>
            <LanguageSwitcher />
          </div>

          {/* Vendor portal CTA */}
          {user ? (
            <Link
              to={dashboardPath}
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#111111] px-4 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#222222] dark:bg-[#FAF5F2] dark:text-[#111111] dark:hover:bg-[#E8E8E8]"
            >
              <Check className="h-3.5 w-3.5" />
              {t("nav.dashboard", "Dashboard")}
            </Link>
          ) : (
            <Link
              to="/auth/register"
              onClick={onClose}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#F6C75D] px-4 py-2.5 text-xs font-bold text-[#111111] transition-colors hover:bg-[#E8B84D]"
            >
              <Store className="h-3.5 w-3.5" />
              {t("nav.becomeSeller", "Become a Seller")}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}