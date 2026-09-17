import { cn } from "@/lib/utils";

/**
 * Price presentation, shared by every surface that shows money.
 *
 * Matches the approved design:
 *   .pc-price    → now 15px/800 --deal, was 12px --muted line-through   (cards)
 *   .pd-price-row→ now 28px/800 --deal, was 15px --muted line-through   (product page)
 *
 * `formatPrice` is injected (not imported) so this stays presentational and
 * testable, matching how ProductCard already receives it from the page.
 *
 * Colours: `.now` uses `text-deal` (the sale red) per the design, NOT
 * `text-primary`. The discount percentage uses the same red.
 */

type PriceSize = "sm" | "md" | "lg";

interface PriceDisplayProps {
  price: number;
  compareAtPrice?: number | null;
  /** Currency formatter from useCurrency(). */
  formatPrice: (amount: number) => string;
  size?: PriceSize;
  /** Render the struck-through original price when it is higher than `price`. */
  showCompareAt?: boolean;
  className?: string;
  /** Applied to the current (`.now`) price element. */
  priceClassName?: string;
}

const SIZE_CLASS: Record<PriceSize, { now: string; was: string; gap: string }> = {
  sm: { now: "text-[15px] font-extrabold", was: "text-xs", gap: "gap-1.5" },
  md: { now: "text-lg font-extrabold", was: "text-xs", gap: "gap-2" },
  lg: { now: "text-[28px] font-extrabold", was: "text-[15px]", gap: "gap-2.5" },
};

/**
 * Percentage off, rounded, or null when there is no real discount.
 * Exported so callers can render the `-30%` badge on the image (design's
 * `.pc-badge`) without duplicating the maths.
 */
export function discountPercent(
  price: number,
  compareAtPrice?: number | null,
): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round((1 - price / compareAtPrice) * 100);
}

export function PriceDisplay({
  price,
  compareAtPrice,
  formatPrice,
  size = "sm",
  showCompareAt = true,
  className,
  priceClassName,
}: PriceDisplayProps) {
  const { now, was, gap } = SIZE_CLASS[size];
  const onSale = Boolean(compareAtPrice && compareAtPrice > price);

  return (
    <div className={cn("flex flex-wrap items-baseline", gap, className)}>
      <span className={cn(now, "text-deal", priceClassName)}>
        {formatPrice(price)}
      </span>
      {showCompareAt && onSale ? (
        <span className={cn(was, "text-quiet line-through")}>
          {formatPrice(compareAtPrice as number)}
        </span>
      ) : null}
    </div>
  );
}

export default PriceDisplay;