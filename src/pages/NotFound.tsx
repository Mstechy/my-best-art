import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft, Home, Search } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAFAFA] dark:bg-[#0E0E0E] px-4">
      <div className="text-center max-w-sm">
        {/* Large 404 */}
        <p className="text-[96px] md:text-[128px] font-black leading-none text-[#111111] dark:text-[#FAF5F2] tracking-tighter select-none">
          4<span className="text-[#F6C75D]">0</span>4
        </p>

        <h1 className="mt-2 text-xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">
          Page not found
        </h1>
        <p className="mt-2 text-sm text-[#888880] dark:text-[#A0A0A0] leading-relaxed">
          The page you're looking for doesn't exist or has been moved.
        </p>

        <p className="mt-3 text-[10px] font-mono text-[#C0C0B8] dark:text-[#444444] truncate">
          {location.pathname}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-2 justify-center">
          <Link to="/">
            <button className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              <Home className="h-3.5 w-3.5" /> Back to Home
            </button>
          </Link>
          <Link to="/marketplace">
            <button className="flex w-full sm:w-auto items-center justify-center gap-1.5 px-5 py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors">
              <Search className="h-3.5 w-3.5" /> Browse Marketplace
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
