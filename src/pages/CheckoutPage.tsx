import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCart } from "@/hooks/useCart";
import { useCurrency } from "@/hooks/useCurrency";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { Package, ArrowLeft, ShoppingBag, CheckCircle2, Lock, ShieldCheck, CreditCard, BookmarkPlus } from "lucide-react";
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
      toast({ title: "Please sign in", description: "You need to be logged in to place an order.", variant: "destructive" });
      navigate("/auth/login");
      return;
    }

    if (!address.name || !address.street || !address.city || !address.country) {
      toast({ title: "Missing address", description: "Please fill in all required address fields.", variant: "destructive" });
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
      toast({ title: "Order placed!", description: "Your order has been placed successfully." });
      navigate(`/buyer/orders`);
    } catch (error: any) {
      toast({ title: "Order failed", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNavbar showSearch={false} />
        <CartDrawer />
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <ShoppingBag className="h-20 w-20 text-muted-foreground/30 mb-6" />
          <h2 className="font-display text-2xl font-bold text-foreground">Your cart is empty</h2>
          <p className="mt-2 text-muted-foreground">Add some products before checking out.</p>
          <Link to="/marketplace">
            <Button className="mt-6 bg-primary text-primary-foreground hover:bg-primary/90">Browse Products</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNavbar showSearch={false} />
      <CartDrawer />

      <div className="mx-auto max-w-4xl px-4 lg:px-8 py-8">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h1 className="font-display text-3xl font-bold text-foreground mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 space-y-6">
            <div className="rounded-xl border border-border p-6 bg-card">
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">Shipping Address</h2>

              {saved.length > 0 && (
                <div className="mb-5">
                  <Label>Saved Addresses</Label>
                  <Select onValueChange={(id) => { const a = saved.find(s => s.id === id); if (a) applySaved(a); }}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Choose a saved address" /></SelectTrigger>
                    <SelectContent>
                      {saved.map(a => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label || a.recipient} — {a.line1}, {a.city}{a.is_default ? " (Default)" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input id="name" value={address.name} onChange={e => setAddress(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div>
                  <Label htmlFor="street">Street Address *</Label>
                  <Input id="street" value={address.street} onChange={e => setAddress(p => ({ ...p, street: e.target.value }))} placeholder="123 Main St" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="city">City *</Label>
                    <Input id="city" value={address.city} onChange={e => setAddress(p => ({ ...p, city: e.target.value }))} placeholder="New York" />
                  </div>
                  <div>
                    <Label htmlFor="state">State</Label>
                    <Input id="state" value={address.state} onChange={e => setAddress(p => ({ ...p, state: e.target.value }))} placeholder="NY" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="zip">ZIP Code</Label>
                    <Input id="zip" value={address.zip} onChange={e => setAddress(p => ({ ...p, zip: e.target.value }))} placeholder="10001" />
                  </div>
                  <div>
                    <Label htmlFor="country">Country *</Label>
                    <Input id="country" value={address.country} onChange={e => setAddress(p => ({ ...p, country: e.target.value }))} placeholder="United States" />
                  </div>
                </div>
              </div>

              <div className="mt-5 space-y-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={saveAfter} onChange={e => setSaveAfter(e.target.checked)} className="h-4 w-4 rounded border-border" />
                  <BookmarkPlus className="h-4 w-4 text-primary" /> Save this address for future orders
                </label>
                {saveAfter && (
                  <Input value={addressLabel} onChange={e => setAddressLabel(e.target.value)} placeholder="Label (e.g. Home, Office)" className="mt-1" />
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="rounded-xl border border-border p-6 bg-card sticky top-20">
              <h2 className="font-display text-lg font-semibold text-foreground mb-4">Order Summary</h2>
              <div className="space-y-3 mb-4">
                {items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-lg bg-muted overflow-hidden shrink-0">
                      {item.image_url ? (
                        <img src={item.image_url} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-sm font-medium text-foreground">{formatPrice(item.price * item.quantity)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">{formatPrice(totalPrice)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-accent font-medium">Free</span>
                </div>
                <div className="flex justify-between font-display text-lg font-bold pt-2 border-t border-border">
                  <span>Total</span>
                  <span>{formatPrice(totalPrice)}</span>
                </div>
              </div>
              <Button onClick={handlePlaceOrder} disabled={loading} className="w-full mt-6 h-12 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-base">
                {loading ? "Placing Order..." : "Place Order"}
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-3 flex items-center justify-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-accent" /> Secure checkout with escrow protection
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
                <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 py-2">
                  <Lock className="h-4 w-4 text-primary" /><span>SSL Encrypted</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 py-2">
                  <ShieldCheck className="h-4 w-4 text-accent" /><span>Buyer Protection</span>
                </div>
                <div className="flex flex-col items-center gap-1 rounded-md border border-border/60 py-2">
                  <CreditCard className="h-4 w-4 text-primary" /><span>PCI Compliant</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
