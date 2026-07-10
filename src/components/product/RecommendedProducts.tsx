import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Package, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ProductImage from "@/components/product/ProductImage";

interface RecItem {
  id: string;
  title: string;
  price: number;
  average_rating: number;
  review_count: number;
  product_images: { image_url: string; is_primary: boolean }[];
}

export default function RecommendedProducts({ productId, categoryId }: { productId: string; categoryId: string | null }) {
  const [items, setItems] = useState<RecItem[]>([]);

  useEffect(() => {
    const load = async () => {
      let q = supabase
        .from("products")
        .select("id, title, price, average_rating, review_count, product_images(*)")
        .eq("status", "active")
        .eq("is_approved", true)
        .neq("id", productId)
        .limit(6);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data } = await q;
      setItems((data as any[]) || []);
    };
    load();
  }, [productId, categoryId]);

  if (items.length === 0) return null;

  return (
    <section id="recommended" className="mt-10 px-4 md:px-0">
      <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">You May Also Like</h2>
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x scrollbar-none">
        {items.map(p => {
          const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="shrink-0 w-36 sm:w-40 snap-start group">
              <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm overflow-hidden p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5">
                <div className="aspect-square bg-[#FAFAFA] dark:bg-[#111111] rounded-xl overflow-hidden relative">
                  {img ? (
                    <ProductImage src={img.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Package className="h-6 w-6 text-[#C0C0B8]" /></div>
                  )}
                </div>
                <div className="mt-2.5 space-y-1">
                  <div className="text-[11px] font-bold text-[#111111] dark:text-[#FAF5F2] truncate group-hover:text-[#F6C75D] transition-colors">{p.title}</div>
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <span className="text-xs font-black text-[#111111] dark:text-[#FAF5F2]">${p.price}</span>
                    {p.review_count > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[9px] text-[#888880] font-semibold">
                        <Star className="h-2.5 w-2.5 fill-[#F6C75D] text-[#F6C75D]" />
                        {p.average_rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
