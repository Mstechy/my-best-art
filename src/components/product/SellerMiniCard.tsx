import { Link } from "react-router-dom";
import { Store, CheckCircle2, Star } from "lucide-react";

interface Props {
  sellerId: string;
  name: string | null;
  avatarUrl?: string | null;
  isVerified?: boolean;
  rating?: number;
  soldCount?: number;
  followers?: number;
}

export default function SellerMiniCard({ sellerId, name, avatarUrl, isVerified, rating, soldCount, followers }: Props) {
  return (
    <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#FAFAFA] dark:bg-[#111111] overflow-hidden shrink-0 border border-[#E8E8E8] dark:border-[#222222]">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="h-5 w-5 text-[#888880]" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] truncate">{name || "Store Seller"}</span>
              {isVerified && <CheckCircle2 className="h-3.5 w-3.5 text-[#22C55E] shrink-0" />}
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
              {typeof followers === "number" && followers > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-1 h-1 rounded-full bg-[#D9D9D9] dark:bg-[#333333]"></span>
                  {followers} followers
                </span>
              )}
            </div>
          </div>
        </div>
        <Link to={`/seller/${sellerId}`}>
          <button className="shrink-0 px-4 py-1.5 rounded-full border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] text-xs font-bold hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors">
            Visit Store
          </button>
        </Link>
      </div>
    </div>
  );
}
