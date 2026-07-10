import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Package } from "lucide-react";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";
import ProductImage from "@/components/product/ProductImage";

interface Item {
  id: string;
  title: string;
  price: number;
  product_images: { image_url: string; is_primary: boolean }[];
}

export default function RecentlyViewed({ excludeId }: { excludeId?: string }) {
  const { ids } = useRecentlyViewed();
  const [items, setItems] = useState<Item[]>([]);

  const fetch = useCallback(async () => {
    const filteredIds = ids.filter(i => i !== excludeId);
    if (filteredIds.length === 0) { setItems([]); return; }
    const { data } = await supabase
      .from("products")
      .select("id, title, price, product_images(image_url, is_primary)")
      .in("id", filteredIds)
      .eq("status", "active")
      .eq("is_approved", true);
    if (!data) return;
    const map = new Map(data.map((d: any) => [d.id, d]));
    setItems(filteredIds.map(id => map.get(id)).filter(Boolean) as Item[]);
  }, [ids, excludeId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-4 px-4 md:px-0">
      <h3 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Recently Viewed</h3>
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 md:mx-0 md:px-0 snap-x scrollbar-none">
        {items.map(p => {
          const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="shrink-0 w-32 group snap-start">
              <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm overflow-hidden p-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5">
                <div className="aspect-square bg-[#FAFAFA] dark:bg-[#111111] rounded-xl overflow-hidden relative">
                  {img ? (
                    <ProductImage src={img.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  ) : (
                    <div className="flex items-center justify-center h-full"><Package className="h-5 w-5 text-[#C0C0B8]" /></div>
                  )}
                </div>
                <div className="mt-2.5 space-y-1">
                  <p className="text-[10px] font-bold text-[#111111] dark:text-[#FAF5F2] truncate group-hover:text-[#F6C75D] transition-colors">{p.title}</p>
                  <p className="text-xs font-black text-[#111111] dark:text-[#FAF5F2]">${p.price}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
