import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Menu, Search, ShoppingCart, User, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { NavDrawer, type DrawerCategory, type DrawerSectionItem } from "@/components/ui/NavDrawer";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  categories?: DrawerCategory[];
  secondaryItems?: DrawerSectionItem[];
  settingsItems?: DrawerSectionItem[];
  className?: string;
}

/**
 * Compact inner-page header (mobile-first): back arrow + hamburger + logo,
 * with search/cart/account icons right-aligned. Search is an ICON that
 * navigates to the marketplace search (Part 10.1).
 */
export function PageHeader({ categories = [], secondaryItems = [], settingsItems = [], className }: PageHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { totalItems, setIsOpen: openCart } = useCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const dashboardPath = user ? "/buyer/dashboard" : "/auth/login";

  return (
    <header className={cn("sticky top-0 z-50 border-b border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#111111]", className)}>
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-2 px-4 lg:px-8">
        {/* Left: back + hamburger + logo */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate(-1)}
            aria-label={t("nav.back", "Back")}
            className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label={t("nav.openNavigationMenu")}
            className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link to="/" className="ml-1 flex items-baseline select-none">
            <span className="font-sans text-lg font-black tracking-tighter text-[#111111] dark:text-[#FAF5F2] lowercase">market</span>
            <span className="font-sans text-lg font-black tracking-tighter text-[#F6C75D] lowercase">hub</span>
          </Link>
        </div>

        {/* Right: search + cart + account */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={() => navigate("/marketplace")}
            aria-label={t("nav.search")}
            className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            <Search className="h-5 w-5" />
          </button>
          {user && (
            <Link
              to="/buyer/wishlist"
              aria-label={t("nav.wishlist")}
              className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
            >
              <Heart className="h-5 w-5" />
            </Link>
          )}
          <button
            onClick={() => openCart(true)}
            aria-label={t("nav.openCart")}
            className="relative rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F6C75D] text-[10px] font-bold text-[#5C3A00]">
                {totalItems}
              </span>
            )}
          </button>
          <Link
            to={dashboardPath}
            aria-label={t("nav.account", "Account")}
            className="rounded-full p-2 text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            <User className="h-5 w-5" />
          </Link>
        </div>
      </div>

      {/* Navigation drawer */}
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        categories={categories}
        secondaryItems={secondaryItems}
        settingsItems={settingsItems}
      />
    </header>
  );
}

export default PageHeader;