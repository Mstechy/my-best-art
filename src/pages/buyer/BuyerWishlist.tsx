import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, ShoppingCart, Package, Trash2, Share2, Layers, Loader2 } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useToast } from "@/hooks/use-toast";
import ProductImage from "@/components/product/ProductImage";

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
      .eq("user_id", user.id).order("created_at", { ascending: false });
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
    addItem({ id: item.product.id, title: item.product.title, price: item.product.price, image_url: img?.image_url || null, seller_id: item.product.seller_id, seller_name: "Seller", stock_quantity: item.product.stock_quantity });
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
    sorted.forEach(i => { const key = i.product.category_id || "uncategorized"; (groups[key] = groups[key] || []).push(i); });
    return groups;
  }, [sorted, groupByCategory]);

  const renderItem = (item: WishlistItem) => {
    const img = item.product.product_images?.find(i => i.is_primary) || item.product.product_images?.[0];
    const discount = item.product.compare_at_price && item.product.compare_at_price > item.product.price
      ? Math.round((1 - item.product.price / item.product.compare_at_price) * 100) : null;
    const outOfStock = item.product.stock_quantity === 0;
    return (
      <div key={item.id} className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] overflow-hidden group hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
        <Link to={`/product/${item.product.id}`}>
          <div className="aspect-square bg-[#F2F3F5] dark:bg-[#111111] relative overflow-hidden">
            {img
              ? <ProductImage src={img.image_url} alt={item.product.title} className="group-hover:scale-105" loading="lazy" />
              : <div className="flex items-center justify-center h-full"><Package className="h-10 w-10 text-[#C0C0B8] dark:text-[#333333]" /></div>
            }
            {discount && (
              <span className="absolute top-3 left-3 px-2 py-1 rounded-full bg-[#F6C75D] text-[#5C3A00] text-[9px] font-bold uppercase tracking-wider">
                -{discount}%
              </span>
            )}
            {outOfStock && (
              <div className="absolute inset-0 bg-white/60 dark:bg-black/60 flex items-center justify-center">
                <span className="text-[10px] font-bold text-[#888880] dark:text-[#A0A0A0] uppercase tracking-wider">Out of stock</span>
              </div>
            )}
          </div>
        </Link>
        <div className="p-4">
          <Link to={`/product/${item.product.id}`}>
            <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] truncate leading-snug group-hover:opacity-70 transition-opacity">{item.product.title}</p>
          </Link>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">${item.product.price}</span>
            {item.product.compare_at_price && item.product.compare_at_price > item.product.price && (
              <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] line-through">${item.product.compare_at_price}</span>
            )}
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={() => handleAddToCart(item)} disabled={outOfStock}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-[10px] font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              <ShoppingCart className="h-3 w-3" /> Add to Cart
            </button>
            <button onClick={() => removeItem(item.id)}
              className="flex items-center justify-center h-8 w-8 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-red-400 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/40 transition-colors">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1280px]">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">My Wishlist</h1>
            <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">{items.length} item{items.length !== 1 ? "s" : ""}</p>
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortKey} onValueChange={(v) => setSortKey(v as SortKey)}>
                <SelectTrigger className="h-9 w-[148px] rounded-full border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1A1A1A] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest</SelectItem>
                  <SelectItem value="price_asc">Price: Low → High</SelectItem>
                  <SelectItem value="price_desc">Price: High → Low</SelectItem>
                </SelectContent>
              </Select>
              <button onClick={() => setGroupByCategory(g => !g)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-[10px] font-bold transition-colors ${
                  groupByCategory
                    ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-[#111111] dark:border-[#FAF5F2]"
                    : "border-[#E8E8E8] dark:border-[#222222] text-[#888880] dark:text-[#A0A0A0] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A]"
                }`}>
                <Layers className="h-3 w-3" /> Group
              </button>
              <button onClick={shareWishlist}
                className="flex items-center gap-1.5 px-3 py-2 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[10px] font-bold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors">
                <Share2 className="h-3 w-3" /> Share
              </button>
              <label className="flex items-center gap-2 text-[10px] font-semibold text-[#888880] dark:text-[#A0A0A0] cursor-pointer">
                <Switch checked={isPublic} onCheckedChange={togglePublic} /> Public
              </label>
            </div>
          )}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={80}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#888880]" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] py-16">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                <Heart className="h-6 w-6 text-[#888880] dark:text-[#A0A0A0]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Your wishlist is empty</p>
                <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0] max-w-xs">Browse the marketplace and tap the heart icon to save products you love.</p>
              </div>
              <Link to="/marketplace">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] transition-colors">
                  Browse Products
                </button>
              </Link>
            </div>
          </div>
        ) : grouped ? (
          <div className="space-y-8">
            {Object.entries(grouped).map(([catId, list]) => (
              <div key={catId}>
                <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">
                  {categoryNames[catId] || "Uncategorized"}
                  <span className="ml-2 text-[#888880] dark:text-[#A0A0A0] font-normal text-xs">({list.length})</span>
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
