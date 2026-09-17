import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Rating + social proof line, shared by every product surface.
 *
 * Matches the approved design's `.pc-rating` / `.pd-meta` pattern:
 *   card  → ★ 4.7 · 2,108 sold
 *   PDP   → ★ 4.4 · 318 reviews · 620 sold
 *
 * Amazon/AliExpress convention: a product with no reviews yet shows "New"
 * rather than "0.0", which reads as a bad rating to shoppers. That behaviour
 * is built in via `showNewWhenUnrated`.
 */

type StarRatingSize = "xs" | "sm" | "md" | "lg";

interface StarRatingProps {
  rating?: number | null;
  /** Number of reviews. Rendered as "318 reviews" when `reviewLabel` is set. */
  reviewCount?: number | null;
  /** Units sold. Rendered as "2,108 sold". */
  soldCount?: number | null;
  size?: StarRatingSize;
  /** Render a full 5-star row with fractional fill (PDP / store header). */
  showStars?: boolean;
  /** Label used for the review count, e.g. t("reviews.count"). */
  reviewLabel?: string;
  /** Label used for sold count, e.g. t("product.sold"). */
  soldLabel?: string;
  /** Fall back to "New" when there are no ratings yet. */
  showNewWhenUnrated?: boolean;
  /** Text shown when unrated and `showNewWhenUnrated`. */
  newLabel?: string;
  className?: string;
}

const SIZE_CLASS: Record<StarRatingSize, { star: string; text: string }> = {
  xs: { star: "h-3 w-3", text: "text-xs" },
  sm: { star: "h-3.5 w-3.5", text: "text-xs" },
  md: { star: "h-4 w-4", text: "text-sm" },
  lg: { star: "h-5 w-5", text: "text-base" },
};

/** Thousands separators without pulling in a heavy formatter. */
function formatCount(value: number): string {
  return value >= 1000 ? value.toLocaleString() : String(value);
}

/** Five stars with a fractional overlay — no half-star icon needed. */
function StarRow({ rating, starClass }: { rating: number; starClass: string }) {
  const pct = Math.max(0, Math.min(100, (rating / 5) * 100));
  return (
    <span
      className="relative inline-flex shrink-0"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5`}
    >
      <span className="inline-flex gap-px text-line-strong">
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className={cn(starClass, "fill-current")} aria-hidden />
        ))}
      </span>
      <span
        className="pointer-events-none absolute inset-0 inline-flex gap-px overflow-hidden text-star"
        style={{ width: `${pct}%` }}
      >
        {Array.from({ length: 5 }).map((_, index) => (
          <Star key={index} className={cn(starClass, "shrink-0 fill-current")} aria-hidden />
        ))}
      </span>
    </span>
  );
}

export function StarRating({
  rating,
  reviewCount,
  soldCount,
  size = "xs",
  showStars = false,
  reviewLabel,
  soldLabel,
  showNewWhenUnrated = true,
  newLabel = "New",
  className,
}: StarRatingProps) {
  const value = Number(rating ?? 0);
  const hasRating = Number.isFinite(value) && value > 0;
  const { star, text } = SIZE_CLASS[size];

  if (!hasRating) {
    if (!showNewWhenUnrated) return null;
    return (
      <div className={cn("flex items-center gap-1 text-quiet", text, className)}>
        <Star className={cn(star, "text-line-strong")} aria-hidden />
        <span className="font-medium">{newLabel}</span>
      </div>
    );
  }

  const parts: string[] = [];

  return (
    <div className={cn("flex items-center gap-1 text-quiet", text, className)}>
      {showStars ? (
        <StarRow rating={value} starClass={star} />
      ) : (
        <Star className={cn(star, "fill-star text-star")} aria-hidden />
      )}
      <span className="font-semibold text-ink-soft">{value.toFixed(1)}</span>

      {reviewLabel && reviewCount ? (
        <>
          <span aria-hidden className="text-muted-foreground/50">
            ·
          </span>
          <span>
            {formatCount(reviewCount)} {reviewLabel}
          </span>
        </>
      ) : null}

      {soldCount ? (
        <>
          <span aria-hidden className="text-muted-foreground/50">
            ·
          </span>
          <span>
            {formatCount(soldCount)}
            {soldLabel ? ` ${soldLabel}` : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}

export default StarRating;