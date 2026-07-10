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
    <section id="recommended" className="mt-12">
      <h2 className="font-display text-2xl font-bold text-foreground mb-4">You May Also Like</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {items.map(p => {
          const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="shrink-0 w-40 sm:w-48 snap-start group">
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
                <div className="aspect-square bg-muted">
                  {img ? (
                    <ProductImage src={img.image_url} alt={p.title} className="group-hover:scale-105" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center"><Package className="h-8 w-8 text-muted-foreground/30" /></div>
                  )}
                </div>
                <div className="p-2">
                  <div className="text-xs font-medium text-foreground line-clamp-2 min-h-[2rem]">{p.title}</div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-destructive">${p.price}</span>
                    {p.review_count > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                        <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
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
