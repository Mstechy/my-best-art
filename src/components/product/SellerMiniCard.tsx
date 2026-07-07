import { Link } from "react-router-dom";
import { Store, CheckCircle2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="rounded-xl border border-border/60 p-4 bg-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted overflow-hidden shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Store className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-medium text-foreground truncate">{name || "Seller"}</span>
              {isVerified && <CheckCircle2 className="h-4 w-4 text-accent shrink-0" />}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {typeof rating === "number" && rating > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  {rating.toFixed(1)}
                </span>
              )}
              {typeof soldCount === "number" && soldCount > 0 && (
                <span>{soldCount >= 100 ? `${Math.floor(soldCount / 100) * 100}+ sold` : `${soldCount} sold`}</span>
              )}
              {typeof followers === "number" && followers > 0 && <span>{followers} followers</span>}
            </div>
          </div>
        </div>
        <Link to={`/seller/${sellerId}`}>
          <Button variant="outline" size="sm">Visit Store</Button>
        </Link>
      </div>
    </div>
  );
}
