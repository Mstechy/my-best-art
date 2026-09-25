import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/hooks/useCart";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useDedupedMutation } from "@/hooks/useDedupedMutation";
import { supabase } from "@/integrations/supabase/client";
import { getUserFacingErrorMessage, logError } from "@/lib/errorHandler";
import { toast } from "sonner";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { Package, ArrowLeft, ShoppingBag, CheckCircle2, Lock, ShieldCheck, BookmarkPlus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { COUNTRIES } from "@/lib/countries";

/** Generate a unique idempotency key for safe retries without duplicate orders */
function generateIdempotencyKey(): string {
  return `po_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
}

interface SavedAddress {
  id: string;
  label: string | null;
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  region: string | null;
  postal_code: string | null;
  country: string;
  phone: string | null;
  is_default: boolean;
}

// Shared input style
const inputCls = "w-full h-10 px-3 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-sm text-[#111111] dark:text-[#FAF5F2] placeholder-[#C0C0B8] dark:placeholder-[#444444] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors";
const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0] mb-1";

export default function CheckoutPage() {
  const { items, clearCart, syncItems, directCheckoutItem, updateDirectCheckoutItem, clearDirectCheckout } = useCart();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({ name: "", phone: "", street: "", city: "", state: "", zip: "", country: "" });
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [saveAfter, setSaveAfter] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const checkoutItems = useMemo(() => directCheckoutItem ? [directCheckoutItem] : items, [directCheckoutItem, items]);
  const checkoutTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [checkoutItems]);

  const reconcileCheckoutItems = useCallback(async (): Promise<string | null> => {
    const productIds = [...new Set(checkoutItems.map((item) => item.product_id))];
    const variantIds = checkoutItems.flatMap((item) => item.product_variant_id ? [item.product_variant_id] : []);
    const { data: products, error: productError } = productIds.length
      ? await supabase.from("products").select("id, price, stock_quantity, status, is_approved").in("id", productIds)
      : { data: [], error: null };
    if (productError) throw productError;
    const { data: variants, error: variantError } = variantIds.length
      ? await supabase.from("product_variants").select("id, product_id, price, stock_quantity, is_active").in("id", variantIds)
      : { data: [], error: null };
    if (variantError) throw variantError;

    const productMap = new Map((products ?? []).map((product) => [product.id, product]));
    const variantMap = new Map((variants ?? []).map((variant) => [variant.id, variant]));
    let priceChanged = false;
    let availabilityChanged = false;
    const nextItems = checkoutItems.map((item) => {
      const product = productMap.get(item.product_id);
      const variant = item.product_variant_id ? variantMap.get(item.product_variant_id) : null;
      const available = Boolean(
        product && product.status === "active" && product.is_approved &&
        (!item.product_variant_id || (variant && variant.product_id === product.id && variant.is_active)),
      );
      const livePrice = available ? Number(variant?.price ?? product.price) : item.price;
      const liveStock = available ? Number(variant?.stock_quantity ?? product.stock_quantity) : 0;
      if (livePrice !== item.price) priceChanged = true;
      if (!available || liveStock < item.quantity) availabilityChanged = true;
      return { ...item, price: livePrice, stock_quantity: liveStock };
    });

    const changed = nextItems.some((item, index) => item.price !== checkoutItems[index].price || item.stock_quantity !== checkoutItems[index].stock_quantity);
    if (changed) {
      if (directCheckoutItem) updateDirectCheckoutItem(nextItems[0]);
      else syncItems(nextItems);
    }
    if (availabilityChanged) return directCheckoutItem
      ? "This Buy Now item is no longer available in the requested quantity. Return to the product to choose an available option."
      : "One or more items are no longer available in the requested quantity. We updated the cart; review it before placing your order.";
    if (priceChanged) return "A price changed. We updated the order summary; please review the new total before placing your order.";
    return null;
  }, [checkoutItems, directCheckoutItem, syncItems, updateDirectCheckoutItem]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("addresses" as any)
        .select("*").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at", { ascending: false });
      const list = (data as any) as SavedAddress[] || [];
      setSaved(list);
      const def = list.find(a => a.is_default) || list[0];
      if (def) applySaved(def);
    })();
  }, [user]);

  const applySaved = (a: SavedAddress) => {
    const savedCountry = COUNTRIES.find(country => country.code === a.country || country.name.toLowerCase() === a.country.toLowerCase())?.code || "";
    setAddress({
      name: a.recipient, phone: a.phone || "", street: [a.line1, a.line2].filter(Boolean).join(", "),
      city: a.city, state: a.region || "", zip: a.postal_code || "", country: savedCountry,
    });
  };

  const placeOrder = useDedupedMutation(
    useCallback(async (idempotencyKey: string) => {
      if (!user) {
        toast.error("Please sign in to place an order.");
        navigate("/auth/login");
        return;
      }
      if (!address.name || !address.street || !address.city || !address.country) {
        toast.error("Please fill in all required address fields.");
        return;
      }

      const reconciliationMessage = await reconcileCheckoutItems();
      if (reconciliationMessage) {
        setCheckoutNotice(reconciliationMessage);
        toast.error(reconciliationMessage);
        return;
      }

      if (saveAfter) {
        await supabase.from("addresses" as any).insert({
          user_id: user.id, label: addressLabel || null, recipient: address.name, phone: address.phone || null,
          line1: address.street, city: address.city, region: address.state || null,
          postal_code: address.zip || null, country: address.country, is_default: saved.length === 0,
        } as any);
      }

      const sellerGroups: Record<string, typeof checkoutItems> = {};
      checkoutItems.forEach(item => {
        if (!sellerGroups[item.seller_id]) sellerGroups[item.seller_id] = [];
        sellerGroups[item.seller_id].push(item);
      });

      const orderIds: string[] = [];
      for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
        const { data: orderId, error } = await supabase.rpc("place_marketplace_order", {
          p_seller_id: sellerId,
          p_shipping_address: address,
          p_items: sellerItems.map(item => ({
            product_id: item.product_id || item.id.split("::")[0],
            product_variant_id: item.product_variant_id || null,
            quantity: item.quantity,
          })),
          p_idempotency_key: `${idempotencyKey}:${sellerId}`,
        });
        if (error) throw error;
        if (orderId) orderIds.push(orderId);
      }
      const { data: payment, error: paymentError } = await supabase.functions.invoke("paystack", {
        body: { action: "initialize", orderIds, email: user.email },
      });
      if (paymentError || !payment?.authorization_url) throw paymentError || new Error("Could not start secure payment.");
      if (directCheckoutItem) clearDirectCheckout();
      else clearCart();
      toast.success("Order created. Complete payment securely with Paystack.");
      window.location.assign(payment.authorization_url);
    }, [user, address, saveAfter, addressLabel, saved.length, checkoutItems, directCheckoutItem, reconcileCheckoutItems, clearCart, clearDirectCheckout, navigate]),
    useCallback(() => "place-order", []),
  );

  const handlePlaceOrder = async () => {
    if (!user) {
      toast.error("Please sign in to place an order.");
      navigate("/auth/login");
      return;
    }
    if (!address.name || !address.street || !address.city || !address.country) {
      toast.error("Please fill in all required address fields.");
      return;
    }
    setCheckoutNotice(null);
    setLoading(true);
    try {
      const idempotencyKey = generateIdempotencyKey();
      await placeOrder(idempotencyKey);
    } catch (error: unknown) {
      logError(error, "checkout");
      const message = getUserFacingErrorMessage(error, "checkout");
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Empty cart state
  if (checkoutItems.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">
        <MarketplaceNavbar showSearch={false} />
        <CartDrawer />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <div className="h-16 w-16 rounded-2xl bg-[#F2F3F5] dark:bg-[#1A1A1A] flex items-center justify-center mb-5">
            <ShoppingBag className="h-7 w-7 text-[#C0C0B8] dark:text-[#333333]" />
          </div>
          <h2 className="text-lg font-bold text-[#111111] dark:text-[#FAF5F2]">Your cart is empty</h2>
          <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">Add some products before checking out.</p>
          <Link to="/marketplace" className="mt-6 inline-flex px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">
      <MarketplaceNavbar showSearch={false} />
      <CartDrawer />

      <div className="mx-auto max-w-4xl px-4 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* Left: shipping form */}
          <div className="lg:col-span-3 space-y-5">
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Shipping Address</p>

              {saved.length > 0 && (
                <div className="mb-5">
                  <label className={labelCls}>Saved Addresses</label>
                  <Select onValueChange={(id) => { const a = saved.find(s => s.id === id); if (a) applySaved(a); }}>
                    <SelectTrigger className="h-10 rounded-xl border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-sm text-[#111111] dark:text-[#FAF5F2]">
                      <SelectValue placeholder="Choose a saved address" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#222222]">
                      {saved.map(a => (
                        <SelectItem key={a.id} value={a.id} className="text-xs text-[#111111] dark:text-[#FAF5F2]">
                          {a.label || a.recipient} — {a.line1}, {a.city}{a.is_default ? " (Default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-3">
                <div>
                  <label htmlFor="checkout-name" className={labelCls}>Full Name *</label>
                  <input id="checkout-name" className={inputCls} value={address.name} onChange={e => setAddress(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
                </div>
                 <div>
                   <label htmlFor="checkout-phone" className={labelCls}>Phone</label>
                   <input id="checkout-phone" className={inputCls} value={address.phone} onChange={e => setAddress(p => ({ ...p, phone: e.target.value }))} placeholder="+234 800 000 0000" />
                 </div>
                <div>
                  <label htmlFor="checkout-street" className={labelCls}>Street Address *</label>
                  <input id="checkout-street" className={inputCls} value={address.street} onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="checkout-city" className={labelCls}>City *</label>
                    <input id="checkout-city" className={inputCls} value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} placeholder="New York" />
                  </div>
                  <div>
                    <label htmlFor="checkout-state" className={labelCls}>State</label>
                    <input id="checkout-state" className={inputCls} value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} placeholder="NY" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="checkout-zip" className={labelCls}>ZIP Code</label>
                    <input id="checkout-zip" className={inputCls} value={address.zip} onChange={e => setAddress(p => ({ ...p, zip: e.target.value }))} placeholder="10001" />
                  </div>
                  <div>
                    <label className={labelCls}>Country *</label>
                    <Select value={address.country} onValueChange={country => setAddress(p => ({ ...p, country }))}>
                      <SelectTrigger className="h-10 rounded-xl border-[#E8E8E8] bg-[#FAFAFA] text-sm dark:border-[#2A2A2A] dark:bg-[#111111]"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map(country => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-[#888880] dark:text-[#A0A0A0]">
                  <input type="checkbox" checked={saveAfter} onChange={e => setSaveAfter(e.target.checked)} className="h-3.5 w-3.5 rounded border-[#E8E8E8] dark:border-[#222222] accent-[#111111]" />
                  <BookmarkPlus className="h-3.5 w-3.5" /> Save this address for future orders
                </label>
                {saveAfter && (
                  <input
                    className={inputCls}
                    value={addressLabel}
                    onChange={e => setAddressLabel(e.target.value)}
                    placeholder="Label (e.g. Home, Office)"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Right: order summary */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 sticky top-20">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Order Summary</p>
                {directCheckoutItem && <span className="rounded-full bg-[#F2F3F5] px-2 py-1 text-[9px] font-bold text-[#888880] dark:bg-[#111111]">Buy now</span>}
              </div>

              {checkoutNotice && (
                <p role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/30 dark:text-amber-100">
                  {checkoutNotice}
                </p>
              )}

              <div className="space-y-3 mb-4">
                {checkoutItems.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-xl bg-[#F2F3F5] dark:bg-[#111111] overflow-hidden shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-[#C0C0B8]" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] truncate">{item.title}</p>
                      {Object.values(item.variant_attributes ?? {}).length > 0 && (
                        <p className="text-[10px] text-[#888880] truncate">{Object.values(item.variant_attributes ?? {}).join(" · ")}</p>
                      )}
                      <p className="text-[10px] text-[#888880]">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#F2F3F5] dark:border-[#1E1E1E] pt-3 space-y-2">
                <div className="flex justify-between text-xs text-[#888880]">
                  <span>Subtotal</span><span>{formatPrice(checkoutTotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#888880]">Shipping</span>
                  <span className="text-[#888880] dark:text-[#A0A0A0] font-semibold">Calculated at checkout</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#111111] dark:text-[#FAF5F2] pt-2 border-t border-[#F2F3F5] dark:border-[#1E1E1E]">
                  <span>Total</span><span>{formatPrice(checkoutTotal)}</span>
                </div>
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading}
                className="w-full mt-5 py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order…</> : "Place Order"}
              </button>

              <p className="text-[10px] text-[#888880] text-center mt-3 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Order protection and secure processing
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { icon: Lock, label: "Secure order" },
                  { icon: ShieldCheck, label: "Buyer Protection" },
                  { icon: Package, label: "Seller fulfillment" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] py-2 text-[9px] text-[#888880] dark:text-[#A0A0A0]">
                    <Icon className="h-3.5 w-3.5 text-[#111111] dark:text-[#FAF5F2]" />{label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
