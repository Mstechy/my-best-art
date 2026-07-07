import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Package, ArrowRight, Truck, Flag, X, Star } from "lucide-react";
import AnimatedSection from "@/components/AnimatedSection";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface OrderItem {
  id: string;
  product_id: string | null;
  quantity: number;
  unit_price: number;
  product_title: string;
  product_image: string | null;
}

interface Order {
  id: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  seller_id: string;
  seller_name: string;
  tracking_number: string | null;
  items: OrderItem[];
}

type Tab = "all" | "pending" | "processing" | "shipped" | "delivered" | "cancelled";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  shipped: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  delivered: "bg-accent/10 text-accent border-accent/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  disputed: "bg-destructive/10 text-destructive border-destructive/20",
};

export default function BuyerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());

  // Cancel modal
  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  // Review modal
  const [reviewItem, setReviewItem] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    const { data: ordersData } = await supabase
      .from("orders")
      .select("*")
      .eq("buyer_id", user.id)
      .order("created_at", { ascending: false });

    if (!ordersData) { setLoading(false); return; }

    const sellerIds = [...new Set(ordersData.map(o => o.seller_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", sellerIds);
    const sellerMap: Record<string, string> = {};
    profiles?.forEach(p => { sellerMap[p.user_id] = p.full_name || "Unknown Seller"; });

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase
      .from("order_items")
      .select("id, order_id, quantity, unit_price, product_id")
      .in("order_id", orderIds);

    const productIds = [...new Set((itemsData || []).filter(i => i.product_id).map(i => i.product_id!))];
    const productMap: Record<string, { title: string; image: string | null }> = {};
    if (productIds.length > 0) {
      const { data: products } = await supabase.from("products").select("id, title").in("id", productIds);
      const { data: images } = await supabase.from("product_images").select("product_id, image_url, is_primary").in("product_id", productIds);
      products?.forEach(p => {
        const img = images?.find(i => i.product_id === p.id && i.is_primary) || images?.find(i => i.product_id === p.id);
        productMap[p.id] = { title: p.title, image: img?.image_url || null };
      });
    }

    const itemsByOrder: Record<string, OrderItem[]> = {};
    itemsData?.forEach(item => {
      if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
      const product = item.product_id ? productMap[item.product_id] : null;
      itemsByOrder[item.order_id].push({
        id: item.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        product_title: product?.title || "Unknown Product",
        product_image: product?.image || null,
      });
    });

    const mapped: Order[] = ordersData.map(o => ({
      id: o.id,
      status: o.status,
      total_amount: o.total_amount,
      currency: o.currency,
      created_at: o.created_at,
      seller_id: o.seller_id,
      seller_name: sellerMap[o.seller_id] || "Unknown Seller",
      tracking_number: o.tracking_number,
      items: itemsByOrder[o.id] || [],
    }));

    setOrders(mapped);

    // Fetch existing reviews to gate Leave Review button
    const { data: reviews } = await supabase
      .from("reviews")
      .select("product_id")
      .eq("buyer_id", user.id);
    setReviewedProducts(new Set((reviews || []).map(r => r.product_id)));

    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    const channel = supabase
      .channel(`buyer-orders-${user.id}`)
      .on("postgres_changes",
        { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` },
        () => fetchOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const submitCancel = async () => {
    if (!cancelOrder || !user) return;
    if (cancelReason.trim().length < 3) {
      toast.error("Please choose or describe a reason");
      return;
    }
    setCancelLoading(true);
    const { error: cancelErr } = await supabase
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", cancelOrder.id)
      .eq("buyer_id", user.id);
    if (cancelErr) {
      toast.error(cancelErr.message);
      setCancelLoading(false);
      return;
    }
    await supabase.from("order_cancellations").insert({
      order_id: cancelOrder.id,
      buyer_id: user.id,
      reason: cancelReason.trim(),
      note: cancelNote.trim() || null,
    });
    toast.success("Order cancelled");
    setCancelOrder(null);
    setCancelReason("");
    setCancelNote("");
    setCancelLoading(false);
    fetchOrders();
  };

  const submitReview = async () => {
    if (!reviewItem || !user || !reviewItem.item.product_id) return;
    if (rating < 1 || rating > 5) {
      toast.error("Pick a rating");
      return;
    }
    if (reviewComment.trim().length < 10) {
      toast.error("Review must be at least 10 characters");
      return;
    }
    setReviewLoading(true);
    const { data: inserted, error } = await supabase.from("reviews").insert({
      buyer_id: user.id,
      seller_id: reviewItem.order.seller_id,
      product_id: reviewItem.item.product_id,
      order_id: reviewItem.order.id,
      rating,
      title: reviewTitle.trim() || null,
      comment: reviewComment.trim(),
      is_verified_purchase: true,
    }).select("id").single();
    if (error || !inserted) {
      setReviewLoading(false);
      toast.error(error?.message || "Could not save review");
      return;
    }
    for (let i = 0; i < reviewPhotos.slice(0, 3).length; i++) {
      const f = reviewPhotos[i];
      const ext = f.name.split(".").pop();
      const path = `${user.id}/${inserted.id}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, f);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        await (supabase as any).from("review_photos").insert({ review_id: inserted.id, url: urlData.publicUrl, position: i });
      }
    }
    setReviewLoading(false);
    toast.success("Review submitted");
    setReviewedProducts(prev => new Set(prev).add(reviewItem.item.product_id!));
    setReviewItem(null);
    setRating(5);
    setReviewTitle("");
    setReviewComment("");
    setReviewPhotos([]);
  };

  const filtered = orders.filter(o => {
    const matchesSearch = !search || o.id.includes(search) || o.tracking_number?.includes(search) || o.seller_name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || o.status === tab;
    return matchesSearch && matchesTab;
  });

  const tabs: Tab[] = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];

  const cancelReasons = ["Changed my mind", "Found a better price", "Ordered by mistake", "Shipping takes too long", "Other"];

  return (
    <div className="space-y-6">
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">My Orders</h1>
            <p className="mt-1 text-muted-foreground">View and track your purchases ({orders.length} total)</p>
          </div>
          <Link to="/marketplace"><Button className="gap-2 gradient-buyer text-primary-foreground"><Search className="h-4 w-4" /> Continue Shopping</Button></Link>
        </div>
      </AnimatedSection>

      {/* Persistent pending-review banner */}
      {(() => {
        const pending = orders.flatMap(o =>
          o.status === "delivered"
            ? o.items.filter(it => it.product_id && !reviewedProducts.has(it.product_id)).map(it => ({ order: o, item: it }))
            : []
        );
        if (pending.length === 0) return null;
        return (
          <AnimatedSection variant="fade-up" delay={30}>
            <div className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 p-4 flex items-start gap-3">
              <Star className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5 fill-yellow-500" />
              <div className="flex-1">
                <p className="font-medium text-foreground text-sm">
                  {pending.length} delivered order{pending.length > 1 ? "s" : ""} awaiting your review
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Help other buyers by rating the seller and the item you received.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pending.slice(0, 3).map(p => (
                    <Button key={p.item.id} size="sm" variant="outline" className="gap-1 h-8"
                      onClick={() => setReviewItem({ order: p.order, item: p.item })}>
                      <Star className="h-3 w-3" /> Rate "{p.item.product_title.slice(0, 24)}"
                    </Button>
                  ))}
                  {pending.length > 3 && (
                    <span className="text-xs text-muted-foreground self-center">+{pending.length - 3} more below</span>
                  )}
                </div>
              </div>
            </div>
          </AnimatedSection>
        );
      })()}

      <AnimatedSection variant="fade-up" delay={50}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by order ID, tracking number, or seller..." className="pl-10 h-11" />
        </div>
      </AnimatedSection>


      <AnimatedSection variant="fade-up" delay={80}>
        <div className="flex gap-1 overflow-x-auto pb-2">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-all capitalize ${tab === t ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >{t === "all" ? "All Orders" : t}</button>
          ))}
        </div>
      </AnimatedSection>

      <AnimatedSection variant="fade-up" delay={100}>
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading orders...</div>
        ) : filtered.length === 0 ? (
          <Card className="border-border/60">
            <CardContent className="py-16">
              <div className="flex flex-col items-center justify-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-muted mb-5">
                  <Package className="h-9 w-9 text-muted-foreground" />
                </div>
                <h3 className="font-display text-xl font-semibold text-foreground">No orders found</h3>
                <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                  {orders.length === 0 ? "When you purchase products, your orders will appear here." : "No orders match your filters."}
                </p>
                <Link to="/marketplace" className="mt-6"><Button className="gap-2 gradient-primary text-primary-foreground shadow-glow">Browse Marketplace <ArrowRight className="h-4 w-4" /></Button></Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map(order => (
              <Card key={order.id} className="border-border/60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-display font-semibold text-foreground text-sm">Order #{order.id.slice(0, 8)}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString()} · Seller: {order.seller_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-display font-bold text-foreground">${order.total_amount}</span>
                      <Badge className={statusColors[order.status] || ""}>{order.status}</Badge>
                    </div>
                  </div>

                  {order.items.length > 0 && (
                    <div className="border-t border-border/60 pt-3 space-y-2">
                      {order.items.map(item => (
                        <div key={item.id} className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-muted overflow-hidden shrink-0">
                            {item.product_image ? (
                              <img src={item.product_image} alt={item.product_title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex items-center justify-center h-full"><Package className="h-4 w-4 text-muted-foreground" /></div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{item.product_title}</p>
                            <p className="text-xs text-muted-foreground">Qty: {item.quantity} × ${item.unit_price}</p>
                          </div>
                          {order.status === "delivered" && item.product_id && (
                            reviewedProducts.has(item.product_id) ? (
                              <Badge variant="outline" className="text-xs gap-1"><Star className="h-3 w-3 fill-current" /> Reviewed</Badge>
                            ) : (
                              <Button size="sm" variant="outline" className="gap-1" onClick={() => setReviewItem({ order, item })}>
                                <Star className="h-3 w-3" /> Review
                              </Button>
                            )
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                    {order.status === "pending" && (
                      <Button variant="outline" size="sm" className="gap-1 text-destructive" onClick={() => setCancelOrder(order)}>
                        <X className="h-3 w-3" /> Cancel Order
                      </Button>
                    )}
                    {(order.status === "shipped" || order.tracking_number) && (
                      <Link to="/buyer/tracking">
                        <Button variant="outline" size="sm" className="gap-1">
                          <Truck className="h-3 w-3" /> Track
                        </Button>
                      </Link>
                    )}
                    <Link to="/buyer/reports">
                      <Button variant="outline" size="sm" className="gap-1 text-destructive">
                        <Flag className="h-3 w-3" /> Report Issue
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </AnimatedSection>

      {/* Cancel Order Dialog */}
      <Dialog open={!!cancelOrder} onOpenChange={(open) => { if (!open) setCancelOrder(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Order</DialogTitle>
            <DialogDescription>
              Cancelling order #{cancelOrder?.id.slice(0, 8)}. Tell us why so we can improve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {cancelReasons.map(r => (
                <button key={r} type="button"
                  onClick={() => setCancelReason(r)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${cancelReason === r ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
                  {r}
                </button>
              ))}
            </div>
            <Textarea placeholder="Add details (optional)" value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrder(null)} disabled={cancelLoading}>Keep Order</Button>
            <Button variant="destructive" onClick={submitCancel} disabled={cancelLoading}>
              {cancelLoading ? "Cancelling..." : "Confirm Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Leave Review Dialog */}
      <Dialog open={!!reviewItem} onOpenChange={(open) => { if (!open) setReviewItem(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review {reviewItem?.item.product_title}</DialogTitle>
            <DialogDescription>Share your experience. Reviews can only be left once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)}
                  className="p-1 transition-transform hover:scale-110">
                  <Star className={`h-7 w-7 ${n <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
            <Input placeholder="Headline (optional)" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} maxLength={80} />
            <Input placeholder="Headline (optional)" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} maxLength={80} />
            <Textarea placeholder="What did you think of this product?" value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={4} />
            <div>
              <label className="text-xs text-muted-foreground">Add up to 3 photos (optional)</label>
              <input type="file" accept="image/*" multiple
                onChange={e => setReviewPhotos(Array.from(e.target.files || []).slice(0, 3))}
                className="mt-1 block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted/80" />
              {reviewPhotos.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {reviewPhotos.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded-md object-cover border border-border" />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewItem(null)} disabled={reviewLoading}>Cancel</Button>
            <Button onClick={submitReview} disabled={reviewLoading} className="gradient-buyer text-primary-foreground">
              {reviewLoading ? "Submitting..." : "Submit Review"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
