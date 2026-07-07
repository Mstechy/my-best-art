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
  Gavel, Store, ClipboardList, LogIn, Settings, HelpCircle, LogOut, ArrowRight, MessageSquare
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
    <nav className="sticky top-0 z-50 bg-[hsl(var(--navbar))] text-[hsl(var(--navbar-foreground))] shadow-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg gradient-primary">
            <ShoppingBag className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-display text-lg font-bold hidden sm:block">MarketHub</span>
        </Link>

        {/* Search bar */}
        {showSearch && (
          <div className="flex-1 max-w-xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => onSearchChange?.(e.target.value)}
                placeholder="Search products..."
                className="pl-10 h-9 bg-[hsl(var(--navbar-foreground)/0.1)] border-[hsl(var(--navbar-foreground)/0.15)] text-[hsl(var(--navbar-foreground))] placeholder:text-[hsl(var(--navbar-foreground)/0.5)] focus-visible:ring-primary"
              />
            </div>
          </div>
        )}

        {/* Right side icons */}
        <div className="flex items-center gap-1 shrink-0">
          <CurrencySelector />
          <ThemeToggle />

          {/* Messages (logged-in only) */}
          {user && (
            <Link to={chatPath} aria-label="Messages" className="relative p-2 rounded-lg hover:bg-[hsl(var(--navbar-foreground)/0.1)] transition-colors">
              <MessageSquare className="h-5 w-5" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                  {unread > 99 ? "99+" : unread}
                </span>
              )}
            </Link>
          )}

          {/* Cart */}
          <button onClick={() => openCart(true)} className="relative p-2 rounded-lg hover:bg-[hsl(var(--navbar-foreground)/0.1)] transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                {totalItems}
              </span>
            )}
          </button>

          {/* Profile */}
          {user ? (
            <Link to={dashboardPath} className="p-2 rounded-lg hover:bg-[hsl(var(--navbar-foreground)/0.1)] transition-colors">
              <User className="h-5 w-5" />
            </Link>
          ) : (
            <Link to="/auth/login" className="p-2 rounded-lg hover:bg-[hsl(var(--navbar-foreground)/0.1)] transition-colors">
              <User className="h-5 w-5" />
            </Link>
          )}

          {/* Hamburger drawer */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="p-2 rounded-lg hover:bg-[hsl(var(--navbar-foreground)/0.1)] transition-colors">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80">
              <SheetHeader>
                <SheetTitle className="font-display flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-primary" /> MarketHub
                </SheetTitle>
              </SheetHeader>
              <nav className="mt-6 space-y-1">
                {menuItems.map(item => (
                  <SheetClose key={item.label} asChild>
                    <Link
                      to={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted transition-colors"
                    >
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                {user && (
                  <>
                    <div className="my-3 border-t border-border" />
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
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  );
}
