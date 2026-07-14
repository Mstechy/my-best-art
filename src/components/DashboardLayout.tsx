import { ReactNode, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import DashboardFooter from "@/components/DashboardFooter";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import {
  ShoppingBag, Menu, X, LogOut, User, ChevronDown,
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  Users, Megaphone, AlertTriangle, Wallet, MessageSquare, Store, Truck, Flag, Heart, Star, FileText, Layers3
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const adminNav: NavItem[] = [
  { label: "Dashboard", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Orders", href: "/admin/orders", icon: ShoppingCart },
  { label: "Users", href: "/admin/sellers", icon: Users },
  { label: "Ads", href: "/admin/ads", icon: Megaphone },
  { label: "Collections", href: "/admin/collections", icon: Layers3 },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Disputes", href: "/admin/disputes", icon: AlertTriangle },
  { label: "Site Pages", href: "/admin/pages", icon: FileText },
];

const sellerNav: NavItem[] = [
  { label: "Dashboard", href: "/seller/dashboard", icon: LayoutDashboard },
  { label: "Products", href: "/seller/products", icon: Package },
  { label: "Store Profile", href: "/seller/store", icon: Store },
  { label: "Orders", href: "/seller/orders", icon: ShoppingCart },
  { label: "Reviews", href: "/seller/reviews", icon: Star },
  { label: "Analytics", href: "/seller/analytics", icon: BarChart3 },
  { label: "Ads", href: "/seller/ads", icon: Megaphone },
  { label: "Wallet", href: "/seller/wallet", icon: Wallet },
  { label: "Chat", href: "/seller/chat", icon: MessageSquare },
];

const buyerNav: NavItem[] = [
  { label: "Dashboard", href: "/buyer/dashboard", icon: LayoutDashboard },
  { label: "Profile", href: "/buyer/profile", icon: User },
  { label: "Orders", href: "/buyer/orders", icon: ShoppingCart },
  { label: "Wishlist", href: "/buyer/wishlist", icon: Heart },
  { label: "Tracking", href: "/buyer/tracking", icon: Truck },
  { label: "Chat", href: "/buyer/chat", icon: MessageSquare },
  { label: "Reports", href: "/buyer/reports", icon: Flag },
];

function getNavItems(role: string | null): NavItem[] {
  switch (role) {
    case "admin": return adminNav;
    case "seller": return sellerNav;
    case "buyer": return buyerNav;
    default: return [];
  }
}

function getRoleLabel(role: string | null) {
  switch (role) {
    case "admin": return "Admin";
    case "seller": return "Seller";
    case "buyer": return "Buyer";
    default: return "User";
  }
}

function getInitials(name: string | null | undefined) {
  if (!name) return "U";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = getNavItems(role);
  const unread = useUnreadMessages();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">

      {/* Sidebar — always fixed, never scrolls with page */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 flex flex-col border-r border-[#E8E8E8] dark:border-[#1A1A1A] bg-white dark:bg-[#111111] transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="flex h-14 items-center justify-between px-4 border-b border-[#F2F3F5] dark:border-[#1A1A1A]">
          <Link to="/" className="flex items-center gap-2.5 select-none group">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#111111] dark:bg-[#FAF5F2] transition-transform group-hover:scale-105">
              <ShoppingBag className="h-3.5 w-3.5 text-white dark:text-[#111111]" />
            </div>
            <span className="font-bold text-sm text-[#111111] dark:text-[#FAF5F2] tracking-tight">MarketHub</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Role badge */}
        <div className="px-4 py-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#F6C75D]/15 text-[9px] font-bold text-[#5C3A00] dark:text-[#F6C75D] uppercase tracking-wider select-none">
            <span className="h-1.5 w-1.5 rounded-full bg-[#F6C75D]" />
            {getRoleLabel(role)}
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const isChat = item.href.endsWith("/chat");
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                    : "text-[#888880] dark:text-[#A0A0A0] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 rounded-r-full bg-[#F6C75D]" />
                )}
                <item.icon className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isChat && unread > 0 && (
                  <span className="inline-flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile at bottom */}
        <div className="border-t border-[#F2F3F5] dark:border-[#1A1A1A] p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors group">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#111111] dark:bg-[#FAF5F2] shrink-0">
                  <span className="text-[9px] font-bold text-white dark:text-[#111111]">
                    {getInitials(profile?.full_name)}
                  </span>
                </div>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] truncate leading-tight">
                    {profile?.full_name || "User"}
                  </p>
                  <p className="text-[9px] text-[#888880] dark:text-[#A0A0A0] truncate leading-tight">
                    {profile?.email}
                  </p>
                </div>
                <ChevronDown className="h-3 w-3 text-[#888880] shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#222222]">
              <DropdownMenuItem
                onClick={() => navigate("/marketplace")}
                className="text-xs text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] cursor-pointer"
              >
                <Store className="mr-2 h-3.5 w-3.5" /> Marketplace
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-[#E8E8E8] dark:bg-[#222222]" />
              <DropdownMenuItem
                onClick={handleSignOut}
                className="text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 cursor-pointer"
              >
                <LogOut className="mr-2 h-3.5 w-3.5" /> Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex flex-1 flex-col min-w-0 lg:pl-60">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-[#E8E8E8] dark:border-[#1A1A1A] bg-white/80 dark:bg-[#111111]/80 backdrop-blur-md px-4 lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <ThemeToggle />
          <Link to="/marketplace">
            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[11px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors">
              <Store className="h-3 w-3" /> Marketplace
            </button>
          </Link>
        </header>

        <main className="flex-1 p-4 lg:p-6">{children}</main>
        <DashboardFooter />
      </div>
    </div>
  );
}
