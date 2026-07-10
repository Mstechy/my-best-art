import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/hooks/useCart";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { Package, ArrowLeft, ShoppingBag, CheckCircle2, Lock, ShieldCheck, CreditCard, BookmarkPlus, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

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
  const { items, totalPrice, clearCart } = useCart();
  const { formatPrice } = useCurrency();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [address, setAddress] = useState({ name: "", street: "", city: "", state: "", zip: "", country: "" });
  const [saved, setSaved] = useState<SavedAddress[]>([]);
  const [saveAfter, setSaveAfter] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");

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
    setAddress({
      name: a.recipient, street: [a.line1, a.line2].filter(Boolean).join(", "),
      city: a.city, state: a.region || "", zip: a.postal_code || "", country: a.country,
    });
  };

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
    setLoading(true);
    if (saveAfter) {
      await supabase.from("addresses" as any).insert({
        user_id: user.id, label: addressLabel || null, recipient: address.name,
        line1: address.street, city: address.city, region: address.state || null,
        postal_code: address.zip || null, country: address.country, is_default: saved.length === 0,
      } as any);
    }
    const sellerGroups: Record<string, typeof items> = {};
    items.forEach(item => {
      if (!sellerGroups[item.seller_id]) sellerGroups[item.seller_id] = [];
      sellerGroups[item.seller_id].push(item);
    });
    try {
      for (const [sellerId, sellerItems] of Object.entries(sellerGroups)) {
        const orderTotal = sellerItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
        const { data: order, error: orderError } = await supabase
          .from("orders").insert({
            buyer_id: user.id, seller_id: sellerId, total_amount: orderTotal,
            shipping_address: address as any, status: "pending" as const,
          }).select("id").single();
        if (orderError) throw orderError;
        const orderItems = sellerItems.map(item => ({
          order_id: order.id, product_id: item.id, quantity: item.quantity,
          unit_price: item.price, total_price: item.price * item.quantity,
        }));
        const { error: itemsError } = await supabase.from("order_items").insert(orderItems);
        if (itemsError) throw itemsError;
      }
      clearCart();
      toast.success("Order placed successfully!");
      navigate(`/buyer/orders`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Empty cart state
  if (items.length === 0) {
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
          <Link to="/marketplace" className="mt-6">
            <button className="px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              Browse Products
            </button>
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
                  <label className={labelCls}>Full Name *</label>
                  <input className={inputCls} value={address.name} onChange={e => setAddress(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div>
                  <label className={labelCls}>Street Address *</label>
                  <input className={inputCls} value={address.street} onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>City *</label>
                    <input className={inputCls} value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} placeholder="New York" />
                  </div>
                  <div>
                    <label className={labelCls}>State</label>
                    <input className={inputCls} value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} placeholder="NY" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>ZIP Code</label>
                    <input className={inputCls} value={address.zip} onChange={e => setAddress(p => ({ ...p, zip: e.target.value }))} placeholder="10001" />
                  </div>
                  <div>
                    <label className={labelCls}>Country *</label>
                    <input className={inputCls} value={address.country} onChange={e => setAddress(p => ({ ...p, country: e.target.value }))} placeholder="United States" />
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
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-4">Order Summary</p>

              <div className="space-y-3 mb-4">
                {items.map(item => (
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
                      <p className="text-[10px] text-[#888880]">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] shrink-0">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>

              <div className="border-t border-[#F2F3F5] dark:border-[#1E1E1E] pt-3 space-y-2">
                <div className="flex justify-between text-xs text-[#888880]">
                  <span>Subtotal</span><span>{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#888880]">Shipping</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Free</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-[#111111] dark:text-[#FAF5F2] pt-2 border-t border-[#F2F3F5] dark:border-[#1E1E1E]">
                  <span>Total</span><span>{formatPrice(totalPrice)}</span>
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
                <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Secure checkout with escrow protection
              </p>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {[
                  { icon: Lock, label: "SSL Encrypted" },
                  { icon: ShieldCheck, label: "Buyer Protection" },
                  { icon: CreditCard, label: "PCI Compliant" },
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
