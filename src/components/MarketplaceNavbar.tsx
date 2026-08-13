import { useNavigate, Link } from "react-router-dom";
import type { ChangeEvent, FormEvent } from "react";
import { useEffect, useRef, useState, memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelector from "@/components/CurrencySelector";
import RegionalPreferences from "@/components/RegionalPreferences";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose
} from "@/components/ui/sheet";
import {
  Search, ShoppingCart, User, Menu, Home, Package,
  Store, ClipboardList, LogIn, HelpCircle, LogOut, ArrowRight, MessageSquare, Heart, Camera
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createVisualHash } from "@/lib/visualHash";

interface MarketplaceNavbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
  categories?: { label: string; value: string }[];
  selectedCategory?: string | null;
  onCategoryChange?: (value: string | null) => void;
}

const DEFAULT_SUGGESTIONS = ["wireless earbuds", "smart watch", "fashion", "home decor"];
interface SearchSuggestion { label: string; suggestion_type: string; category_id: string | null; }
interface NavigationCollection { title: string; slug: string; }

const buildMarketplaceUrl = (search?: string, category?: string | null) => {
  const params = new URLSearchParams();
  const query = search?.trim();
  if (query) params.set("search", query);
  if (category) params.set("category", category);
  const queryString = params.toString();
  return queryString ? `/marketplace?${queryString}` : "/marketplace";
};

const MarketplaceNavbar = memo(function MarketplaceNavbar({
  search = "",
  onSearchChange,
  showSearch = true,
  categories = [],
  selectedCategory = null,
  onCategoryChange,
}: MarketplaceNavbarProps) {
  const { t } = useTranslation();
  const { user, role, signOut } = useAuth();
  const { totalItems, setIsOpen: openCart } = useCart();
  const unread = useUnreadMessages();
  const navigate = useNavigate();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const [imageSearchOpen, setImageSearchOpen] = useState(false);
  const [imageSearchPreview, setImageSearchPreview] = useState<string | null>(null);
  const [imageSearchLabel, setImageSearchLabel] = useState("");
  const [imageSearchDataUrl, setImageSearchDataUrl] = useState<string | null>(null);
  const [imageSearchFile, setImageSearchFile] = useState<File | null>(null);
  const [imageSearchLoading, setImageSearchLoading] = useState(false);
  const [imageSearchCategory, setImageSearchCategory] = useState<string | null>(selectedCategory);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [navigationCollections, setNavigationCollections] = useState<NavigationCollection[]>([]);
  const [localSearch, setLocalSearch] = useState(search);
  const dashboardPath = role === "admin" ? "/admin/dashboard" : role === "seller" ? "/seller/dashboard" : "/buyer/dashboard";
  const chatPath = role === "buyer" ? "/buyer/chat" : "/seller/chat";

  const menuItems = [
    { icon: Home, label: t("nav.home"), href: "/" },
    { icon: Package, label: t("nav.browseProducts"), href: "/marketplace" },
    ...navigationCollections.map(collection => ({ icon: Package, label: collection.title, href: `/collections/${collection.slug}` })),
    { icon: Store, label: t("nav.sellWithUs"), href: "/auth/register?redirect=/seller/dashboard" },
    ...(user ? [
      { icon: ClipboardList, label: t("nav.myOrders"), href: role === "seller" ? "/seller/orders" : "/buyer/orders" },
      { icon: User, label: t("nav.dashboard"), href: dashboardPath },
    ] : [
      { icon: LogIn, label: t("nav.loginRegister"), href: "/auth/login?redirect=/buyer/dashboard" },
    ]),
    { icon: HelpCircle, label: t("nav.help"), href: "/" },
  ];

  const activeCategory = selectedCategory ?? "__all__";
  const hasCategories = categories.length > 0;
  const primarySuggestions = hasCategories
    ? categories.slice(0, 4).map(category => ({ label: category.label, value: category.value, kind: "category" as const }))
    : DEFAULT_SUGGESTIONS.map(value => ({ label: value, value, kind: "search" as const }));

  useEffect(() => {
    setImageSearchCategory(selectedCategory);
  }, [selectedCategory]);

  useEffect(() => {
    const loadNavigationCollections = async () => {
      // Try new show_in_navigation flag first, fall back to old placement check
      const { data } = await (supabase.from("marketplace_collections") as any)
        .select("title,slug")
        .is("seller_id", null)
        .eq("status", "active")
        .eq("show_in_navigation", true)
        .order("display_order")
        .order("sort_order");
      
      // If no results with show_in_navigation, fall back to old placement method
      if (!data || data.length === 0) {
        const { data: oldData } = await (supabase.from("marketplace_collections") as any)
          .select("title,slug")
          .is("seller_id", null)
          .eq("status", "active")
          .eq("placement", "navigation")
          .order("sort_order");
        setNavigationCollections((oldData || []) as NavigationCollection[]);
      } else {
        setNavigationCollections((data || []) as NavigationCollection[]);
      }
    };
    loadNavigationCollections();
  }, []);

  // Sync local search when prop changes (e.g., navigating between pages)
  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  // Fetch suggestions based on local search
  useEffect(() => {
    const query = localSearch.trim();
    if (query.length < 2) { setSuggestions([]); return; }
    const timer = window.setTimeout(async () => {
      const { data } = await supabase.rpc("marketplace_search_suggestions", { p_query: query, p_limit: 6 });
      setSuggestions((data || []) as SearchSuggestion[]);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [localSearch]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    navigate(buildMarketplaceUrl(localSearch, selectedCategory));
  };

  const handleQuickChip = (chip: { label: string; value: string; kind: "category" | "search" }) => {
    if (chip.kind === "category") {
      onCategoryChange?.(chip.value);
      navigate(buildMarketplaceUrl(search, chip.value));
      return;
    }

    onSearchChange?.(chip.value);
    navigate(buildMarketplaceUrl(chip.value, selectedCategory));
  };

  const chooseSuggestion = (suggestion: SearchSuggestion) => {
    setSuggestionsOpen(false);
    if (suggestion.suggestion_type === "category" && suggestion.category_id) {
      onSearchChange?.("");
      onCategoryChange?.(suggestion.category_id);
      navigate(buildMarketplaceUrl("", suggestion.category_id));
      return;
    }
    onSearchChange?.(suggestion.label);
    navigate(buildMarketplaceUrl(suggestion.label, selectedCategory));
  };

  const handleImageSearch = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    const file = files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 5 * 1024 * 1024) {
      setImageSearchLabel("Use a JPG, PNG, or WebP image up to 5 MB.");
      setImageSearchOpen(true);
      return;
    }
    const previewUrl = URL.createObjectURL(file);
    setImageSearchPreview(previewUrl);
    setImageSearchFile(file);
    setImageSearchLabel(files.length > 1 ? `${file.name} (+${files.length - 1} more)` : file.name);
    const reader = new FileReader();
    reader.onload = () => setImageSearchDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(file);
    setImageSearchOpen(true);
  };

  const submitImageSearch = async () => {
    if (!imageSearchFile) return;
    setImageSearchLoading(true);
    let visualHash: string;
    try { visualHash = (await createVisualHash(imageSearchFile)).hash; }
    catch { setImageSearchLoading(false); setImageSearchLabel("We could not read that image. Please try another JPG, PNG, or WebP."); return; }
    setImageSearchLoading(false);
    const params = new URLSearchParams();
    if (imageSearchCategory) params.set("category", imageSearchCategory);
    params.set("visual", "1");
    params.set("visualHash", visualHash);
    navigate(`/marketplace?${params.toString()}`);
    setImageSearchOpen(false);
    if (imageSearchPreview) URL.revokeObjectURL(imageSearchPreview);
    setImageSearchPreview(null);
    setImageSearchLabel("");
    setImageSearchDataUrl(null);
    setImageSearchFile(null);
  };

  const clearImageSearch = () => {
    if (imageSearchPreview) URL.revokeObjectURL(imageSearchPreview);
    setImageSearchPreview(null);
    setImageSearchLabel("");
    setImageSearchDataUrl(null);
    setImageSearchFile(null);
    setImageSearchOpen(false);
  };

  const openImagePicker = () => {
    imageInputRef.current?.click();
  };

  const handleVisualClick = () => {
    if (imageSearchPreview) {
      submitImageSearch();
    } else {
      openImagePicker();
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#E8E8E8] bg-white/90 text-[#111111] backdrop-blur-md dark:border-[#222222] dark:bg-[#111111]/90 dark:text-[#FAF5F2]">
      <div className="mx-auto max-w-7xl px-4 py-3 lg:px-8 lg:py-4">
        <div className="flex items-center gap-3">
          {/* Logo block */}
          <Link to="/" className="flex items-baseline shrink-0 select-none">
            <span className="font-sans text-xl font-black tracking-tighter text-[#111111] dark:text-[#FAF5F2] lowercase">
              market
            </span>
            <span className="font-sans text-xl font-black tracking-tighter text-[#F6C75D] lowercase">hub</span>
          </Link>

          {/* Horizontal nav links */}
          <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-[#111111]/85 dark:text-[#FAF5F2]/85 shrink-0">
            <Link to="/marketplace?promo=summer20" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("nav.dailyDeals")}</Link>
            <Link to="/marketplace?sort=best_sellers" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("nav.topSellers")}</Link>
            <Link to="/marketplace?sort=newest" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("nav.newDrops")}</Link>
          </div>

          {/* Search bar */}
          {showSearch && (
            <form onSubmit={handleSubmit} className="hidden lg:flex flex-1 items-center justify-center px-2">
              <div className="flex w-full max-w-3xl items-center rounded-full border border-[#E8E8E8] bg-white shadow-[0_10px_30px_rgba(17,17,17,0.05)] transition-shadow focus-within:shadow-[0_12px_36px_rgba(17,17,17,0.09)] dark:border-[#333333] dark:bg-[#1A1A1A]">
                {hasCategories && (
                  <div className="w-44 shrink-0 border-r border-[#E8E8E8] dark:border-[#333333]">
                    <Select value={activeCategory} onValueChange={(value) => onCategoryChange?.(value === "__all__" ? null : value)}>
                      <SelectTrigger className="h-12 w-full rounded-none border-0 bg-transparent px-4 text-sm font-medium text-[#111111] shadow-none focus:ring-0 dark:text-[#FAF5F2]">
                        <SelectValue placeholder={t("nav.allCategories")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">{t("nav.allCategories")}</SelectItem>
                        {categories.map(category => (
                          <SelectItem key={category.value} value={category.value}>
                            {category.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="relative min-w-0 flex-1">
                  <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888880]" />
                  <Input
                    value={localSearch}
                    onChange={e => { setLocalSearch(e.target.value); setSuggestionsOpen(true); }}
                    onFocus={() => setSuggestionsOpen(true)}
                    onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                    placeholder={t("nav.searchPlaceholder")}
                    className="h-12 border-0 bg-transparent pl-11 pr-12 text-sm text-[#111111] shadow-none placeholder:text-[#888880] focus-visible:ring-0 dark:text-[#FAF5F2]"
                  />
                  <button type="button" onClick={handleVisualClick} aria-label={t("nav.searchByImage")} title={t("nav.searchByImage")} className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#222222] dark:hover:text-[#FAF5F2]"><Camera className="h-4 w-4" /></button>
                  {suggestionsOpen && suggestions.length > 0 && (
                    <div className="absolute left-0 top-[calc(100%+8px)] z-[60] w-full overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white p-1.5 shadow-xl dark:border-[#333333] dark:bg-[#1A1A1A]">
                      <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#888880]">{t("nav.suggestions")}</p>
                      {suggestions.map((suggestion, index) => (
                        <button key={`${suggestion.suggestion_type}-${suggestion.category_id || suggestion.label}-${index}`} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => chooseSuggestion(suggestion)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#222222]">
                          <Search className="h-3.5 w-3.5 text-[#888880]" />
                          <span className="truncate">{suggestion.label}</span>
                          <span className="ml-auto text-[10px] text-[#888880]">{suggestion.suggestion_type === "category" ? t("nav.suggestionCategory") : t("nav.suggestionProduct")}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  type="submit"
                  className="m-1.5 h-9 rounded-full bg-[#111111] px-5 text-sm font-semibold text-white hover:bg-[#222222] dark:bg-[#FAF5F2] dark:text-[#111111] dark:hover:bg-[#E8E8E8]"
                >
                  {t("nav.search")}
                </Button>
              </div>
                <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSearch}
              />
            </form>
          )}

          {/* Right side icons */}
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0 ml-auto">
          {/* Search icon - shown when the search bar is hidden (e.g. product detail page) */}
          {!showSearch && (
            <button
              type="button"
              onClick={() => navigate("/marketplace")}
              aria-label={t("nav.search")}
              className="grid h-9 w-9 place-items-center rounded-full text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          {/* Language Switcher - hide on small mobile */}
          <div className="hidden sm:block"><LanguageSwitcher /></div>
          {/* RegionalPreferences - hide on small mobile */}
          <div className="hidden sm:block"><RegionalPreferences /></div>
          {/* Messages (logged-in only) - hide on small mobile */}
          {user && (
            <Link to={chatPath} aria-label={t("nav.messages")} className="relative p-2.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors hidden sm:inline-flex">
              <MessageSquare className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-[#F6C75D] text-[10px] font-bold text-[#5C3A00]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}

          {/* Profile - hidden on mobile (BottomTabBar handles Account on mobile) */}
          {user ? (
            <Link to={dashboardPath} aria-label={t("nav.openDashboard")} className="p-2.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors hidden md:inline-flex">
              <User className="h-5 w-5" />
            </Link>
          ) : (
            <Link to="/auth/login" aria-label={t("nav.login")} className="p-2.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors hidden md:inline-flex">
              <User className="h-5 w-5" />
            </Link>
          )}

          {/* Wishlist - hide on small mobile */}
          {user && (
            <Link to="/buyer/wishlist" aria-label={t("nav.wishlist")} className="p-2.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors hidden sm:inline-flex">
              <Heart className="h-5 w-5" />
            </Link>
          )}

          {/* Cart - hidden on mobile (BottomTabBar handles Cart on mobile) */}
          <button
            onClick={() => openCart(true)}
            className="relative p-2.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors hidden md:inline-flex"
            aria-label={t("nav.openCart")}
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#F6C75D] text-[10px] font-bold text-[#5C3A00]">
                {totalItems}
              </span>
            )}
          </button>

          {/* Hamburger drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors" aria-label={t("nav.openNavigationMenu")}> 
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-white dark:bg-[#111111] border-l border-[#E8E8E8] dark:border-[#222222] text-[#111111] dark:text-[#FAF5F2] flex flex-col justify-between">
              <div>
                <SheetHeader className="mb-4">
                  <SheetTitle className="font-sans text-xl font-bold tracking-tight text-[#111111] dark:text-[#FAF5F2] flex items-center gap-2">
                    MarketHub
                  </SheetTitle>
                </SheetHeader>
                <nav className="space-y-1">
                  {menuItems.map(item => (
                    <SheetClose key={item.label} asChild>
                      <Link
                        to={item.href}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
                      >
                        <item.icon className="h-4 w-4 text-[#888880]" />
                        {item.label}
                      </Link>
                    </SheetClose>
                  ))}
                  {user && (
                    <>
                      <div className="my-3 border-t border-[#E8E8E8] dark:border-[#222222]" />
                      <button
                        onClick={() => signOut()}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <LogOut className="h-4 w-4" />
                        {t("nav.signOut")}
                      </button>
                    </>
                  )}
                </nav>
              </div>

              {/* Bottom selectors in sidebar */}
              <div className="border-t border-[#E8E8E8] dark:border-[#222222] pt-4 mt-auto space-y-4">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-[#888880] font-medium">{t("nav.switchLanguage")}</span>
                  <LanguageSwitcher />
                </div>
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-[#888880] font-medium">{t("nav.currency")}</span>
                  <CurrencySelector />
                </div>
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-[#888880] font-medium">{t("nav.theme")}</span>
                  <ThemeToggle />
                </div>
              </div>
            </SheetContent>
          </Sheet>
          </div>
        </div>

        {showSearch && (
          <>
            <form onSubmit={handleSubmit} className="mt-3 lg:hidden">
              <div className="relative min-w-0 flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#888880]" />
                <Input
                  value={localSearch}
                  onChange={e => { setLocalSearch(e.target.value); setSuggestionsOpen(true); }}
                  onFocus={() => setSuggestionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestionsOpen(false), 120)}
                  placeholder={t("nav.searchPlaceholderMobile")}
                  className="h-11 rounded-full border border-[#E8E8E8] bg-white pl-10 pr-20 text-sm text-[#111111] shadow-none placeholder:text-[#888880] focus-visible:ring-0 dark:border-[#333333] dark:bg-[#1A1A1A] dark:text-[#FAF5F2]"
                />
                <button type="button" onClick={handleVisualClick} aria-label={t("nav.searchByImage")} title={t("nav.searchByImage")} className="absolute right-11 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#222222] dark:hover:text-[#FAF5F2]"><Camera className="h-4 w-4" /></button>
                <button type="submit" aria-label={t("nav.search")} className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-[#111111] text-white transition-colors hover:bg-[#222222] dark:bg-[#FAF5F2] dark:text-[#111111] dark:hover:bg-[#E8E8E8]"><ArrowRight className="h-4 w-4" /></button>
                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute left-0 top-[calc(100%+8px)] z-[60] w-full overflow-hidden rounded-2xl border border-[#E8E8E8] bg-white p-1.5 shadow-xl dark:border-[#333333] dark:bg-[#1A1A1A]">
                    <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.16em] text-[#888880]">{t("nav.suggestions")}</p>
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={`${suggestion.suggestion_type}-${suggestion.category_id || suggestion.label}-${index}`}
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => chooseSuggestion(suggestion)}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
                      >
                        <Search className="h-3.5 w-3.5 text-[#888880]" />
                        <span className="truncate">{suggestion.label}</span>
                        <span className="ml-auto text-[10px] text-[#888880]">{suggestion.suggestion_type === "category" ? t("nav.suggestionCategory") : t("nav.suggestionProduct")}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </form>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageSearch}
            />

            <Dialog open={imageSearchOpen} onOpenChange={(open) => (open ? setImageSearchOpen(true) : clearImageSearch())}>
              <DialogContent className="max-w-md rounded-3xl border-[#E8E8E8] bg-white p-0 shadow-2xl dark:border-[#222222] dark:bg-[#111111]">
                <DialogHeader className="border-b border-[#E8E8E8] px-5 py-4 dark:border-[#222222]">
                  <DialogTitle className="text-base font-bold text-[#111111] dark:text-[#FAF5F2]">{t("nav.searchByImage")}</DialogTitle>
                  <DialogDescription className="text-xs text-[#888880] dark:text-[#A0A0A0]">
                    {t("nav.searchByImageDesc")}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 px-5 py-5">
                  <button
                    type="button"
                    onClick={openImagePicker}
                    className="flex min-h-40 w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#C8C8C0] bg-[#FAFAFA] px-4 text-center transition-colors hover:bg-[#F2F3F5] dark:border-[#333333] dark:bg-[#1A1A1A] dark:hover:bg-[#202020]"
                  >
                    {imageSearchPreview ? (
                      <img src={imageSearchPreview} alt="Preview upload" className="max-h-40 rounded-xl object-contain" />
                    ) : (
                      <>
                        <Camera className="h-10 w-10 text-[#888880]" />
                        <p className="mt-3 text-sm font-semibold text-[#111111] dark:text-[#FAF5F2]">{t("nav.tapToUpload")}</p>
                        <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">PNG, JPG, WEBP</p>
                      </>
                    )}
                  </button>
                  {imageSearchLabel && (
                    <p className="truncate text-xs text-[#888880] dark:text-[#A0A0A0]">
                      File: {imageSearchLabel}
                    </p>
                  )}
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={clearImageSearch}
                      className="flex-1 rounded-full"
                    >
                      {t("nav.cancel")}
                    </Button>
                    <Button
                      type="button"
                      onClick={submitImageSearch}
                      className="flex-1 rounded-full bg-[#111111] text-white hover:bg-[#222222] dark:bg-[#FAF5F2] dark:text-[#111111]"
                    >
                      {imageSearchLoading ? t("nav.analysingImage") : t("nav.searchSimilar")}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <div className="mt-3 hidden lg:flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#888880] dark:text-[#A0A0A0]">
                {t("nav.trending")}
              </span>
              {primarySuggestions.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => handleQuickChip(item)}
                  className="rounded-full border border-[#E8E8E8] bg-white px-3 py-1.5 text-xs font-medium text-[#111111] transition-colors hover:border-[#111111] hover:bg-[#F8F8F8] dark:border-[#333333] dark:bg-[#1A1A1A] dark:text-[#FAF5F2] dark:hover:border-[#FAF5F2] dark:hover:bg-[#202020]"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </>
          )}
      </div>
    </nav>
  );
});

export default MarketplaceNavbar;
