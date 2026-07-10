import React, { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Search, Package, ArrowRight, Truck, Flag, X, Star, Loader2, ShoppingBag, CheckCircle2, Clock, XCircle } from "lucide-react";
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

const STATUS_STYLE: Record<string, { bg: string; text: string; label: string }> = {
  pending:    { bg: "bg-[#F6C75D]/15", text: "text-[#5C3A00] dark:text-[#F6C75D]", label: "Pending" },
  processing: { bg: "bg-blue-50 dark:bg-blue-900/20", text: "text-blue-600 dark:text-blue-400", label: "Processing" },
  shipped:    { bg: "bg-purple-50 dark:bg-purple-900/20", text: "text-purple-600 dark:text-purple-400", label: "Shipped" },
  delivered:  { bg: "bg-emerald-50 dark:bg-emerald-900/20", text: "text-emerald-600 dark:text-emerald-400", label: "Delivered" },
  cancelled:  { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-500 dark:text-red-400", label: "Cancelled" },
  disputed:   { bg: "bg-red-50 dark:bg-red-900/20", text: "text-red-500 dark:text-red-400", label: "Disputed" },
};

const STATUS_META: Record<string, { icon: React.ElementType; iconColor: string; label: string; desc: string }> = {
  pending:    { icon: Clock,        iconColor: "text-[#F6C75D]",                    label: "Awaiting Confirmation", desc: "Your order is waiting to be accepted by the seller." },
  processing: { icon: Package,      iconColor: "text-blue-500",                     label: "Being Prepared",        desc: "The seller is packing and preparing your order." },
  shipped:    { icon: Truck,        iconColor: "text-purple-500",                   label: "On Its Way",            desc: "Your order has been dispatched and is with the courier." },
  delivered:  { icon: CheckCircle2, iconColor: "text-emerald-500",                  label: "Delivered",             desc: "Your order has arrived. Enjoy your purchase!" },
  cancelled:  { icon: XCircle,      iconColor: "text-red-400",                      label: "Cancelled",             desc: "This order was cancelled and will not be fulfilled." },
  disputed:   { icon: Flag,         iconColor: "text-red-400",                      label: "Under Dispute",         desc: "A dispute has been raised for this order." },
};

export default function BuyerOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [reviewedProducts, setReviewedProducts] = useState<Set<string>>(new Set());

  const [cancelOrder, setCancelOrder] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelNote, setCancelNote] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);

  const [reviewItem, setReviewItem] = useState<{ order: Order; item: OrderItem } | null>(null);
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [reviewLoading, setReviewLoading] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    const { data: ordersData } = await supabase
      .from("orders").select("*").eq("buyer_id", user.id).order("created_at", { ascending: false });
    if (!ordersData) { setLoading(false); return; }

    const sellerIds = [...new Set(ordersData.map(o => o.seller_id))];
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", sellerIds);
    const sellerMap: Record<string, string> = {};
    profiles?.forEach(p => { sellerMap[p.user_id] = p.full_name || "Unknown Seller"; });

    const orderIds = ordersData.map(o => o.id);
    const { data: itemsData } = await supabase.from("order_items").select("id, order_id, quantity, unit_price, product_id").in("order_id", orderIds);

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
        id: item.id, product_id: item.product_id, quantity: item.quantity, unit_price: item.unit_price,
        product_title: product?.title || "Unknown Product", product_image: product?.image || null,
      });
    });

    setOrders(ordersData.map(o => ({
      id: o.id, status: o.status, total_amount: o.total_amount, currency: o.currency,
      created_at: o.created_at, seller_id: o.seller_id,
      seller_name: sellerMap[o.seller_id] || "Unknown Seller",
      tracking_number: o.tracking_number, items: itemsByOrder[o.id] || [],
    })));

    const { data: reviews } = await supabase.from("reviews").select("product_id").eq("buyer_id", user.id);
    setReviewedProducts(new Set((reviews || []).map(r => r.product_id)));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) return;
    fetchOrders();
    const channel = supabase.channel(`buyer-orders-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `buyer_id=eq.${user.id}` }, () => fetchOrders())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const submitCancel = async () => {
    if (!cancelOrder || !user) return;
    if (cancelReason.trim().length < 3) { toast.error("Please choose or describe a reason"); return; }
    setCancelLoading(true);
    const { error: cancelErr } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", cancelOrder.id).eq("buyer_id", user.id);
    if (cancelErr) { toast.error(cancelErr.message); setCancelLoading(false); return; }
    await supabase.from("order_cancellations").insert({ order_id: cancelOrder.id, buyer_id: user.id, reason: cancelReason.trim(), note: cancelNote.trim() || null });
    toast.success("Order cancelled");
    setCancelOrder(null); setCancelReason(""); setCancelNote(""); setCancelLoading(false);
    fetchOrders();
  };

  const submitReview = async () => {
    if (!reviewItem || !user || !reviewItem.item.product_id) return;
    if (rating < 1 || rating > 5) { toast.error("Pick a rating"); return; }
    if (reviewComment.trim().length < 10) { toast.error("Review must be at least 10 characters"); return; }
    setReviewLoading(true);
    const { data: inserted, error } = await supabase.from("reviews").insert({
      buyer_id: user.id, seller_id: reviewItem.order.seller_id, product_id: reviewItem.item.product_id,
      order_id: reviewItem.order.id, rating, title: reviewTitle.trim() || null, comment: reviewComment.trim(), is_verified_purchase: true,
    }).select("id").single();
    if (error || !inserted) { setReviewLoading(false); toast.error(error?.message || "Could not save review"); return; }
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
    setReviewItem(null); setRating(5); setReviewTitle(""); setReviewComment(""); setReviewPhotos([]);
  };

  const filtered = orders.filter(o => {
    const matchesSearch = !search || o.id.includes(search) || o.tracking_number?.includes(search) || o.seller_name.toLowerCase().includes(search.toLowerCase());
    const matchesTab = tab === "all" || o.status === tab;
    return matchesSearch && matchesTab;
  });

  const tabs: Tab[] = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];
  const cancelReasons = ["Changed my mind", "Found a better price", "Ordered by mistake", "Shipping takes too long", "Other"];

  return (
    <div className="space-y-6 max-w-[1280px]">

      {/* Header */}
      <AnimatedSection variant="fade-up">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#111111] dark:text-[#FAF5F2] tracking-tight">My Orders</h1>
            <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">
              {orders.length} order{orders.length !== 1 ? "s" : ""} total
            </p>
          </div>
          <Link to="/marketplace">
            <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors">
              <Search className="h-3.5 w-3.5" /> Continue Shopping
            </button>
          </Link>
        </div>
      </AnimatedSection>

      {/* Pending reviews banner */}
      {(() => {
        const pending = orders.flatMap(o =>
          o.status === "delivered"
            ? o.items.filter(it => it.product_id && !reviewedProducts.has(it.product_id)).map(it => ({ order: o, item: it }))
            : []
        );
        if (pending.length === 0) return null;
        return (
          <AnimatedSection variant="fade-up" delay={30}>
            <div className="rounded-2xl border border-[#F6C75D]/30 bg-[#F6C75D]/8 dark:bg-[#F6C75D]/5 p-4 flex items-start gap-3">
              <Star className="h-4 w-4 text-[#F6C75D] shrink-0 mt-0.5 fill-[#F6C75D]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">
                  {pending.length} delivered order{pending.length > 1 ? "s" : ""} awaiting your review
                </p>
                <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-0.5">Help other buyers by rating the products you received.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {pending.slice(0, 3).map(p => (
                    <button key={p.item.id}
                      onClick={() => setReviewItem({ order: p.order, item: p.item })}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1A1A1A] text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors"
                    >
                      <Star className="h-2.5 w-2.5" /> Rate "{p.item.product_title.slice(0, 24)}"
                    </button>
                  ))}
                  {pending.length > 3 && <span className="text-[10px] text-[#888880] self-center">+{pending.length - 3} more</span>}
                </div>
              </div>
            </div>
          </AnimatedSection>
        );
      })()}

      {/* Search */}
      <AnimatedSection variant="fade-up" delay={50}>
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#888880]" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by order ID, tracking number, or seller..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-white dark:bg-[#1A1A1A] text-[#111111] dark:text-[#FAF5F2] text-sm placeholder-[#C0C0B8] dark:placeholder-[#555555] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors"
          />
        </div>
      </AnimatedSection>

      {/* Tabs */}
      <AnimatedSection variant="fade-up" delay={80}>
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-[11px] font-semibold transition-all capitalize ${
                tab === t
                  ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                  : "text-[#888880] dark:text-[#A0A0A0] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
              }`}
            >{t === "all" ? "All Orders" : t}</button>
          ))}
        </div>
      </AnimatedSection>

      {/* Order list */}
      <AnimatedSection variant="fade-up" delay={100}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-[#888880]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] py-16">
            <div className="flex flex-col items-center justify-center text-center gap-3">
              <div className="h-14 w-14 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center">
                <Package className="h-6 w-6 text-[#888880] dark:text-[#A0A0A0]" />
              </div>
              <div>
                <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">No orders found</p>
                <p className="mt-1 text-xs text-[#888880] dark:text-[#A0A0A0]">
                  {orders.length === 0 ? "When you purchase products, your orders will appear here." : "No orders match your filters."}
                </p>
              </div>
              <Link to="/marketplace">
                <button className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] transition-colors">
                  Browse Marketplace <ArrowRight className="h-3 w-3" />
                </button>
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {filtered.map(order => {
              const s = STATUS_STYLE[order.status] ?? { bg: "bg-[#F2F3F5]", text: "text-[#888880]", label: order.status };
              const meta = STATUS_META[order.status] ?? { icon: Package, iconColor: "text-[#888880]", label: order.status, desc: "" };
              const StatusIcon = meta.icon;
              // Pick first item image as the card thumbnail
              const thumb = order.items.find(it => it.product_image)?.product_image ?? null;
              return (
                <div key={order.id} className="relative flex flex-col justify-between bg-white dark:bg-[#1A1A1A] rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 overflow-hidden min-h-[172px]">

                  {/* Status icon */}
                  <StatusIcon className={`h-6 w-6 mb-2 shrink-0 ${meta.iconColor}`} />

                  {/* Labels */}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] leading-snug">{meta.label}</p>
                    <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-1 leading-relaxed pr-10">{meta.desc}</p>
                  </div>

                  {/* Meta row */}
                  <p className="text-[9px] font-mono text-[#888880] dark:text-[#555555] mt-2">
                    #{order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString()}
                  </p>

                  {/* Action buttons + total */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mr-1">${order.total_amount}</span>

                    {order.status === "pending" && (
                      <button onClick={() => setCancelOrder(order)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-200 dark:border-red-900/40 text-[9px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <X className="h-2.5 w-2.5" /> Cancel
                      </button>
                    )}
                    {(order.status === "shipped" || order.tracking_number) && (
                      <Link to="/buyer/tracking">
                        <button className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[9px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors">
                          <Truck className="h-2.5 w-2.5" /> Track
                        </button>
                      </Link>
                    )}
                    {order.status === "delivered" && order.items.some(it => it.product_id && !reviewedProducts.has(it.product_id)) && (
                      <button onClick={() => { const it = order.items.find(it => it.product_id && !reviewedProducts.has(it.product_id!))!; setReviewItem({ order, item: it }); }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[9px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors">
                        <Star className="h-2.5 w-2.5" /> Review
                      </button>
                    )}
                    <Link to="/buyer/reports">
                      <button className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-[9px] font-semibold text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Flag className="h-2.5 w-2.5" /> Report
                      </button>
                    </Link>
                  </div>

                  {/* Product thumbnail — bottom-right decoration */}
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="absolute bottom-0 right-0 h-20 w-20 object-cover rounded-tl-2xl opacity-90"
                    />
                  ) : (
                    <div className="absolute bottom-2 right-2 h-14 w-14 rounded-2xl bg-[#F2F3F5] dark:bg-[#111111] flex items-center justify-center opacity-60">
                      <ShoppingBag className="h-6 w-6 text-[#C0C0B8] dark:text-[#333333]" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AnimatedSection>

      {/* Cancel Dialog */}
      <Dialog open={!!cancelOrder} onOpenChange={(open) => { if (!open) setCancelOrder(null); }}>
        <DialogContent className="bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#222222] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Cancel Order</DialogTitle>
            <DialogDescription className="text-xs text-[#888880] dark:text-[#A0A0A0]">
              Cancelling order #{cancelOrder?.id.slice(0, 8)}. Tell us why so we can improve.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {cancelReasons.map(r => (
                <button key={r} type="button" onClick={() => setCancelReason(r)}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold transition-colors ${
                    cancelReason === r
                      ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-[#111111] dark:border-[#FAF5F2]"
                      : "border-[#E8E8E8] dark:border-[#222222] text-[#888880] dark:text-[#A0A0A0] hover:bg-[#F2F3F5] dark:hover:bg-[#111111]"
                  }`}>{r}</button>
              ))}
            </div>
            <Textarea placeholder="Add details (optional)" value={cancelNote} onChange={e => setCancelNote(e.target.value)} rows={3}
              className="rounded-xl border-[#E8E8E8] dark:border-[#222222] bg-[#FAFAFA] dark:bg-[#111111] text-xs" />
          </div>
          <DialogFooter>
            <button onClick={() => setCancelOrder(null)} disabled={cancelLoading}
              className="px-4 py-2 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors">
              Keep Order
            </button>
            <button onClick={submitCancel} disabled={cancelLoading}
              className="px-4 py-2 rounded-full bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition-colors disabled:opacity-50">
              {cancelLoading ? "Cancelling..." : "Confirm Cancel"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Review Dialog */}
      <Dialog open={!!reviewItem} onOpenChange={(open) => { if (!open) setReviewItem(null); }}>
        <DialogContent className="bg-white dark:bg-[#1A1A1A] border-[#E8E8E8] dark:border-[#222222] rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">Review {reviewItem?.item.product_title}</DialogTitle>
            <DialogDescription className="text-xs text-[#888880] dark:text-[#A0A0A0]">Share your experience. Reviews can only be left once.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-1">
              {[1,2,3,4,5].map(n => (
                <button key={n} type="button" onClick={() => setRating(n)} className="p-1 transition-transform hover:scale-110">
                  <Star className={`h-6 w-6 ${n <= rating ? "fill-[#F6C75D] text-[#F6C75D]" : "text-[#E8E8E8] dark:text-[#2A2A2A]"}`} />
                </button>
              ))}
            </div>
            <input placeholder="Headline (optional)" value={reviewTitle} onChange={e => setReviewTitle(e.target.value)} maxLength={80}
              className="w-full h-10 px-4 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs text-[#111111] dark:text-[#FAF5F2] outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors" />
            <Textarea placeholder="What did you think of this product?" value={reviewComment} onChange={e => setReviewComment(e.target.value)} rows={4}
              className="rounded-xl border-[#E8E8E8] dark:border-[#222222] bg-[#FAFAFA] dark:bg-[#111111] text-xs" />
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-[#888880] dark:text-[#A0A0A0]">Add up to 3 photos (optional)</label>
              <input type="file" accept="image/*" multiple onChange={e => setReviewPhotos(Array.from(e.target.files || []).slice(0, 3))}
                className="mt-1 block w-full text-xs text-[#888880] file:mr-3 file:rounded-full file:border-0 file:bg-[#111111] file:dark:bg-[#FAF5F2] file:px-3 file:py-1.5 file:text-[10px] file:font-semibold file:text-white file:dark:text-[#111111] hover:file:opacity-80" />
              {reviewPhotos.length > 0 && (
                <div className="mt-2 flex gap-2">
                  {reviewPhotos.map((f, i) => (
                    <img key={i} src={URL.createObjectURL(f)} alt="" className="h-12 w-12 rounded-xl object-cover border border-[#E8E8E8] dark:border-[#222222]" />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <button onClick={() => setReviewItem(null)} disabled={reviewLoading}
              className="px-4 py-2 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#111111] transition-colors">
              Cancel
            </button>
            <button onClick={submitReview} disabled={reviewLoading}
              className="px-4 py-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-semibold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50">
              {reviewLoading ? "Submitting..." : "Submit Review"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
