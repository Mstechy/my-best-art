import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../integrations/supabase/client";
import { Package } from "lucide-react";
import { useRecentlyViewed } from "../hooks/useRecentlyViewed";

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
    // preserve original order
    const map = new Map(data.map((d: any) => [d.id, d]));
    setItems(filteredIds.map(id => map.get(id)).filter(Boolean) as Item[]);
  }, [ids, excludeId]);

  useEffect(() => { fetch(); }, [fetch]);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="font-display text-lg font-semibold text-foreground">Recently Viewed</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide">
        {items.map(p => {
          const img = p.product_images?.find(i => i.is_primary) || p.product_images?.[0];
          return (
            <Link key={p.id} to={`/product/${p.id}`} className="shrink-0 w-32 group">
              <div className="aspect-square rounded-lg bg-muted overflow-hidden border border-border/60">
                {img ? (
                  <img src={img.image_url} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                ) : (
                  <div className="flex items-center justify-center h-full"><Package className="h-6 w-6 text-muted-foreground/30" /></div>
                )}
              </div>
              <p className="mt-1.5 text-xs text-foreground line-clamp-2 leading-tight">{p.title}</p>
              <p className="text-xs font-bold text-primary">${p.price}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
