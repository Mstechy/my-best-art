import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Camera, MapPin, Flame, LayoutGrid, Tag, Zap, ShoppingCart, User, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

interface HomeHeaderProps {
  categories?: { label: string; value: string }[];
  className?: string;
}

const SHORTCUTS = [
  { icon: Flame, label: "Deals", href: "/marketplace?promo=summer20" },
  { icon: LayoutGrid, label: "Categories", href: "/categories" },
  { icon: Tag, label: "Promotions", href: "/marketplace?sort=best_sellers" },
  { icon: Zap, label: "New Drops", href: "/marketplace?sort=newest" },
];

/**
 * Home page header (mobile-first): logo + location, full search bar with
 * camera/visual-search icon, and a horizontal icon shortcut row.
 */
export function HomeHeader({ categories = [], className }: HomeHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { totalItems, setIsOpen: openCart } = useCart();
  const [query, setQuery] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/marketplace?search=${encodeURIComponent(q)}` : "/marketplace");
  };

  return (
    <header className={cn("sticky top-0 z-50 border-b border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#111111]", className)}>
      <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8">
        {/* Top row: logo + location + icons */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Link to="/" className="flex items-baseline select-none">
              <span className="font-sans text-xl font-black tracking-tighter text-[#111111] dark:text-[#FAF5F2] lowercase">market</span>
              <span className="font-sans text-xl font-black tracking-tighter text-[#F6C75D] lowercase">hub</span>
            </Link>
            <span className="hidden items-center gap-1 text-[11px] font-medium text-[#888880] sm:flex dark:text-[#A0A0A0]">
              <MapPin className="h-3 w-3" /> Ship to: All
            </span>
          </div>
          <div className="flex items-center gap-0.5">
            {user && (
              <Link to="/buyer/wishlist" aria-label={t("nav.wishlist")} className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]">
                <Heart className="h-5 w-5" />
              </Link>
            )}
            <button onClick={() => openCart(true)} aria-label={t("nav.openCart")} className="relative rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F6C75D] text-[10px] font-bold text-[#5C3A00]">{totalItems}</span>
              )}
            </button>
            <Link to={user ? "/buyer/dashboard" : "/auth/login"} aria-label={t("nav.account", "Account")} className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]">
              <User className="h-5 w-5" />
            </Link>
          </div>
        </div>

        {/* Full search bar with camera icon */}
        <form onSubmit={handleSearch} className="mt-3">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888880]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("nav.searchPlaceholder")}
              className="h-11 w-full rounded-full border border-[#E8E8E8] bg-[#F7F7F5] pl-10 pr-12 text-sm text-[#111111] outline-none transition-colors focus:border-[#111111] dark:border-[#333333] dark:bg-[#1A1A1A] dark:text-[#FAF5F2] dark:focus:border-[#FAF5F2]"
            />
            <button type="button" aria-label={t("nav.searchByImage")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#222222] dark:hover:text-[#FAF5F2]">
              <Camera className="h-4 w-4" />
            </button>
          </div>
        </form>

        {/* Icon shortcut row */}
        <div className="mt-3 flex items-center gap-4 overflow-x-auto pb-1">
          {SHORTCUTS.map((s) => (
            <Link key={s.label} to={s.href} className="flex shrink-0 flex-col items-center gap-1 text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2]">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-[#F2F3F5] dark:bg-[#2A2A2D]">
                <s.icon className="h-5 w-5 text-[#F6C75D]" />
              </span>
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}

export default HomeHeader;