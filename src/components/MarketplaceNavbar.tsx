import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import ThemeToggle from "@/components/ThemeToggle";
import CurrencySelector from "@/components/CurrencySelector";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose
} from "@/components/ui/sheet";
import {
  ShoppingBag, Search, ShoppingCart, User, Menu, Home, Package,
  Gavel, Store, ClipboardList, LogIn, Settings, HelpCircle, LogOut, ArrowRight, MessageSquare,
  MapPin, LayoutGrid, Heart
} from "lucide-react";

interface MarketplaceNavbarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  showSearch?: boolean;
}

export default function MarketplaceNavbar({ search = "", onSearchChange, showSearch = true }: MarketplaceNavbarProps) {
  const { user, role, profile, signOut } = useAuth();
  const { totalItems, setIsOpen: openCart } = useCart();
  const unread = useUnreadMessages();
  const dashboardPath = role === "admin" ? "/admin/dashboard" : role === "seller" ? "/seller/dashboard" : "/buyer/dashboard";
  const chatPath = role === "buyer" ? "/buyer/chat" : "/seller/chat";

  const menuItems = [
    { icon: Home, label: "Home", href: "/" },
    { icon: Package, label: "Browse Products", href: "/marketplace" },
    { icon: Store, label: "Sell With Us", href: "/auth/register" },
    ...(user ? [
      { icon: ClipboardList, label: "My Orders", href: role === "seller" ? "/seller/orders" : "/buyer/orders" },
      { icon: User, label: "Dashboard", href: dashboardPath },
    ] : [
      { icon: LogIn, label: "Login / Register", href: "/auth/login" },
    ]),
    { icon: HelpCircle, label: "Help", href: "/" },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-[#FFFFFF] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] border-b border-[#E8E8E8] dark:border-[#222222] w-full">

      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-8">
        {/* Logo block */}
        <Link to="/" className="flex flex-col items-start shrink-0 mr-2 group select-none">
          <span className="font-sans text-xl font-black tracking-tighter text-[#111111] dark:text-[#FAF5F2] lowercase flex items-baseline">
            market
            <span className="text-[#F6C75D] font-extrabold text-sm ml-0.5 leading-none">.</span>
          </span>
          <div className="h-0.5 w-12 bg-[#F6C75D] rounded-full -mt-0.5 ml-1 transform group-hover:scale-x-110 transition-transform duration-200" />
        </Link>

        {/* ALL grid menu button */}
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] shrink-0 border border-[#E8E8E8] dark:border-[#222222] transition-colors duration-200">
          <LayoutGrid className="h-3.5 w-3.5" />
          ALL
        </button>

        {/* Horizontal nav links */}
        <div className="hidden lg:flex items-center gap-6 text-[13px] font-medium text-[#111111]/85 dark:text-[#FAF5F2]/85 shrink-0 mr-6">
          <Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Daily Deals</Link>
          <Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Top Sellers</Link>
          <Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">New Drops</Link>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="flex-1 max-w-md mx-auto">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[#888880] dark:text-[#888880]" />
              <Input
                value={search}
                onChange={e => onSearchChange?.(e.target.value)}
                placeholder="Search"
                className="pl-10 h-9 bg-white dark:bg-[#1E1E1E] border border-[#E8E8E8] dark:border-[#333333] text-[#111111] dark:text-[#FAF5F2] placeholder:text-[#888880] focus-visible:ring-1 focus-visible:ring-[#111111] dark:focus-visible:ring-[#FAF5F2] rounded-full"
              />
            </div>
          </div>
        )}

        {/* Right side icons */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* Messages (logged-in only) */}
          {user && (
            <Link to={chatPath} aria-label="Messages" className="relative p-2 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors">
              <MessageSquare className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-[#F6C75D] text-[10px] font-bold text-[#5C3A00]">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}

          {/* Profile */}
          {user ? (
            <Link to={dashboardPath} aria-label="Open dashboard" className="p-2 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors">
              <User className="h-5 w-5" />
            </Link>
          ) : (
            <Link to="/auth/login" aria-label="Log in" className="p-2 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors">
              <User className="h-5 w-5" />
            </Link>
          )}

          {/* Wishlist */}
          {user && (
            <Link to="/buyer/wishlist" aria-label="Wishlist" className="p-2 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors">
              <Heart className="h-5 w-5" />
            </Link>
          )}

          {/* Cart */}
          <button
            onClick={() => openCart(true)}
            className="relative p-2 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors"
            aria-label="Open cart"
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
              <button className="p-2 rounded-full hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2] transition-colors" aria-label="Open navigation menu">
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
                        Sign Out
                      </button>
                    </>
                  )}
                </nav>
              </div>

              {/* Bottom selectors in sidebar */}
              <div className="border-t border-[#E8E8E8] dark:border-[#222222] pt-4 mt-auto space-y-4">
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-[#888880] font-medium">Currency</span>
                  <CurrencySelector />
                </div>
                <div className="flex items-center justify-between px-3">
                  <span className="text-xs text-[#888880] font-medium">Theme</span>
                  <ThemeToggle />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
