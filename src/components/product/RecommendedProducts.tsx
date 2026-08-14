import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Package, Star, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductImage from "@/components/product/ProductImage";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import InfiniteScrollTrigger from "@/components/ui/InfiniteScrollTrigger";

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

const PAGE_SIZE = 12;

export default function RecommendedProducts({ productId, categoryId }: { productId: string; categoryId: string | null }) {
  const [items, setItems] = useState<RecItem[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
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
    const { data } = await q;
    return (data as unknown as RecItem[]) || [];
  }, [productId, categoryId]);

  useEffect(() => {
    let cancelled = false;
    setItems([]);
    setHasMore(true);
    (async () => {
      const rows = await loadPage(0);
      if (cancelled) return;
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    })();
    return () => { cancelled = true; };
  }, [loadPage]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    const rows = await loadPage(items.length);
    setItems(prev => {
      const seen = new Set(prev.map(p => p.id));
      const fresh = rows.filter(p => !seen.has(p.id));
      return [...prev, ...fresh];
    });
    setHasMore(rows.length === PAGE_SIZE);
    setLoading(false);
  }, [loading, hasMore, items.length, loadPage]);

  if (items.length === 0) return null;

  return (
    <section id="recommended" className="mt-10 px-4 md:px-0">
      <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">You May Also Like</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {items.map(p => {
          const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
          return (
            <div key={p.id} className="group relative bg-white dark:bg-[#1A1A1A] rounded-xl overflow-hidden hover:shadow-md transition-shadow border border-[#E8E8E8] dark:border-[#222222]">
              <Link to={`/product/${p.id}`} className="block">
                <div className="aspect-square bg-[#F2F3F5] dark:bg-[#111111] relative">
                  {img ? (
                    <ProductImage src={img.image_url} alt={p.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-[#C0C0B8]" /></div>
                  )}
                </div>
              </Link>
              <div className="p-2 space-y-1.5">
                <Link to={`/product/${p.id}`} className="block">
                  <div className="text-xs text-[#666666] dark:text-[#A0A0A0] truncate">{p.title}</div>
                </Link>
                <div className="flex items-center gap-1.5 relative h-7">
                  <span className="text-base font-black text-[#111111] dark:text-[#FAF5F2] tracking-tight">${p.price}</span>
                  {p.compare_at_price && (
                    <span className="text-[10px] text-[#C0C0B8] line-through">${p.compare_at_price}</span>
                  )}
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
                    className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-6 rounded-full border border-[#111111] dark:border-[#FAF5F2] flex items-center justify-center text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
                  >
                    <ShoppingCart className="h-3 w-3" />
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
                    <span className="text-[10px] text-[#888880]">{p.review_count}</span>
                  </div>}
                </Link>
              </div>
            </div>
          );
        })}
      </div>
      {/* Infinite scroll — keeps loading more products so the page never ends (AliExpress behavior) */}
      <InfiniteScrollTrigger onLoadMore={loadMore} hasMore={hasMore} loading={loading} />
    </section>
  );
}