import { Link } from "react-router-dom";
import { Mail } from "lucide-react";

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#E8E8E8] dark:border-[#222222] bg-[#F2F3F5] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] w-full pt-12 pb-6">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">Shop</h4>
            <ul className="space-y-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
              <li><Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">All Products</Link></li>
              <li><Link to="/categories" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Categories</Link></li>
              <li><Link to="/marketplace?sort=best_sellers" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Top Sellers</Link></li>
              <li><Link to="/marketplace?promo=summer20" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Deals & Discounts</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">Sell</h4>
            <ul className="space-y-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
              <li><Link to="/auth/register" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Become a Vendor</Link></li>
              <li><Link to="/auth/login" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Merchant Dashboard</Link></li>
              <li><Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Seller Guidelines</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">Support</h4>
            <ul className="space-y-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
              <li><Link to="/auth/login" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Buyer Center</Link></li>
              <li><Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Shipping & Delivery</Link></li>
              <li><Link to="/terms" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Payment Escrow Guard</Link></li>
              <li><Link to="/contact" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">Contact Support</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">MarketHub</h4>
            <p className="text-xs text-[#888880] dark:text-[#A0A0A0] leading-relaxed">
              Connecting buyers with verified independent merchants worldwide. Shop with total peace of mind using our secure escrow payments, buyer protection guarantees, and fast global delivery.
            </p>
          </div>
        </div>
        <div className="border-t border-[#E8E8E8] dark:border-[#222222] mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#888880] dark:text-[#A0A0A0]">
          <p>&copy; {year} MarketHub. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" /> support@markethub.com
          </div>
        </div>
      </div>
    </footer>
  );
}
