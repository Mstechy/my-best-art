import { useEffect, useRef, useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, ChevronDown, X, Home, Settings, Globe, Coins, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import CurrencySelector from "@/components/CurrencySelector";
import ThemeToggle from "@/components/ThemeToggle";

export interface DrawerCategory {
  id: string;
  name: string;
  slug: string;
  thumbnail?: string | null;
}

export interface DrawerSectionItem {
  label: string;
  href: string;
}

interface NavDrawerProps {
  open: boolean;
  onClose: () => void;
  categories: DrawerCategory[];
  secondaryItems?: DrawerSectionItem[];
  settingsItems?: DrawerSectionItem[];
  className?: string;
}

/**
 * Left slide-in navigation drawer with dynamic categories.
 * Accessible: focus trap, Escape close, role="dialog", aria-modal="true".
 */
export function NavDrawer({
  open,
  onClose,
  categories,
  secondaryItems = [],
  settingsItems = [],
  className,
}: NavDrawerProps) {
  const [popularOpen, setPopularOpen] = useState(true);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Body scroll lock + Escape + focus trap
  useEffect(() => {
    if (!open) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab" || !panelRef.current) return;
      // Focus trap
      const focusables = panelRef.current.querySelectorAll<HTMLElement>("button, a, [href], [tabindex]:not([tabindex='-1'])");
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey);
    const focusable = panelRef.current?.querySelector<HTMLElement>("button, a, [href]");
    focusable?.focus();

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
      previouslyFocusedRef.current?.focus();
    };
  }, [open, onClose]);

  return (
    <div className={cn("fixed inset-0 z-[70]", !open && "pointer-events-none", className)} aria-hidden={!open}>
      {/* Dimmed overlay */}
      <div
        className={cn("absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className={cn(
          "absolute inset-y-0 left-0 flex w-full max-w-xs flex-col bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-[#1E1E1E] sm:max-w-sm",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header with close */}
        <div className="flex items-center justify-between border-b border-[#E8E8E8] p-4 dark:border-[#222222]">
          <span className="font-sans text-lg font-black tracking-tighter text-[#111111] dark:text-[#FAF5F2] lowercase">
            market<span className="text-[#F6C75D]">hub</span>
          </span>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="rounded-full p-2 text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#2A2A2D] dark:hover:text-[#FAF5F2]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-2">
          {/* Home link */}
          <Link to="/" onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]">
            <Home className="h-4 w-4 text-[#888880]" /> Home
          </Link>

          {/* Popular Category — expandable */}
          <button
            onClick={() => setPopularOpen(v => !v)}
            aria-expanded={popularOpen}
            className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]"
          >
            <span>Popular Category</span>
            {popularOpen ? <ChevronDown className="h-4 w-4 text-[#888880]" /> : <ChevronRight className="h-4 w-4 text-[#888880]" />}
          </button>
          <div className={cn("overflow-hidden transition-all duration-300", popularOpen ? "max-h-96 opacity-100" : "max-h-0 opacity-0")}>
            {categories.map(cat => (
              <Link
                key={cat.id || cat.slug}
                to={`/categories/${cat.slug}`}
                onClick={onClose}
                className="flex items-center gap-3 rounded-lg py-2 pl-8 pr-3 text-sm text-[#888880] transition-colors hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FAF5F2]"
              >
                {cat.thumbnail ? (
                  <img src={cat.thumbnail} alt="" className="h-6 w-6 rounded object-cover" />
                ) : (
                  <span className="grid h-6 w-6 place-items-center rounded bg-[#F2F3F5] dark:bg-[#2A2A2D]"><ChevronRight className="h-3 w-3 text-[#888880]" /></span>
                )}
                <span className="truncate">{cat.name}</span>
              </Link>
            ))}
            {categories.length === 0 && (
              <p className="px-8 py-2 text-xs text-[#888880] dark:text-[#A0A0A0]">No categories available.</p>
            )}
          </div>

          {/* Secondary section */}
          {secondaryItems.length > 0 && (
            <div className="mt-2 border-t border-[#F2F3F5] pt-2 dark:border-[#222222]">
              {secondaryItems.map(item => (
                <Link key={item.href} to={item.href} onClick={onClose} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2D]">
                  {item.label}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Settings section */}
        <div className="border-t border-[#E8E8E8] p-4 dark:border-[#222222]">
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">
            <Settings className="h-3.5 w-3.5" /> Settings
          </p>
          <div className="space-y-2">
            {/* Language */}
            <div className="flex items-center justify-between rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#888880] dark:text-[#A0A0A0]">
                <Globe className="h-4 w-4" /> Language
              </span>
              <LanguageSwitcher />
            </div>
            {/* Currency */}
            <div className="flex items-center justify-between rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#888880] dark:text-[#A0A0A0]">
                <Coins className="h-4 w-4" /> Currency
              </span>
              <CurrencySelector />
            </div>
            {/* Theme */}
            <div className="flex items-center justify-between rounded-lg px-3 py-2">
              <span className="flex items-center gap-2 text-sm text-[#888880] dark:text-[#A0A0A0]">
                <Moon className="h-4 w-4" /> Theme
              </span>
              <ThemeToggle />
            </div>
            {settingsItems.map(item => (
              <Link key={item.href} to={item.href} onClick={onClose} className="block rounded-lg px-3 py-2 text-sm text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:bg-[#2A2A2D] dark:hover:text-[#FAF5F2]">
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default NavDrawer;