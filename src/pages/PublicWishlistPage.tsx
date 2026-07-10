import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProductImage from "@/components/product/ProductImage";

interface Item {
  product: {
    id: string;
    title: string;
    price: number;
    compare_at_price: number | null;
    product_images: { image_url: string; is_primary: boolean }[];
  };
}

export default function PublicWishlistPage() {
  const { userId } = useParams<{ userId: string }>();
  const [items, setItems] = useState<Item[]>([]);
  const [ownerName, setOwnerName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const [w, p] = await Promise.all([
        supabase.from("wishlists" as any)
          .select("product:products(id, title, price, compare_at_price, product_images(image_url, is_primary))")
          .eq("user_id", userId).eq("is_public", true),
        supabase.from("profiles").select("full_name").eq("user_id", userId).maybeSingle(),
      ]);
      setItems((w.data as any) || []);
      setOwnerName((p.data as any)?.full_name || "Shopper");
      setLoading(false);
    })();
  }, [userId]);

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNavbar showSearch={false} />
      <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
            <Heart className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">{ownerName}'s Wishlist</h1>
            <p className="text-sm text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">This wishlist is empty or private.</CardContent></Card>
        ) : (
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
            {items.map(({ product }) => {
              const img = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
              const discount = product.compare_at_price && product.compare_at_price > product.price
                ? Math.round((1 - product.price / product.compare_at_price) * 100) : null;
              return (
                <Link key={product.id} to={`/product/${product.id}`} className="group">
                  <div className="aspect-square rounded-lg bg-muted overflow-hidden border border-border/60 relative">
                    {img ? (
                      <ProductImage src={img.image_url} alt={product.title} className="group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="flex items-center justify-center h-full"><Package className="h-8 w-8 text-muted-foreground/30" /></div>
                    )}
                    {discount && <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground">-{discount}%</Badge>}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground line-clamp-2">{product.title}</p>
                  <p className="text-base font-bold text-primary">${product.price}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
