import { createContext, useContext, useState, ReactNode, useCallback, useMemo, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { persistentCacheGet, persistentCacheSet, persistentCacheDelete } from "@/lib/indexedDBCache";

export interface CartItem {
  /** Composite key: product_id or product_id::variantSuffix for display */
  id: string;
  product_id: string;
  product_variant_id?: string;
  variant_attributes?: Record<string, string>;
  title: string;
  price: number;
  image_url: string | null;
  seller_id: string;
  seller_name: string;
  quantity: number;
  stock_quantity: number;
}

type CartItemInput = Omit<CartItem, "quantity"> & { quantity?: number };

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  addItem: (item: CartItemInput) => void;
  replaceItems: (items: CartItemInput[]) => void;
  syncItems: (items: CartItem[]) => void;
  directCheckoutItem: CartItem | null;
  beginDirectCheckout: (item: CartItemInput) => void;
  updateDirectCheckoutItem: (item: CartItem) => void;
  clearDirectCheckout: () => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  groupedBySeller: Record<string, CartItem[]>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const ANON_CART_KEY = "anon_cart";
const DIRECT_CHECKOUT_KEY = "direct_checkout_item";
const VISITOR_KEY = "markethub_visitor_id";

function getVisitorId(): string {
  let id = localStorage.getItem(VISITOR_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(VISITOR_KEY, id); }
  return id;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [directCheckoutItem, setDirectCheckoutItem] = useState<CartItem | null>(() => {
    try {
      const saved = sessionStorage.getItem(DIRECT_CHECKOUT_KEY);
      return saved ? JSON.parse(saved) as CartItem : null;
    } catch {
      return null;
    }
  });
  const dbCartIdRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // ── Load cart on mount & auth change ──────────────────────────────────
  const loadCart = useCallback(async () => {
    setLoading(true);
    try {
      if (user) {
        // ── Authenticated: load from Supabase DB ──
        // New tables not yet in generated types – use any-typed helpers
        const cartsQuery = supabase.from("carts" as any) as any;
        const itemsQuery = supabase.from("cart_items" as any) as any;

        const { data: cartRow } = await cartsQuery.select("id").eq("user_id", user.id).maybeSingle() as { data: { id: string } | null };
        let cart: { id: string } = cartRow!;
        if (!cart) {
          const { data: inserted } = await cartsQuery.insert({ user_id: user.id }).select("id").single() as { data: { id: string } };
          cart = inserted!;
          if (!cart) { setLoading(false); return; }
        }
        dbCartIdRef.current = cart.id;

        // Merge any anonymous cart that was stored locally into the DB
        const anonItems: CartItem[] | null = await persistentCacheGet<CartItem[]>(ANON_CART_KEY);
        if (anonItems && anonItems.length > 0) {
          const rows = anonItems.map(item => ({
            cart_id: cart.id,
            product_id: item.product_id || item.id.split("::")[0],
            product_variant_id: item.product_variant_id || null,
            unit_price: item.price,
            variant_attributes: item.variant_attributes || {},
            quantity: item.quantity,
            seller_name: item.seller_name,
          }));

          for (const row of rows) {
            try {
              await itemsQuery.upsert(row, {
                onConflict: "cart_id,product_id,product_variant_id",
                ignoreDuplicates: false,
              });
            } catch { /* silently ignore upsert conflicts */ }
          }

          await persistentCacheDelete(ANON_CART_KEY);
        }

        const { data: rawDbItems } = await itemsQuery
          .select("product_id, product_variant_id, unit_price, variant_attributes, quantity, seller_name")
          .eq("cart_id", cart.id) as { data: { product_id: string; product_variant_id: string | null; unit_price: number | null; variant_attributes: Record<string, string> | null; quantity: number; seller_name: string | null }[] | null };

        const dbItems = rawDbItems ?? [];
        if (mountedRef.current) {
          if (dbItems.length === 0) {
            setItems([]);
            return;
          }
          const productIds = [...new Set(dbItems.map(r => r.product_id))];
          interface ProductRow {
            id: string;
            title: string;
            price: number;
            stock_quantity: number;
            seller_id: string;
            product_images: { image_url: string; is_primary: boolean }[];
          }
          const { data: products } = (productIds.length
            ? await supabase.from("products")
                .select("id, title, price, stock_quantity, seller_id, product_images(image_url, is_primary)")
                .in("id", productIds)
            : { data: [] }) as { data: ProductRow[] };

          const productMap = new Map(products.map((p: ProductRow) => [p.id, p]));
          const variantIds = dbItems.flatMap((item) => item.product_variant_id ? [item.product_variant_id] : []);
          const { data: variants } = (variantIds.length
            ? await supabase.from("product_variants").select("id, stock_quantity, image_url").in("id", variantIds)
            : { data: [] }) as { data: { id: string; stock_quantity: number; image_url: string | null }[] };
          const variantMap = new Map(variants.map((variant) => [variant.id, variant]));

          const mapped: CartItem[] = dbItems.map(r => {
            const p = productMap.get(r.product_id);
            const variant = r.product_variant_id ? variantMap.get(r.product_variant_id) : undefined;
            const img = p?.product_images?.find((i: { is_primary: boolean }) => i.is_primary) || p?.product_images?.[0];
            const suffix = r.product_variant_id ? `::${r.product_variant_id}` : "";
            return {
              id: `${r.product_id}${suffix}`,
              product_id: r.product_id,
              product_variant_id: r.product_variant_id || undefined,
              variant_attributes: r.variant_attributes || {},
              title: p?.title || "Product",
              price: Number(r.unit_price ?? p?.price ?? 0),
              image_url: variant?.image_url || img?.image_url || null,
              seller_id: p?.seller_id || "",
              seller_name: r.seller_name || "Seller",
              quantity: r.quantity,
              stock_quantity: variant?.stock_quantity ?? p?.stock_quantity ?? 0,
            };
          });
          setItems(mapped);
        }
      } else {
        // ── Anonymous: load from IndexedDB (no server access) ──
        dbCartIdRef.current = null;
        const cached: CartItem[] | null = await persistentCacheGet<CartItem[]>(ANON_CART_KEY);
        if (cached && mountedRef.current) {
          setItems(cached);
        }
      }
    } catch (err) {
      console.error("[Cart] Failed to load", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadCart(); }, [loadCart]);

  // ── Persist helper ────────────────────────────────────────────────────
  const persist = useCallback(async (cartItems: CartItem[]) => {
    if (user) {
      // ── Authenticated: write to Supabase DB ──
      const cartId = dbCartIdRef.current;
      if (!cartId) return;

      // cart_items table not yet in generated types – use any-typed helper
      const itemsTable = supabase.from("cart_items" as any) as any;

      try {
        await itemsTable.delete().eq("cart_id", cartId);
      } catch (e) { console.error("[Cart] DB delete failed", e); return; }
      if (cartItems.length === 0) return;

      const rows = cartItems.map(item => ({
        cart_id: cartId,
        product_id: item.product_id || item.id.split("::")[0],
        product_variant_id: item.product_variant_id || null,
        unit_price: item.price,
        variant_attributes: item.variant_attributes || {},
        quantity: item.quantity,
        seller_name: item.seller_name,
      }));

      try {
        await itemsTable.insert(rows);
      } catch (e) { console.error("[Cart] DB insert failed", e); }
    } else {
      // ── Anonymous: write to IndexedDB only ──
      await persistentCacheSet(ANON_CART_KEY, cartItems, 7 * 24 * 60 * 60 * 1000); // 7 day TTL
    }
  }, [user]);

  const persistRef = useRef<typeof persist>(persist);
  persistRef.current = persist;

  const writeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const schedulePersist = useCallback((cartItems: CartItem[]) => {
    if (writeRef.current) clearTimeout(writeRef.current);
    writeRef.current = setTimeout(() => { persistRef.current(cartItems); }, 500);
  }, []);

  useEffect(() => {
    return () => { if (writeRef.current) clearTimeout(writeRef.current); };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────
  const addItem = useCallback((item: CartItemInput) => {
    const requestedQuantity = Math.max(1, item.quantity ?? 1);
    setItems(prev => {
      const existing = prev.find(i => i.id === item.id);
      let next: CartItem[];
      if (existing) {
        next = prev.map(i =>
          i.id === item.id
            ? { ...i, quantity: Math.min(i.quantity + requestedQuantity, i.stock_quantity) }
            : i
        );
      } else {
        next = [...prev, { ...item, quantity: Math.min(requestedQuantity, item.stock_quantity) }];
      }
      schedulePersist(next);
      return next;
    });
    setIsOpen(true);
  }, [schedulePersist]);

  const replaceItems = useCallback((newItems: CartItemInput[]) => {
    setItems(prev => {
      const next: CartItem[] = newItems.map(item => {
        const requestedQuantity = Math.max(1, item.quantity ?? 1);
        return {
          ...item,
          quantity: Math.min(requestedQuantity, item.stock_quantity),
        };
      });
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const syncItems = useCallback((nextItems: CartItem[]) => {
    setItems(nextItems);
    schedulePersist(nextItems);
  }, [schedulePersist]);

  const beginDirectCheckout = useCallback((item: CartItemInput) => {
    const requestedQuantity = Math.max(1, item.quantity ?? 1);
    const nextItem: CartItem = { ...item, quantity: Math.min(requestedQuantity, item.stock_quantity) };
    setDirectCheckoutItem(nextItem);
    try { sessionStorage.setItem(DIRECT_CHECKOUT_KEY, JSON.stringify(nextItem)); } catch { /* session-only checkout is still available */ }
  }, []);

  const updateDirectCheckoutItem = useCallback((item: CartItem) => {
    setDirectCheckoutItem(item);
    try { sessionStorage.setItem(DIRECT_CHECKOUT_KEY, JSON.stringify(item)); } catch { /* session-only checkout is still available */ }
  }, []);

  const clearDirectCheckout = useCallback(() => {
    setDirectCheckoutItem(null);
    try { sessionStorage.removeItem(DIRECT_CHECKOUT_KEY); } catch { /* nothing else to clear */ }
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems(prev => {
      const next = prev.filter(i => i.id !== id);
      schedulePersist(next);
      return next;
    });
  }, [schedulePersist]);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) { removeItem(id); return; }
    setItems(prev => {
      const next = prev.map(i =>
        i.id === id ? { ...i, quantity: Math.min(quantity, i.stock_quantity) } : i
      );
      schedulePersist(next);
      return next;
    });
  }, [removeItem, schedulePersist]);

  const clearCart = useCallback(async () => {
    setItems([]);
    if (user) {
      const cartId = dbCartIdRef.current;
      if (cartId) {
        try {
          await (supabase.from("cart_items" as any) as any).delete().eq("cart_id", cartId);
        } catch { /* silently ignore */ }
      }
    } else {
      await persistentCacheDelete(ANON_CART_KEY);
    }
  }, [user]);

  const totalItems = useMemo(() => items.reduce((sum, i) => sum + i.quantity, 0), [items]);
  const totalPrice = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);

  const groupedBySeller = useMemo<Record<string, CartItem[]>>(() => {
    return items.reduce<Record<string, CartItem[]>>((acc, item) => {
      const key = item.seller_id || "unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [items]);

  const value = useMemo(() => ({
    items, loading, addItem, replaceItems, syncItems, directCheckoutItem, beginDirectCheckout, updateDirectCheckoutItem, clearDirectCheckout, removeItem, updateQuantity, clearCart,
    totalItems, totalPrice, isOpen, setIsOpen, groupedBySeller,
  }), [items, loading, addItem, replaceItems, syncItems, directCheckoutItem, beginDirectCheckout, updateDirectCheckoutItem, clearDirectCheckout, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isOpen, groupedBySeller]);

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
