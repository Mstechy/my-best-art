import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Package, Star, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductImage from "@/components/product/ProductImage";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { useCurrency } from "@/hooks/useCurrency";

interface RecItem {
  id: string;
  title: string;
  price: number;
  compare_at_price: number | null;
  average_rating: number;
  review_count: number;
  seller_id: string;
  stock_quantity: number;
  categories: { name: string } | null;
  product_images: { image_url: string; is_primary: boolean }[];
}

// Keep product detail pages focused. The marketplace owns deep pagination;
// this section is a compact comparison rail rather than a second catalogue.
const PAGE_SIZE = 8;

export default function RecommendedProducts({ productId, categoryId }: { productId: string; categoryId: string | null }) {
  const { formatPrice } = useCurrency();
  const [items, setItems] = useState<RecItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [nearViewport, setNearViewport] = useState(false);
  const recommendationsRef = useRef<HTMLDivElement>(null);
  const { addItem } = useCart();

  const loadPage = useCallback(async (offset: number) => {
    let q = supabase
      .from("products")
      .select("id, title, price, compare_at_price, average_rating, review_count, seller_id, stock_quantity, categories(name), product_images(image_url, is_primary)")
      .eq("status", "active")
      .eq("is_approved", true)
      .neq("id", productId)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (categoryId) q = q.eq("category_id", categoryId);
    const { data, error } = await q;
    return { rows: (data as unknown as RecItem[]) || [], error };
  }, [productId, categoryId]);

  useEffect(() => {
    const target = recommendationsRef.current;
    if (!target) return;
    if (!("IntersectionObserver" in window)) {
      setNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setNearViewport(true);
        observer.disconnect();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loadPage]);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setNearViewport(false);
    return () => { cancelled = true; };
  }, [loadPage]);

  useEffect(() => {
    if (!nearViewport) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const { rows, error } = await loadPage(0);
        if (cancelled) return;
        if (error) {
          toast.error("Could not load recommended products.");
        } else {
          setItems(rows);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load recommended products:", error);
          toast.error("Could not load recommended products.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [loadPage, nearViewport]);

  return (
    <div ref={recommendationsRef} className="min-h-px">
      {items.length > 0 && <section id="recommended" className="mt-10 px-4 md:px-0">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">More in this department</h2>
          <p className="mt-1 text-xs text-[#6E6C64] dark:text-[#A0A0A0]">Similar active listings to help you compare before you decide.</p>
        </div>
        <Link to={categoryId ? `/categories/${categoryId}` : "/marketplace"} className="shrink-0 text-xs font-bold text-[#111111] underline-offset-4 hover:underline dark:text-[#FAF5F2]">
          View all
        </Link>
      </div>
      <div className="flex snap-x gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="More products in this department">
        {items.map(p => {
          const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
          return (
            <div key={p.id} className="group relative min-w-[164px] max-w-[164px] snap-start overflow-hidden rounded-xl border border-[#E8E8E8] bg-white transition-shadow hover:shadow-md dark:border-[#222222] dark:bg-[#1A1A1A] sm:min-w-[192px] sm:max-w-[192px]">
              <Link to={`/product/${p.id}`} className="block">
                <div className="aspect-square bg-[#F2F3F5] dark:bg-[#111111] relative">
                  {img ? (
                    <ProductImage src={img.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-[#C0C0B8]" /></div>
                  )}
                </div>
              </Link>
              <div className="space-y-1.5 p-2">
                <Link to={`/product/${p.id}`} className="block">
                  <div className="line-clamp-2 text-xs font-medium leading-4 text-[#333333] dark:text-[#D7D7D7]">{p.title}</div>
                </Link>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <span className="block text-sm font-black tracking-tight text-[#111111] dark:text-[#FAF5F2]">{formatPrice(p.price)}</span>
                    {p.compare_at_price && (
                      <span className="block text-[10px] text-[#C0C0B8] line-through">{formatPrice(p.compare_at_price)}</span>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addItem({
                        id: p.id,
                        product_id: p.id,
                        title: p.title,
                        price: p.price,
                        image_url: img?.image_url || null,
                        seller_id: p.seller_id,
                        seller_name: "Seller",
                        stock_quantity: p.stock_quantity || 1,
                      });
                      toast.success("Added to cart");
                    }}
                    aria-label={`Add ${p.title} to cart`}
                    className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#111111] text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:border-[#FAF5F2] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                  </button>
                </div>
                <Link to={`/product/${p.id}`} className="block">
                  {p.review_count > 0 && <div className="flex items-center gap-1 pt-1">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <Star
                          key={s}
                          className={`h-2.5 w-2.5 ${s <= Math.round(p.average_rating || 0) ? 'fill-[#111111] text-[#111111] dark:fill-[#FAF5F2] dark:text-[#FAF5F2]' : 'fill-transparent text-[#C0C0B8] dark:text-[#333333]'}`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-[#6E6C64]">{p.review_count}</span>
                  </div>}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {/* Infinite scroll — keeps loading more products so the page never ends (AliExpress behavior) */}
      </section>}
    </div>
  );
}
