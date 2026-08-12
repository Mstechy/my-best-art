import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/hooks/useCart";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface RecommendedItem {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
}

export default function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalPrice, totalItems } = useCart();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const [recommended, setRecommended] = useState<RecommendedItem[]>([]);

  useEffect(() => {
    if (!isOpen || items.length > 0) return;
    let cancelled = false;
    const loadRecommended = async () => {
      const { data } = await supabase
        .from("products")
        .select("id,title,price,product_images(image_url)")
        .eq("status", "active")
        .gt("stock_quantity", 0)
        .neq("seller_id", user?.id ?? "")
        .order("created_at", { ascending: false })
        .limit(3);
      if (cancelled) return;
      setRecommended((data || []).map(p => ({
        id: p.id,
        title: p.title,
        price: p.price,
        image_url: (p.product_images?.[0] as any)?.image_url ?? null,
      })));
    };
    void loadRecommended();
    return () => { cancelled = true; };
  }, [isOpen, items.length, user?.id]);

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetContent className="flex flex-col w-full sm:max-w-md bg-white dark:bg-[#111111] border-l border-[#E8E8E8] dark:border-[#222222] p-0">
        {/* Header - brand left, count + close right, no overlap */}
        <SheetHeader className="px-5 py-4 border-b border-[#F2F3F5] dark:border-[#1A1A1A]">
          <SheetTitle className="flex items-center justify-between gap-3 text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">
            <span className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="font-sans text-base font-black tracking-tighter lowercase">
                market<span className="text-[#F6C75D]">hub</span>
              </span>
            </span>
            <span className="text-[10px] font-semibold text-[#888880] shrink-0">{totalItems} item{totalItems !== 1 ? "s" : ""}</span>
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="h-16 w-16 rounded-2xl bg-[#F2F3F5] dark:bg-[#1A1A1A] flex items-center justify-center mb-4">
              <ShoppingBag className="h-7 w-7 text-[#C0C0B8] dark:text-[#333333]" />
            </div>
            <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Your cart is empty</p>
            <p className="text-xs text-[#888880] dark:text-[#A0A0A0] mt-1">Browse products and add items to get started.</p>
            <Link to="/marketplace" onClick={() => setIsOpen(false)} className="mt-5">
              <button className="flex items-center gap-1.5 px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
                Browse Products <ArrowRight className="h-3 w-3" />
              </button>
            </Link>

            {/* More to Love feed */}
            {recommended.length > 0 && (
              <div className="w-full mt-8 text-left">
                <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mb-3">More to Love</p>
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin">
                  {recommended.map(p => (
                    <Link
                      key={p.id}
                      to={`/product/${p.id}`}
                      onClick={() => setIsOpen(false)}
                      className="shrink-0 w-32 rounded-2xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#1A1A1A] overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-square bg-[#F2F3F5] dark:bg-[#111111]">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <ShoppingBag className="h-5 w-5 text-[#C0C0B8]" />
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2] line-clamp-2 leading-snug">{p.title}</p>
                        <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mt-1">{formatPrice(p.price)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 pb-6">
            {items.map(item => (
              <div key={item.id} className="flex gap-3 rounded-2xl border border-[#F2F3F5] dark:border-[#1E1E1E] bg-[#FAFAFA] dark:bg-[#1A1A1A] p-3">
                <div className="h-20 w-20 rounded-xl bg-[#F2F3F5] dark:bg-[#111111] overflow-hidden shrink-0">
                  {item.image_url ? (
                    <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ShoppingBag className="h-5 w-5 text-[#C0C0B8]" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                  <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] line-clamp-2 leading-snug">{item.title}</p>
                  <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-0.5">{item.seller_name}</p>
                  <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mt-1">{formatPrice(item.price * item.quantity)}</p>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      className="h-6 w-6 rounded-lg border border-[#E8E8E8] dark:border-[#222222] flex items-center justify-center hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
                      aria-label={`Decrease quantity of ${item.title}`}
                    >
                      <Minus className="h-2.5 w-2.5" />
                    </button>
                    <span className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] w-5 text-center">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      className="h-6 w-6 rounded-lg border border-[#E8E8E8] dark:border-[#222222] flex items-center justify-center hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors"
                      aria-label={`Increase quantity of ${item.title}`}
                    >
                      <Plus className="h-2.5 w-2.5" />
                    </button>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="ml-auto h-6 w-6 rounded-lg flex items-center justify-center text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      aria-label={`Remove ${item.title} from cart`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div className="sticky bottom-0 z-10 px-5 py-4 border-t border-[#F2F3F5] dark:border-[#1A1A1A] space-y-3 bg-white dark:bg-[#111111] pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[#888880] dark:text-[#A0A0A0]">Total</span>
              <span className="text-xl font-bold text-[#111111] dark:text-[#FAF5F2]">{formatPrice(totalPrice)}</span>
            </div>
            <Link to="/checkout" onClick={() => setIsOpen(false)} className="block">
              <button className="w-full py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
                Checkout
              </button>
            </Link>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}