import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, LayoutGrid, ShoppingCart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";

interface BottomTabBarProps {
  className?: string;
}

/**
 * Persistent bottom tab bar: Home | Category | Cart | Account.
 * Cart & Account gate on auth: logged out → /auth/login.
 * Active tab shows a filled/colored indicator.
 */
export function BottomTabBar({ className }: BottomTabBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { totalItems } = useCart();

  const path = location.pathname;
  const isHome = path === "/";
  const isCategory = path.startsWith("/marketplace") || path.startsWith("/categories") || path.startsWith("/collections");
  const isCart = path.startsWith("/cart") || path.startsWith("/checkout");
  const isAccount = path.startsWith("/buyer") || path.startsWith("/seller") || path.startsWith("/admin") || path.startsWith("/auth");

  const handleGated = (destination: string) => {
    if (!user) {
      navigate("/auth/login");
      return;
    }
    navigate(destination);
  };

  return (
    <nav
      aria-label="Bottom navigation"
      className={cn(
        "fixed bottom-0 inset-x-0 z-50 border-t border-[#E8E8E8] bg-white dark:border-[#222222] dark:bg-[#111111]",
        "pb-[env(safe-area-inset-bottom,0px)]",
        className
      )}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-4">
        {/* Home */}
        <Link
          to="/"
          className={cn(
            "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors",
            isHome ? "text-[#F6C75D]" : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
          )}
        >
          <Home className={cn("h-5 w-5", isHome && "fill-current")} />
          Home
        </Link>

        {/* Category */}
        <Link
          to="/marketplace"
          className={cn(
            "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors",
            isCategory ? "text-[#F6C75D]" : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
          )}
        >
          <LayoutGrid className={cn("h-5 w-5", isCategory && "fill-current")} />
          Category
        </Link>

        {/* Cart */}
        <button
          onClick={() => handleGated(user ? "/buyer/orders" : "/auth/login")}
          className={cn(
            "relative flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors",
            isCart ? "text-[#F6C75D]" : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
          )}
        >
          <span className="relative">
            <ShoppingCart className={cn("h-5 w-5", isCart && "fill-current")} />
            {totalItems > 0 && (
              <span className="absolute -right-2 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E53935] px-1 text-[9px] font-bold text-white">
                {totalItems > 99 ? "99+" : totalItems}
              </span>
            )}
          </span>
          Cart
        </button>

        {/* Account */}
        <button
          onClick={() => {
            if (!user) {
              navigate("/auth/login");
              return;
            }
            navigate("/buyer/dashboard");
          }}
          className={cn(
            "flex flex-col items-center gap-0.5 py-2.5 text-[10px] font-semibold transition-colors",
            isAccount ? "text-[#F6C75D]" : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
          )}
        >
          <User className={cn("h-5 w-5", isAccount && "fill-current")} />
          Account
        </button>
      </div>
    </nav>
  );
}

export default BottomTabBar;