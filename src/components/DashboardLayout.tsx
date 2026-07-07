import { ReactNode, useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";
import NotificationBell from "@/components/NotificationBell";
import DashboardFooter from "@/components/DashboardFooter";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { Button } from "@/components/ui/button";
import {
  ShoppingBag, Menu, X, LogOut, User, ChevronDown,
  LayoutDashboard, Package, ShoppingCart, BarChart3,
  Users, Megaphone, AlertTriangle, Wallet, MessageSquare, Store, Truck, Flag, Heart, Star, FileText
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

function getRoleGradient(role: string | null) {
  switch (role) {
    case "admin": return "gradient-admin";
    case "seller": return "gradient-seller";
    case "buyer": return "gradient-buyer";
    default: return "gradient-primary";
  }
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile, role, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navItems = getNavItems(role);
  const roleGradient = getRoleGradient(role);
  const unread = useUnreadMessages();

  const handleSignOut = async () => {
    await signOut();
    navigate("/auth/login");
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-border bg-card transition-transform duration-300 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={`h-0.5 w-full ${roleGradient}`} />
        <div className="flex h-full flex-col">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <Link to="/" className="flex items-center gap-2 group">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${roleGradient} transition-transform group-hover:scale-110`}>
                <ShoppingBag className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">MarketHub</span>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-3">
            <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary-foreground ${roleGradient}`}>
              {role === "admin" && <LayoutDashboard className="h-3 w-3" />}
              {role === "seller" && <Store className="h-3 w-3" />}
              {role === "buyer" && <ShoppingCart className="h-3 w-3" />}
              {role}
            </div>
          </div>

          <nav className="flex-1 space-y-1 px-3 py-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const isChat = item.href.endsWith("/chat");
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-0.5"
                  }`}
                >
                  {isActive && <div className={`absolute left-0 h-6 w-0.5 rounded-r ${roleGradient}`} />}
                  <item.icon className={`h-4 w-4 transition-transform duration-200 group-hover:scale-110 ${isActive ? "text-primary" : ""}`} />
                  <span className="flex-1">{item.label}</span>
                  {isChat && unread > 0 && (
                    <span className="ml-auto inline-flex h-5 min-w-[20px] px-1.5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border p-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-all duration-200 group">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${roleGradient} transition-transform group-hover:scale-105`}>
                    <User className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{profile?.full_name || "User"}</p>
                    <p className="text-xs text-muted-foreground truncate">{profile?.email}</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate("/marketplace")}>
                  <Store className="mr-2 h-4 w-4" /> Marketplace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-md px-4 lg:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-foreground hover:text-primary transition-colors">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex-1" />
          <NotificationBell />
          <ThemeToggle />
          <Link to="/marketplace">
            <Button variant="outline" size="sm" className="gap-2 hover:bg-muted/50 transition-all">
              <Store className="h-4 w-4" /> Marketplace
            </Button>
          </Link>
        </header>

        <main className="flex-1 p-4 lg:p-6 animate-fade-in">{children}</main>
        <DashboardFooter />
      </div>
    </div>
  );
}
