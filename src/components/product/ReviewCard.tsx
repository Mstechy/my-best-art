import { useState } from "react";
import { Star, ShieldCheck, Award } from "lucide-react";
import { maskName } from "@/lib/productContent";
import AttachmentLightbox from "@/components/AttachmentLightbox";

export interface ReviewData {
  id: string;
  buyer_id: string;
  reviewer_name?: string | null;
  buyer_country?: string | null;
  rating: number;
  title?: string | null;
  comment?: string | null;
  is_verified_purchase?: boolean;
  created_at: string;
  variant?: string | null;
  photos?: { url: string }[];
  seller_reply?: string | null;
  pinned?: boolean;
}

export default function ReviewCard({ review }: { review: ReviewData }) {
  const [expanded, setExpanded] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const truncated = (review.comment || "").length > 220;
  const displayText = expanded || !truncated ? review.comment : (review.comment || "").slice(0, 220) + "…";
  const initial = (review.reviewer_name || "B").trim()[0].toUpperCase();
  return (
    <div className="relative rounded-xl border border-border/60 p-4 bg-card">
      {review.pinned && (
        <span className="absolute top-3 right-3 inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-[10px] font-semibold px-2 py-0.5 border border-primary/20">
          <Award className="h-3 w-3" /> Selected
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-semibold shrink-0">
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-sm font-medium text-foreground">{maskName(review.reviewer_name)}</span>
            {review.buyer_country && (
              <span className="text-xs text-muted-foreground">· {review.buyer_country}</span>
            )}
            <span className="text-xs text-muted-foreground">· {new Date(review.created_at).toLocaleDateString()}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map(s => (
                <Star key={s} className={`h-3 w-3 ${s <= review.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground/30"}`} />
              ))}
            </div>
            {review.variant && (
              <span className="text-[11px] text-muted-foreground">Variant: {review.variant}</span>
            )}
            {review.is_verified_purchase && (
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold border border-accent/20">
                <ShieldCheck className="h-3 w-3" /> Verified Purchase
              </span>
            )}
          </div>
          {review.title && <p className="mt-2 text-sm font-semibold text-foreground">{review.title}</p>}
          {review.comment && (
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap line-clamp-none">
              {displayText}
              {truncated && (
                <button onClick={() => setExpanded(e => !e)} className="ml-1 text-primary font-medium hover:underline">
                  {expanded ? "Less" : "More"}
                </button>
              )}
            </p>
          )}
          {review.photos && review.photos.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto -mx-1 px-1">
              {review.photos.map((p, i) => (
                <button key={i} type="button" onClick={() => setLightbox(p.url)} className="h-16 w-16 rounded-lg overflow-hidden border border-border/60 shrink-0">
                  <img src={p.url} alt="Review photo" loading="lazy" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
          {review.seller_reply && (
            <div className="mt-3 rounded-lg bg-muted/50 border-l-2 border-primary p-3">
              <div className="text-xs font-semibold text-foreground mb-1">Seller Reply:</div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap">{review.seller_reply}</div>
            </div>
          )}
        </div>
      </div>
      <AttachmentLightbox url={lightbox || ""} open={!!lightbox} onOpenChange={(o) => !o && setLightbox(null)} />
    </div>
  );
}
