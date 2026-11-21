import { Link } from "react-router-dom";
import { Store, CheckCircle2, MessageSquare, Star } from "lucide-react";

interface Props {
  sellerId: string;
  name: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  rating?: number;
  soldCount?: number;
  followers?: number;
  reviewCount?: number;
  chatHref?: string;
  onVerifiedClick?: () => void;
}

export default function SellerMiniCard({ sellerId, name, avatarUrl, isVerified, rating, soldCount, followers, reviewCount, chatHref, onVerifiedClick }: Props) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[#E8D477] bg-gradient-to-br from-[#FFF8D6] via-white to-[#F7FAF5] p-4 shadow-sm dark:border-[#6E5A1B] dark:from-[#2A2410] dark:via-[#1A1A1A] dark:to-[#172018]">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-[#F6C75D]" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#F6C75D] dark:bg-[#6E5A1B] overflow-hidden shrink-0 border border-[#E8D477] dark:border-[#8A7225]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{name?.trim().charAt(0).toUpperCase() || <Store className="h-5 w-5" />}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] truncate">{name || "Store Seller"}</span>
              {isVerified && <button type="button" onClick={onVerifiedClick} className="shrink-0 rounded-full text-[#22C55E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D]" aria-label="Learn about seller verification"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="mt-1 flex items-center gap-2.5 text-[10px] font-semibold text-[#6E6C64] flex-wrap">
              {typeof rating === "number" && rating > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-[#F6C75D] text-[#F6C75D]" />
                  {rating.toFixed(1)}
                </span>
              )}
              {typeof soldCount === "number" && soldCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[#D9D9D9] dark:bg-[#333333]"></span>
                  {soldCount >= 100 ? `${Math.floor(soldCount / 100) * 100}+ sold` : `${soldCount} sold`}
                </span>
              )}
              {typeof followers === "number" && followers >= 50 && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[#D9D9D9] dark:bg-[#333333]"></span>
                  {followers} followers
                </span>
              )}
              {(!reviewCount || reviewCount === 0) && <span className="text-[#8A6A00] dark:text-[#F6C75D]">New seller · No reviews yet</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {chatHref && <Link to={chatHref} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E8D477] bg-white/80 text-[#111111] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:border-[#6E5A1B] dark:bg-[#111111] dark:text-[#FAF5F2] dark:hover:bg-[#222222]" aria-label="Chat with seller"><MessageSquare className="h-4 w-4" /></Link>}
          <Link to={`/seller/${sellerId}`} className="flex h-11 items-center justify-center rounded-full bg-[#111111] px-4 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#2B2B2B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#FAF5F2] dark:text-[#111111] dark:hover:bg-white">Visit Store</Link>
        </div>
      </div>
    </div>
  );
}
