import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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
  // Delivered units. Real social proof for a young catalogue, where every product
  // starts with zero reviews and no rating is shown at all.
  soldCount?: number;
  imageUrl?: string | null;
  // 320px grid derivative. Present only for listings uploaded after responsive cards
  // were added, so the card must keep working when it is absent.
  imageSmallUrl?: string | null;
  flashDealEndAt?: string | null;
  badge?: { label: string; tone?: "destructive" | "seller" | "brand" | "success" } | null;
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
  /**
   * Aspect ratio (width / height) RESERVED by the image box before the file has
   * loaded, so a masonry tile can claim its exact height up front.
   *
   * Defaults to 1, which is exactly what the aligned catalogue grid has always
   * rendered (`aspect-square`), so the category and search pages are unchanged by
   * this prop existing. The masonry feed passes the clamped ratio from the stored
   * image dimensions; an unknown ratio must arrive here as 1 already
   * (`clampDisplayAspectRatio` guarantees that).
   */
  imageAspectRatio?: number;
  /**
   * Load the image eagerly at high priority. Set this for the FIRST ROW of the
   * feed only: those images are inside the largest-contentful-paint area, while
   * everything below the fold is better off lazy so it cannot compete for
   * bandwidth with the pixels the shopper is actually waiting for.
   */
  priority?: boolean;
};

const badgeTone = {
  destructive: "bg-destructive text-destructive-foreground",
  seller: "bg-seller text-seller-foreground",
  // "New" badge. Ink-on-brand is used deliberately: white on #ff7a1a is only
  // ~2.6:1 contrast (fails WCAG AA), while #14140f on #ff7a1a is ~7:1.
  brand: "bg-brand text-ink",
  success: "bg-success text-success-foreground",
};

/** Clamp a caller-supplied ratio to something a card can actually reserve. */
const safeAspectRatio = (ratio: number | undefined): number =>
  typeof ratio === "number" && Number.isFinite(ratio) && ratio > 0 ? ratio : 1;


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
  imageAspectRatio,
  priority = false,
  className,
}: ProductCardProps) {
  const { t } = useTranslation();
  const compareAtVisible = product.compareAtPrice && product.compareAtPrice > product.price;
  const unavailable = product.stockQuantity === 0;
  const showPurchaseActions = Boolean(onBuyNow || onAddToCart);
  // Reserved height of the media box. `aspect-ratio` (not a fixed height) so the
  // box tracks the column width the masonry layout gives it, and `object-fit:
  // cover` in the image means an extreme upload loses edges instead of breaking
  // the layout. Because the box is reserved, this card's height cannot change when
  // its image loads - which is the entire point of storing the dimensions.
  const reservedRatio = safeAspectRatio(imageAspectRatio);

  return (
    <BrandCard className={cn("group relative flex h-full flex-col overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-within:ring-2 focus-within:ring-primary/60 focus-within:ring-offset-1", className)}>
      {/* Media. Deliberately NOT wrapped in its own link: the stretched title link
          below covers the whole card, so the image is part of ONE generously sized
          target rather than a second one competing for the same tap. */}
      <div className="relative w-full overflow-hidden bg-muted" style={{ aspectRatio: reservedRatio }}>
        {product.imageUrl ? (
          <ProductImage
            src={product.imageUrl}
            cardSmallUrl={product.imageSmallUrl}
            alt={product.title}
            className="group-hover:scale-105"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : "auto"}
          />
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
          {/* Out of stock is stated on the media box rather than by greying the
              card: the card keeps its exact height (the shopper's scroll position
              and the masonry column balance do not change) and the label sits on
              the image it refers to. */}
          {unavailable && (
            <span className="absolute inset-x-2 bottom-2 z-10 rounded-md bg-foreground/75 px-2 py-1 text-center text-[10px] font-bold uppercase tracking-wide text-background backdrop-blur-sm">
              {t("product.outOfStock")}
            </span>
          )}
        </div>

      <div className="flex flex-1 flex-col p-3">
        <div>
          {/* One stretched link for the whole card. Tailwind's `after:inset-0`
              idiom rather than an absolutely positioned sibling: the anchor keeps
              real, crawlable text (the product title), keeps its accessible name,
              and stays in the tab order exactly once. Interactive controls
              (wishlist, buy, cart) sit above it with `z-10`, because a <button>
              nested inside an <a> is invalid and unreachable by keyboard. */}
          <Link
            to={`/product/${product.id}`}
            onClick={onProductClick}
            className="block rounded-md outline-none after:absolute after:inset-0 after:z-0 after:rounded-card after:bg-transparent after:content-[''] hover:after:bg-foreground/[0.03] active:after:bg-foreground/[0.07] focus-visible:after:ring-2 focus-visible:after:ring-primary"
          >
            <h3 className="min-h-10 line-clamp-2 text-sm font-semibold leading-snug text-foreground group-hover:underline">{product.title}</h3>
          </Link>
          {(product.soldCount ?? 0) > 0 && (
            <div className="my-1.5 flex items-center gap-1 text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">
                {product.soldCount!.toLocaleString()}{(product.soldCount ?? 0) >= 1000 ? "+" : ""}
              </span>
              <span>{t("product.soldCount")}</span>
            </div>
          )}
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
            // `relative z-10`: these are the only controls that must win the tap
            // over the stretched card link.
            <div className="relative z-10 mt-2 flex gap-2">
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
