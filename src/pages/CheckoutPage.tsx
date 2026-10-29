import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import { COUNTRIES, phonePlaceholder } from "@/lib/countries";
import { ANALYTICS_CONSENT_CHANGED } from "@/lib/analyticsConsent";
import { trackGA4Event } from "@/lib/marketingAnalytics";
import {
  createMarketplaceOrders,
  initializeMarketplacePayment,
  quoteMarketplaceShipping,
  reconcileCheckoutItems as reconcileLiveCheckoutItems,
  type ShippingQuote,
} from "@/lib/checkoutService";

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

// Shared input style. `text-base md:text-sm` keeps the control at 16px on
// phones so iOS Safari does not zoom the page when the field is focused
// (see the matching rule in src/index.css), and `min-w-0` lets it shrink
// inside narrow grid columns instead of widening the card.
const inputCls = "w-full min-w-0 h-10 px-3 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-base md:text-sm text-[#111111] dark:text-[#FAF5F2] placeholder-[#C0C0B8] dark:placeholder-[#444444] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors";
const labelCls = "block text-[10px] font-bold uppercase tracking-wider text-[#6E6C64] dark:text-[#A0A0A0] mb-1";

export default function CheckoutPage() {
  const { items, clearCart, syncItems, directCheckoutItem, updateDirectCheckoutItem, clearDirectCheckout } = useCart();
  const { formatPrice, country: preferredCountry, currency } = useCurrency();
  const displayCurrency = currency?.code || "NGN";
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({ name: "", phone: "", street: "", city: "", state: "", zip: "", country: preferredCountry || "NG" });
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [saveAfter, setSaveAfter] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [checkoutNotice, setCheckoutNotice] = useState<string | null>(null);
  const checkoutItems = useMemo(() => directCheckoutItem ? [directCheckoutItem] : items, [directCheckoutItem, items]);
  const checkoutTotal = useMemo(() => checkoutItems.reduce((sum, item) => sum + item.price * item.quantity, 0), [checkoutItems]);
  const sellerGroups = useMemo(() => {
    const groups: Record<string, typeof checkoutItems> = {};
    checkoutItems.forEach(item => {
      if (!groups[item.seller_id]) groups[item.seller_id] = [];
      groups[item.seller_id].push(item);
    });
    return groups;
  }, [checkoutItems]);
  const [shippingQuotes, setShippingQuotes] = useState<ShippingQuote[]>([]);
  const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
  const [shippingQuoteError, setShippingQuoteError] = useState<string | null>(null);
  const shippingTotal = useMemo(() => shippingQuotes.reduce((sum, quote) => sum + quote.shipping_amount, 0), [shippingQuotes]);
  const checkoutGrandTotal = checkoutTotal + shippingTotal;
  const shippingQuoteReady = Boolean(address.country) && !shippingQuoteLoading && !shippingQuoteError && shippingQuotes.length === Object.keys(sellerGroups).length;
  const checkoutEventSentRef = useRef(false);
  const addressCountryDirtyRef = useRef(false);
  const savedAddressAppliedRef = useRef(false);

  // The regional preference can resolve after checkout's first render. Keep a
  // pristine checkout destination aligned with it, without overwriting a
  // country the shopper has already selected or a saved address.
  useEffect(() => {
    if (addressCountryDirtyRef.current || savedAddressAppliedRef.current) return;
    const nextCountry = preferredCountry || "NG";
    setAddress((current) => current.country === nextCountry ? current : { ...current, country: nextCountry });
  }, [preferredCountry]);

  useEffect(() => {
    if (checkoutItems.length === 0) return;
    const trackCheckoutStart = () => {
      if (checkoutEventSentRef.current) return;
      const sent = trackGA4Event("begin_checkout", {
        currency: "NGN",
        value: checkoutTotal,
        items: checkoutItems.map((item) => ({
          item_id: item.product_id,
          item_name: item.title,
          price: item.price,
          quantity: item.quantity,
        })),
      });
      if (sent) checkoutEventSentRef.current = true;
    };
    trackCheckoutStart();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED, trackCheckoutStart);
    return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED, trackCheckoutStart);
  }, [checkoutItems, checkoutTotal]);

  const fetchShippingQuotes = useCallback(async (): Promise<ShippingQuote[]> => {
    if (!address.country || Object.keys(sellerGroups).length === 0) return [];
    return quoteMarketplaceShipping(sellerGroups, address.country);
  }, [address.country, sellerGroups]);

  useEffect(() => {
    let active = true;
    if (!address.country || Object.keys(sellerGroups).length === 0) {
      setShippingQuotes([]);
      setShippingQuoteError(null);
      setShippingQuoteLoading(false);
      return () => { active = false; };
    }
    setShippingQuoteLoading(true);
    setShippingQuoteError(null);
    fetchShippingQuotes()
      .then((quotes) => { if (active) setShippingQuotes(quotes); })
      .catch((error: unknown) => {
        if (!active) return;
        setShippingQuotes([]);
        setShippingQuoteError(getUserFacingErrorMessage(error, "Shipping is not available for this destination."));
      })
      .finally(() => { if (active) setShippingQuoteLoading(false); });
    return () => { active = false; };
  }, [address.country, fetchShippingQuotes, sellerGroups]);
  const reconcileCheckoutItems = useCallback(async (): Promise<string | null> => {
    const reconciliation = await reconcileLiveCheckoutItems(checkoutItems);
    const { items: nextItems, priceChanged, availabilityChanged } = reconciliation;

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
    savedAddressAppliedRef.current = true;
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

      const freshQuotes = await fetchShippingQuotes();
      if (freshQuotes.length !== Object.keys(sellerGroups).length) {
        throw new Error("Shipping could not be calculated for every seller. Please review the delivery country.");
      }

      if (saveAfter) {
        await supabase.from("addresses" as any).insert({
          user_id: user.id, label: addressLabel || null, recipient: address.name, phone: address.phone || null,
          line1: address.street, city: address.city, region: address.state || null,
          postal_code: address.zip || null, country: address.country, is_default: saved.length === 0,
        } as any);
      }

      const orderIds = await createMarketplaceOrders(sellerGroups, address, idempotencyKey);
      const { data: authSession } = await supabase.auth.getSession();
      if (!authSession.session?.access_token) throw new Error("Your session expired. Please sign in again.");
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON;
      if (!supabaseKey) throw new Error("Supabase client configuration is missing.");
      const payment = await initializeMarketplacePayment(
        orderIds,
        user.email,
        authSession.session.access_token,
        supabaseKey,
      );
      if (directCheckoutItem) clearDirectCheckout();
      else clearCart();
      toast.success("Order created. Complete payment securely with Paystack.");
      window.location.assign(payment.authorization_url);
    }, [user, address, saveAfter, addressLabel, saved.length, directCheckoutItem, sellerGroups, fetchShippingQuotes, reconcileCheckoutItems, clearCart, clearDirectCheckout, navigate]),
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
          <p className="mt-1 text-xs text-[#6E6C64] dark:text-[#A0A0A0]">Add some products before checking out.</p>
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

      <div className="mx-auto max-w-4xl px-4 lg:px-8 pt-8 pb-28 md:pb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-xs text-[#6E6C64] hover:text-[#111111] dark:hover:text-[#FAF5F2] mb-6 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>

        <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight mb-8">Checkout</h1>

        {/* `min-w-0` on both columns: without it a grid item is floored by the
            content-based minimum of its children (the truncated product title
            and the field rows), which used to push the column past the phone
            viewport and clip the order summary. */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: shipping form */}
          <div className="lg:col-span-3 min-w-0 space-y-5">
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5">
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Shipping Address</p>

              {saved.length > 0 && (
                <div className="mb-5">
                  <label htmlFor="checkout-saved-address" className={labelCls}>Saved Addresses</label>
                  <Select onValueChange={(id) => { const a = saved.find(s => s.id === id); if (a) applySaved(a); }}>
                    <SelectTrigger id="checkout-saved-address" className="h-10 rounded-xl border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-sm text-[#111111] dark:text-[#FAF5F2]">
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
                  <input id="checkout-name" autoComplete="name" className={inputCls} value={address.name} onChange={e => setAddress(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" aria-required="true" />
                </div>
                 <div>
                   <label htmlFor="checkout-phone" className={labelCls}>Phone</label>
                   <input id="checkout-phone" type="tel" inputMode="tel" autoComplete="tel" className={inputCls} value={address.phone} onChange={e => setAddress(p => ({ ...p, phone: e.target.value }))} placeholder={phonePlaceholder(address.country)} />
                 </div>
                <div>
                  <label htmlFor="checkout-street" className={labelCls}>Street Address *</label>
                  <input id="checkout-street" autoComplete="street-address" className={inputCls} value={address.street} onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} placeholder="123 Main St" aria-required="true" />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="checkout-city" className={labelCls}>City *</label>
                    <input id="checkout-city" autoComplete="address-level2" className={inputCls} value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} placeholder="New York" aria-required="true" />
                  </div>
                  <div>
                    <label htmlFor="checkout-state" className={labelCls}>State</label>
                    <input id="checkout-state" autoComplete="address-level1" className={inputCls} value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} placeholder="NY" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="checkout-zip" className={labelCls}>ZIP Code</label>
                    <input id="checkout-zip" autoComplete="postal-code" className={inputCls} value={address.zip} onChange={e => setAddress(p => ({ ...p, zip: e.target.value }))} placeholder="10001" />
                  </div>
                  <div>
                    <label htmlFor="checkout-country" className={labelCls}>Country *</label>
                    <Select value={address.country} onValueChange={country => { addressCountryDirtyRef.current = true; setAddress(p => ({ ...p, country })); }}>
                      <SelectTrigger id="checkout-country" className="h-10 rounded-xl border-[#E8E8E8] bg-[#FAFAFA] text-sm dark:border-[#2A2A2A] dark:bg-[#111111]"><SelectValue placeholder="Select country" /></SelectTrigger>
                      <SelectContent>{COUNTRIES.map(country => <SelectItem key={country.code} value={country.code}>{country.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                <label className="flex items-center gap-2 text-xs cursor-pointer text-[#6E6C64] dark:text-[#A0A0A0]">
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
          <div className="lg:col-span-2 min-w-0">
            <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 sticky top-20">
              <div className="mb-4 flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Order Summary</p>
                {directCheckoutItem && <span className="rounded-full bg-[#F2F3F5] px-2 py-1 text-[9px] font-bold text-[#6E6C64] dark:bg-[#111111]">Buy now</span>}
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
                        <p className="text-[10px] text-[#6E6C64] truncate">{Object.values(item.variant_attributes ?? {}).join(" / ")}</p>
                      )}
                      <p className="text-[10px] text-[#6E6C64]">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#F2F3F5] dark:border-[#1E1E1E] pt-3 space-y-2">
                <div className="flex justify-between text-xs text-[#6E6C64]">
                  <span>Subtotal</span><span>{formatPrice(checkoutTotal)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#6E6C64]">Shipping</span>
                  <span className="text-right text-[#6E6C64] dark:text-[#A0A0A0] font-semibold">
                    {shippingQuoteLoading ? "Calculating…" : shippingQuoteError ? "Unavailable" : address.country ? formatPrice(shippingTotal) : "Select a country"}
                  </span>
                </div>
                {shippingQuoteReady && (() => {
                  const dates = shippingQuotes.flatMap((quote) => [quote.delivery_min_date, quote.delivery_max_date].filter((date): date is string => Boolean(date)));
                  if (dates.length < 2) return null;
                  const min = new Date(dates.sort()[0]);
                  const max = new Date(dates.sort().at(-1) as string);
                  return <p className="text-[10px] text-[#6E6C64] dark:text-[#A0A0A0]">Estimated delivery: {min.toLocaleDateString()} – {max.toLocaleDateString()}</p>;
                })()}
                {shippingQuoteError && <p role="alert" className="text-[10px] leading-relaxed text-red-600 dark:text-red-400">{shippingQuoteError}</p>}
                <div className="flex justify-between text-sm font-bold text-[#111111] dark:text-[#FAF5F2] pt-2 border-t border-[#F2F3F5] dark:border-[#1E1E1E]">
                  <span>Total</span><span>{formatPrice(checkoutGrandTotal)}</span>
                </div>
                {displayCurrency !== "NGN" && (
                  <p className="text-[10px] leading-relaxed text-[#6E6C64] dark:text-[#A0A0A0]">
                    Displayed in {displayCurrency}. Paystack currently processes Tradibu orders in NGN; your bank may apply its exchange rate.
                  </p>
                )}
              </div>

              <button
                onClick={handlePlaceOrder}
                disabled={loading || !shippingQuoteReady}
                className="w-full mt-5 py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50 hidden md:flex items-center justify-center gap-2"
              >
                {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order…</> : "Place Order"}
              </button>

              <p className="text-[10px] text-[#6E6C64] text-center mt-3 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Order protection and secure processing
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { icon: Lock, label: "Secure order" },
                  { icon: ShieldCheck, label: "Buyer Protection" },
                  { icon: Package, label: "Seller fulfillment" },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-1 rounded-xl border border-[#F2F3F5] dark:border-[#1E1E1E] py-2 text-[9px] text-[#6E6C64] dark:text-[#A0A0A0]">
                    <Icon className="h-3.5 w-3.5 text-[#111111] dark:text-[#FAF5F2]" />{label}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile checkout bar: below `md` the order summary sits under a long
          form, so the Place Order CTA is pinned to the bottom of the screen
          instead of being scrolled (or scrolled past) off the page. z-40 keeps
          it under the cart drawer and sheets, matching the product page bar. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E8E8] bg-white pb-[env(safe-area-inset-bottom,0px)] dark:border-[#222222] dark:bg-[#111111] md:hidden">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6E6C64] dark:text-[#A0A0A0]">Total</p>
            <p className="truncate text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{formatPrice(checkoutGrandTotal)}</p>
          </div>
          <button
            onClick={handlePlaceOrder}
            disabled={loading || !shippingQuoteReady}
            className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] px-6 py-3 text-sm font-bold text-white dark:text-[#111111] transition-colors hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] disabled:opacity-50"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Placing Order…</> : "Place Order"}
          </button>
        </div>
      </div>
    </div>
  );
}
