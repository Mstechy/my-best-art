import { Link } from "react-router-dom";
import { CheckCircle2, Flame, Heart, Package, ShoppingCart, Star } from "lucide-react";

import FlashDealCountdown from "@/components/FlashDealCountdown";
import ProductImage from "@/components/product/ProductImage";
import { BrandCard } from "@/components/ui/BrandCard";
import { cn } from "@/lib/utils";

export type ProductCardProduct = {
  id: string;
  title: string;
  price: number;
  compareAtPrice?: number | null;
  stockQuantity: number;
  averageRating?: number;
  reviewCount?: number;
  imageUrl?: string | null;
  flashDealEndAt?: string | null;
  badge?: { label: string; tone?: "destructive" | "seller" | "accent" } | null;
  videoUrl?: string | null;
};

type ProductCardProps = {
  product: ProductCardProduct;
  formatPrice: (amount: number) => string;
  sellerName?: string;
  sellerVerified?: boolean;
  onProductClick?: () => void;
  onBuyNow?: () => void;
  onAddToCart?: () => void;
  onToggleWishlist?: () => void;
  isWishlisted?: boolean;
  showWishlist?: boolean;
  buyNowLabel?: string;
  addToCartLabel?: string;
  addToWishlistLabel?: string;
  removeFromWishlistLabel?: string;
  className?: string;
};

const badgeTone = {
  destructive: "bg-destructive text-destructive-foreground",
  seller: "bg-seller text-seller-foreground",
  accent: "bg-accent text-accent-foreground",
};

/**
 * Marketplace card with a stable image area and a bottom-aligned purchase zone.
 * Behavior remains controlled by the parent so data flow stays page-specific.
 */
export function ProductCard({
  product,
  formatPrice,
  sellerName,
  sellerVerified = false,
  onProductClick,
  onBuyNow,
  onAddToCart,
  onToggleWishlist,
  isWishlisted = false,
  showWishlist = false,
  buyNowLabel,
  addToCartLabel,
  addToWishlistLabel,
  removeFromWishlistLabel,
  className,
}: ProductCardProps) {
  const compareAtVisible = product.compareAtPrice && product.compareAtPrice > product.price;
  const unavailable = product.stockQuantity === 0;
  const showPurchaseActions = Boolean(onBuyNow || onAddToCart);

  return (
    <BrandCard className={cn("group relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md", className)}>
      <Link to={`/product/${product.id}`} onClick={onProductClick} className="block">
        <div className="relative aspect-square w-full overflow-hidden bg-muted">
          {product.imageUrl ? (
            <ProductImage src={product.imageUrl} alt={product.title} className="group-hover:scale-105" loading="lazy" />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              <Package className="h-8 w-8" />
            </div>
          )}
          {product.videoUrl && (
            <video src={product.videoUrl} muted playsInline loop preload="none" className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" onMouseEnter={(event) => { event.currentTarget.play().catch(() => {}); }} onMouseLeave={(event) => { event.currentTarget.pause(); }} />
          )}
          {product.badge && (
            <span className={cn("absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold shadow-sm", badgeTone[product.badge.tone ?? "destructive"])}>
              {product.badge.tone === "seller" && <Flame className="h-2.5 w-2.5" />}
              {product.badge.label}
            </span>
          )}
          {showWishlist && onToggleWishlist && (
            <button type="button" onClick={(event) => { event.preventDefault(); event.stopPropagation(); onToggleWishlist(); }} className={cn("absolute right-2 top-2 z-10 grid h-8 w-8 place-items-center rounded-full bg-card/90 text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-destructive", isWishlisted && "text-destructive")} aria-label={isWishlisted ? removeFromWishlistLabel : addToWishlistLabel}>
              <Heart className={cn("h-3.5 w-3.5", isWishlisted && "fill-current")} />
            </button>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-3">
        <div>
          <Link to={`/product/${product.id}`} onClick={onProductClick}>
            <h3 className="min-h-10 line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:underline">{product.title}</h3>
          </Link>
          {(product.averageRating ?? 0) > 0 && (
            <div className="my-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-seller text-seller" />
              <span className="font-semibold text-foreground">{product.averageRating?.toFixed(1)}</span>
              <span className="text-muted-foreground/50">•</span>
              <span>{product.reviewCount ?? 0}</span>
            </div>
          )}
          {sellerName && (
            <div className="inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              <span className="truncate">{sellerName}</span>
              {sellerVerified && <CheckCircle2 className="h-3 w-3 shrink-0 text-seller" />}
            </div>
          )}
        </div>

        <div className="mt-auto pt-3">
          <div className="flex min-h-5 items-baseline gap-1.5">
            <span className="text-sm font-bold text-foreground">{formatPrice(product.price)}</span>
            {compareAtVisible && <span className="text-[10px] text-muted-foreground line-through">{formatPrice(product.compareAtPrice!)}</span>}
          </div>
          {product.flashDealEndAt && <FlashDealCountdown endAt={product.flashDealEndAt} className="mt-1 text-destructive" />}
          {showPurchaseActions && (
            <div className="mt-2 flex gap-2">
              {onBuyNow && <button type="button" onClick={onBuyNow} disabled={unavailable} className="h-8 rounded-full bg-primary px-3 text-[10px] font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50">{buyNowLabel}</button>}
              {onAddToCart && <button type="button" onClick={onAddToCart} disabled={unavailable} className="grid h-8 w-8 place-items-center rounded-full bg-foreground text-background transition-colors hover:bg-foreground/85 disabled:cursor-not-allowed disabled:opacity-50" aria-label={addToCartLabel}>
                <ShoppingCart className="h-3.5 w-3.5" />
              </button>}
            </div>
          )}
        </div>
      </div>
    </BrandCard>
  );
}
