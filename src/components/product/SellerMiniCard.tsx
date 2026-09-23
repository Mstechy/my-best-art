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
  chatHref?: string;
  onVerifiedClick?: () => void;
}

export default function SellerMiniCard({ sellerId, name, avatarUrl, isVerified, rating, soldCount, followers, chatHref, onVerifiedClick }: Props) {
  return (
    <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FAFAFA] dark:bg-[#111111] overflow-hidden shrink-0 border border-[#E8E8E8] dark:border-[#222222]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className="text-sm font-bold text-[#666666] dark:text-[#A0A0A0]">{name?.trim().charAt(0).toUpperCase() || <Store className="h-5 w-5" />}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] truncate">{name || "Store Seller"}</span>
              {isVerified && <button type="button" onClick={onVerifiedClick} className="shrink-0 rounded-full text-[#22C55E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D]" aria-label="Learn about seller verification"><CheckCircle2 className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="mt-1 flex items-center gap-2.5 text-[10px] font-semibold text-[#888880] flex-wrap">
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
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {chatHref && <Link to={chatHref} className="flex h-11 w-11 items-center justify-center rounded-full border border-[#E8E8E8] bg-[#FAFAFA] text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:border-[#2A2A2A] dark:bg-[#111111] dark:text-[#FAF5F2] dark:hover:bg-[#222222]" aria-label="Chat with seller"><MessageSquare className="h-4 w-4" /></Link>}
          <Link to={`/seller/${sellerId}`} className="flex h-11 items-center justify-center rounded-full border border-[#E8E8E8] bg-[#FAFAFA] px-4 text-xs font-bold text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:border-[#2A2A2A] dark:bg-[#111111] dark:text-[#FAF5F2] dark:hover:bg-[#222222]">Visit Store</Link>
        </div>
      </div>
    </div>
  );
}
