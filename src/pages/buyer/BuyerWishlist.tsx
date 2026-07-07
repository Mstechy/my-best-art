import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, ShoppingCart, Package, Trash2, Share2, Layers } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";

interface WishlistItem {
  id: string;
  product_id: string;
  created_at: string;
  is_public: boolean;
  product: {
    id: string;
    title: string;
    price: number;
    compare_at_price: number | null;
    stock_quantity: number;
    seller_id: string;
    status: string;
    category_id: string | null;
    product_images: { image_url: string; is_primary: boolean }[];
  };
}

type SortKey = "newest" | "price_asc" | "price_desc";

export default function BuyerWishlist() {
  const { user } = useAuth();
  const { addItem } = useCart();
  const { toast } = useToast();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const [categoryNames, setCategoryNames] = useState<Record<string, string>>({});
  const [isPublic, setIsPublic] = useState(false);

  const fetchWishlist = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("wishlists" as any)
      .select("id, product_id, created_at, is_public, product:products(id, title, price, compare_at_price, stock_quantity, seller_id, status, category_id, product_images(image_url, is_primary))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    if (data) {
      const list = data as any as WishlistItem[];
      setItems(list);
      setIsPublic(list.length > 0 && list.every(l => l.is_public));
      const catIds = [...new Set(list.map(i => i.product.category_id).filter(Boolean) as string[])];
      if (catIds.length) {
        const { data: cats } = await supabase.from("categories").select("id, name").in("id", catIds);
        const map: Record<string, string> = {};
        cats?.forEach((c: any) => { map[c.id] = c.name; });
        setCategoryNames(map);
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchWishlist(); }, [user]);

  const removeItem = async (wishlistId: string) => {
    await supabase.from("wishlists" as any).delete().eq("id", wishlistId);
    setItems(prev => prev.filter(i => i.id !== wishlistId));
    toast({ title: "Removed from wishlist" });
  };

  const handleAddToCart = (item: WishlistItem) => {
    const img = item.product.product_images?.find(i => i.is_primary) || item.product.product_images?.[0];
    addItem({
      id: item.product.id,
      title: item.product.title,
      price: item.product.price,
      image_url: img?.image_url || null,
      seller_id: item.product.seller_id,
      seller_name: "Seller",
      stock_quantity: item.product.stock_quantity,
    });
    toast({ title: "Added to cart" });
  };

  const togglePublic = async (next: boolean) => {
    if (!user) return;
    setIsPublic(next);
    await supabase.from("wishlists" as any).update({ is_public: next } as any).eq("user_id", user.id);
    setItems(prev => prev.map(i => ({ ...i, is_public: next })));
    toast({ title: next ? "Wishlist is now public" : "Wishlist is now private" });
  };

  const shareWishlist = async () => {
    if (!user) return;
    if (!isPublic) await togglePublic(true);
    const url = `${window.location.origin}/wishlist/${user.id}`;
    try { await navigator.clipboard.writeText(url); toast({ title: "Link copied", description: url }); }
    catch { toast({ title: "Share link", description: url }); }
  };

  const sorted = useMemo(() => {
    const arr = [...items];
    if (sortKey === "price_asc") arr.sort((a, b) => a.product.price - b.product.price);
    else if (sortKey === "price_desc") arr.sort((a, b) => b.product.price - a.product.price);
    return arr;
  }, [items, sortKey]);

  const grouped = useMemo(() => {
    if (!groupByCategory) return null;
    const groups: Record<string, WishlistItem[]> = {};
    sorted.forEach(i => {
      const key = i.product.category_id || "uncategorized";
      (groups[key] = groups[key] || []).push(i);
    });
    return groups;
  }, [sorted, groupByCategory]);

  const renderItem = (item: WishlistItem) => {
    const img = item.product.product_images?.find(i => i.is_primary) || item.product.product_images?.[0];
    const discount = item.product.compare_at_price && item.product.compare_at_price > item.product.price
      ? Math.round((1 - item.product.price / item.product.compare_at_price) * 100) : null;
    return (
      <Card key={item.id} className="border-border/60 overflow-hidden group">
        <Link to={`/product/${item.product.id}`}>
          <div className="aspect-square bg-muted relative overflow-hidden">
            {img ? (
              <img src={img.image_url} alt={item.product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
            ) : (
              <div className="flex items-center justify-center h-full"><Package className="h-10 w-10 text-muted-foreground/20" /></div>
            )}
            {discount && <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground font-bold">-{discount}%</Badge>}
          </div>
        </Link>
        <CardContent className="p-4">
          <Link to={`/product/${item.product.id}`}>
            <h3 className="font-display font-semibold text-foreground truncate group-hover:text-primary transition-colors">{item.product.title}</h3>
          </Link>
          <div className="flex items-center gap-2 mt-2">
            <span className="font-display text-lg font-bold text-foreground">${item.product.price}</span>
            {item.product.compare_at_price && item.product.compare_at_price > item.product.price && (
              <span className="text-sm text-muted-foreground line-through">${item.product.compare_at_price}</span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={() => handleAddToCart(item)} disabled={item.product.stock_quantity === 0}
              className="flex-1 gap-1 bg-primary text-primary-foreground hover:bg-primary/90">
              <ShoppingCart className="h-3.5 w-3.5" /> Add to Cart
            </Button>
            <Button size="sm" variant="outline" onClick={() => removeItem(item.id)} className="text-destructive hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">My Wishlist</h1>
            <p className="mt-1 text-muted-foreground">{items.length} items · price-drop alerts enabled</p>
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="w-[150px] h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_asc">Price: Low to High</SelectItem>
                  <SelectItem value="price_desc">Price: High to Low</SelectItem>
                </SelectContent>
              </Select>
              <Button variant={groupByCategory ? "default" : "outline"} size="sm" className="h-10 gap-1.5"
                onClick={() => setGroupByCategory(g => !g)}>
                <Layers className="h-4 w-4" /> Group
              </Button>
              <Button variant="outline" size="sm" className="h-10 gap-1.5" onClick={shareWishlist}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <Switch checked={isPublic} onCheckedChange={togglePublic} /> Public
              </label>
            </div>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading wishlist...</div>
        ) : items.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                  <Heart className="h-9 w-9 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">Your wishlist is empty</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">Browse the marketplace and tap the heart icon to save products you love.</p>
                <Link to="/marketplace">
                  <Button className="mt-4 bg-primary text-primary-foreground">Browse Products</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : grouped ? (
          <div className="space-y-8">
            {Object.entries(grouped).map(([catId, list]) => (
              <div key={catId}>
                <h2 className="font-display text-lg font-semibold text-foreground mb-3">
                  {categoryNames[catId] || "Uncategorized"} <span className="text-sm text-muted-foreground font-normal">({list.length})</span>
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{list.map(renderItem)}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{sorted.map(renderItem)}</div>
        )}
      </AnimatedSection>
    </div>
  );
}
