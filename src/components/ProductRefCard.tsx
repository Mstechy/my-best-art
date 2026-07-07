import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Tag, Truck, Paperclip } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AttachmentLightbox from "./AttachmentLightbox";

const PRODUCT_REF_RE = /\[product:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;
const ORDER_REF_RE = /\[order:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/i;
const OFFER_RE = /\[offer:(\d{1,7}(?:\.\d{1,2})?)\]/;
const ATTACHMENT_RE = /\[attachment:(https?:\/\/[^\s\]]{1,500})\]/i;

const supabaseHost = (() => {
  try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).host; } catch { return ""; }
})();

function isSafeAttachmentUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    if (!supabaseHost) return false;
    return u.host === supabaseHost && u.pathname.includes("/storage/v1/object/public/");
  } catch { return false; }
}

export interface ParsedRef {
  productId: string | null;
  orderId: string | null;
  offerPrice: number | null;
  attachmentUrl: string | null;
  clean: string;
}

export function extractProductRef(content: string): ParsedRef {
  let clean = content ?? "";
  let productId: string | null = null;
  let orderId: string | null = null;
  let offerPrice: number | null = null;
  let attachmentUrl: string | null = null;

  const pm = clean.match(PRODUCT_REF_RE);
  if (pm) { productId = pm[1].toLowerCase(); clean = clean.replace(PRODUCT_REF_RE, "").trim(); }

  const om = clean.match(ORDER_REF_RE);
  if (om) { orderId = om[1].toLowerCase(); clean = clean.replace(ORDER_REF_RE, "").trim(); }

  const of = clean.match(OFFER_RE);
  if (of) {
    const v = parseFloat(of[1]);
    if (Number.isFinite(v) && v > 0 && v < 10_000_000) offerPrice = v;
    clean = clean.replace(OFFER_RE, "").trim();
  }

  const am = clean.match(ATTACHMENT_RE);
  if (am && isSafeAttachmentUrl(am[1])) {
    attachmentUrl = am[1];
    clean = clean.replace(ATTACHMENT_RE, "").trim();
  } else if (am) {
    // strip unsafe attachment marker silently
    clean = clean.replace(ATTACHMENT_RE, "").trim();
  }

  return { productId, orderId, offerPrice, attachmentUrl, clean };
}

interface MiniProduct {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
}

const cache = new Map<string, MiniProduct | null>();

interface Props {
  productId?: string | null;
  orderId?: string | null;
  offerPrice?: number | null;
  attachmentUrl?: string | null;
}

export default function ProductRefCard({ productId, orderId, offerPrice, attachmentUrl }: Props) {
  const [product, setProduct] = useState<MiniProduct | null | undefined>(productId ? cache.get(productId) : null);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!productId) return;
    if (cache.has(productId)) { setProduct(cache.get(productId)); return; }
    let active = true;
    supabase
      .from("products")
      .select("id, title, price, product_images(image_url, is_primary)")
      .eq("id", productId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) { cache.set(productId, null); setProduct(null); return; }
        const imgs = (data as any).product_images || [];
        const primary = imgs.find((i: any) => i.is_primary) || imgs[0];
        const mini: MiniProduct = { id: data.id, title: (data as any).title, price: Number((data as any).price), image_url: primary?.image_url ?? null };
        cache.set(productId, mini);
        setProduct(mini);
      });
    return () => { active = false; };
  }, [productId]);

  const isImage = attachmentUrl ? /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(attachmentUrl) : false;

  return (
    <div className="space-y-2 mb-2">
      {productId && product && (
        <Link to={`/product/${product.id}`} className="block rounded-lg border border-border bg-card overflow-hidden hover:bg-muted/40 transition-colors">
          <div className="flex items-center gap-3 p-2">
            <div className="h-12 w-12 rounded-md bg-muted overflow-hidden shrink-0 flex items-center justify-center">
              {product.image_url ? (
                <img src={product.image_url} alt="" className="w-full h-full object-cover" loading="lazy" />
              ) : (
                <Package className="h-5 w-5 text-muted-foreground/40" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted-foreground">{offerPrice != null ? "Offer for" : "About this product"}</p>
              <p className="text-sm font-medium text-foreground truncate">{product.title}</p>
            </div>
            <div className="shrink-0 text-right">
              {offerPrice != null ? (
                <div className="flex flex-col items-end">
                  <span className="inline-flex items-center gap-1 text-sm font-bold text-accent">
                    <Tag className="h-3 w-3" /> ${offerPrice.toFixed(2)}
                  </span>
                  <span className="text-[10px] text-muted-foreground line-through">${product.price.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-sm font-bold text-primary">${product.price.toFixed(2)}</span>
              )}
            </div>
          </div>
        </Link>
      )}

      {orderId && (
        <Link to="/buyer/tracking" className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted/40 transition-colors">
          <Truck className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-foreground">Order #{orderId.slice(0, 8)} — Track shipment</span>
        </Link>
      )}

      {attachmentUrl && (
        <>
          {isImage ? (
            <button type="button" onClick={() => setLightboxOpen(true)} className="block rounded-lg overflow-hidden border border-border max-w-[200px] hover:opacity-90 transition-opacity">
              <img src={attachmentUrl} alt="Attachment" className="w-full h-auto object-cover" loading="lazy" />
            </button>
          ) : (
            <button type="button" onClick={() => setLightboxOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 hover:bg-muted/40 transition-colors">
              <Paperclip className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium text-foreground">View attachment (PDF)</span>
            </button>
          )}
          <AttachmentLightbox open={lightboxOpen} onOpenChange={setLightboxOpen} url={attachmentUrl} />
        </>
      )}
    </div>
  );
}
