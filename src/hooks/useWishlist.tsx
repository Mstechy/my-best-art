import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useWishlist() {
  const { user } = useAuth();
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  const fetchWishlist = useCallback(async () => {
    if (!user) { setWishlistIds(new Set()); return; }
    const { data } = await supabase
      .from("wishlists" as any)
      .select("product_id")
      .eq("user_id", user.id);
    if (data) setWishlistIds(new Set((data as any[]).map((w: any) => w.product_id)));
  }, [user]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  const toggleWishlist = useCallback(async (productId: string) => {
    if (!user) return false;
    const isWished = wishlistIds.has(productId);
    if (isWished) {
      await supabase.from("wishlists" as any).delete().eq("user_id", user.id).eq("product_id", productId);
      setWishlistIds(prev => { const next = new Set(prev); next.delete(productId); return next; });
    } else {
      await supabase.from("wishlists" as any).insert({ user_id: user.id, product_id: productId } as any);
      setWishlistIds(prev => new Set(prev).add(productId));
    }
    return !isWished;
  }, [user, wishlistIds]);

  const isWishlisted = useCallback((productId: string) => wishlistIds.has(productId), [wishlistIds]);

  return { wishlistIds, toggleWishlist, isWishlisted, refetch: fetchWishlist };
}
