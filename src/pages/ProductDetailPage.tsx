import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, CheckCircle2, Package, ShoppingCart, Heart, Truck, Shield, Info, Star, MessageSquare, Send, Tag, FileText, ImagePlus, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { useToast } from "@/hooks/use-toast";
import CopyLinkButton from "@/components/CopyLinkButton";
import MakeOfferDialog from "@/components/MakeOfferDialog";
import RecentlyViewed from "@/components/RecentlyViewed";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import ProductGuarantee from "@/components/product/ProductGuarantee";
import SellerMiniCard from "@/components/product/SellerMiniCard";
import ReviewSummary from "@/components/product/ReviewSummary";
import ReviewCard, { type ReviewData } from "@/components/product/ReviewCard";
import QAndASection from "@/components/product/QAndASection";
import RecommendedProducts from "@/components/product/RecommendedProducts";
import { deliveryEstimateRange, formatWarranty, isLikelyTestData, isLikelyTestFeature } from "@/lib/productContent";

interface Product {
  id: string;
  title: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  stock_quantity: number;
  seller_id: string;
  category_id: string | null;
  brand: string | null;
  weight: string | null;
  dimensions: string | null;
  material: string | null;
  color: string | null;
  condition: string | null;
  warranty: string | null;
  warranty_period: string | null;
  shipping_info: string | null;
  key_features: string[] | null;
  tags: string[] | null;
  average_rating: number;
  review_count: number;
  show_sold_count: boolean | null;
  variants: { sizes?: string[]; colors?: string[] } | null;
  product_images: { id: string; image_url: string; is_primary: boolean }[];
}

interface ProductDoc { id: string; url: string; label: string | null; }

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { toast } = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<{ full_name: string | null; is_verified: boolean; user_id: string } | null>(null);
  const [category, setCategory] = useState<{ name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const { add: addRecent } = useRecentlyViewed();

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => setSelectedImage(carouselApi.selectedScrollSnap());
    carouselApi.on("select", onSelect);
    onSelect();
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  useEffect(() => {
    if (carouselApi && carouselApi.selectedScrollSnap() !== selectedImage) {
      carouselApi.scrollTo(selectedImage);
    }
  }, [selectedImage, carouselApi]);

  // Reviews state
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotoFiles, setReviewPhotoFiles] = useState<File[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [canReview, setCanReview] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [keywords, setKeywords] = useState<{ keyword: string; count: number }[]>([]);
  const [soldCount, setSoldCount] = useState(0);
  const [sellerFollowers, setSellerFollowers] = useState(0);
  const [sellerAvgRating, setSellerAvgRating] = useState(0);
  const [sellerTotalSold, setSellerTotalSold] = useState(0);
  const [sellerAvatar, setSellerAvatar] = useState<string | null>(null);
  const [productDocs, setProductDocs] = useState<ProductDoc[]>([]);
  const overviewRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "description" | "recommended">("overview");

  useEffect(() => {
    if (!id) return;
    const fetchProduct = async () => {
      const { data, error } = await supabase.from("products").select("*, product_images(*)").eq("id", id).single();
      if (error || !data) { setLoading(false); return; }
      setProduct(data as unknown as Product);
      const [sellerRes, catRes, soldRes, docsRes] = await Promise.all([
        supabase.from("seller_profiles_public" as any).select("user_id, full_name, is_verified, avatar_url").eq("user_id", data.seller_id).single(),
        data.category_id ? supabase.from("categories").select("name").eq("id", data.category_id).single() : Promise.resolve({ data: null }),
        (supabase as any).rpc("product_sold_count", { _product_id: id }),
        (supabase as any).from("product_documents").select("*").eq("product_id", id),
      ]);
      if (sellerRes.data) {
        setSeller({ user_id: sellerRes.data.user_id, full_name: sellerRes.data.full_name, is_verified: sellerRes.data.is_verified });
        setSellerAvatar((sellerRes.data as any).avatar_url || null);
      }
      if (catRes.data) setCategory(catRes.data);
      setSoldCount(Number(soldRes.data || 0));
      setProductDocs((docsRes.data as any) || []);

      // seller-level stats
      const [{ count: followerCount }, sellerProducts] = await Promise.all([
        (supabase as any).from("store_follows").select("id", { count: "exact", head: true }).eq("seller_id", data.seller_id),
        supabase.from("products").select("id, average_rating, review_count").eq("seller_id", data.seller_id),
      ]);
      setSellerFollowers(followerCount || 0);
      const prods = (sellerProducts.data as any[]) || [];
      const totalReviews = prods.reduce((s, p) => s + (p.review_count || 0), 0);
      const weighted = prods.reduce((s, p) => s + (p.average_rating || 0) * (p.review_count || 0), 0);
      setSellerAvgRating(totalReviews > 0 ? weighted / totalReviews : 0);
      // aggregate seller sold count
      const pIds = prods.map(p => p.id);
      if (pIds.length > 0) {
        const { data: soldItems } = await supabase
          .from("order_items")
          .select("quantity, orders!inner(status)")
          .in("product_id", pIds)
          .eq("orders.status", "delivered");
        setSellerTotalSold((soldItems || []).reduce((s: number, r: any) => s + (r.quantity || 0), 0));
      }
      setLoading(false);
    };
    fetchProduct();
    fetchReviews();
    fetchKeywords();
    checkCanReview();
    if (id) {
      addRecent(id);
      supabase.from("product_views").insert({ product_id: id, viewer_id: null } as any).then(() => {});
    }
  }, [id, user?.id]);


  const fetchKeywords = async () => {
    if (!id) return;
    const { data } = await (supabase as any).rpc("product_review_keywords", { _product_id: id });
    setKeywords((data as any[]) || []);
  };

  const checkCanReview = async () => {
    if (!id || !user) { setCanReview(false); return; }
    const { data: items } = await supabase.from("order_items").select("order_id").eq("product_id", id);
    const oids = [...new Set((items || []).map((i: any) => i.order_id).filter(Boolean))];
    if (oids.length === 0) { setCanReview(false); return; }
    const { data: delivered } = await supabase
      .from("orders").select("id").eq("buyer_id", user.id).eq("status", "delivered").in("id", oids).limit(1).maybeSingle();
    setCanReview(!!delivered);
    const { data: existing } = await (supabase as any)
      .from("reviews").select("id").eq("product_id", id).eq("buyer_id", user.id).limit(1).maybeSingle();
    setAlreadyReviewed(!!existing);
  };

  const fetchReviews = async () => {
    if (!id) return;
    const { data } = await (supabase as any)
      .from("reviews")
      .select("*")
      .eq("product_id", id)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });
    if (!data) return;
    const list = data as any[];
    const buyerIds = [...new Set(list.map(r => r.buyer_id))];
    const reviewIds = list.map(r => r.id);
    const [{ data: profiles }, { data: photos }, { data: replies }, { data: pins }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, country").in("user_id", buyerIds),
      (supabase as any).from("review_photos").select("*").in("review_id", reviewIds),
      (supabase as any).from("review_replies").select("*").in("review_id", reviewIds),
      (supabase as any).from("review_pins").select("review_id").in("review_id", reviewIds),
    ]);
    const nameMap: Record<string, { name: string; country: string | null }> = {};
    (profiles || []).forEach((p: any) => { nameMap[p.user_id] = { name: p.full_name || "Buyer", country: p.country || null }; });
    const photoMap: Record<string, { url: string }[]> = {};
    (photos || []).forEach((p: any) => { (photoMap[p.review_id] ||= []).push({ url: p.url }); });
    const replyMap: Record<string, string> = {};
    (replies || []).forEach((r: any) => { replyMap[r.review_id] = r.body; });
    const pinSet = new Set((pins || []).map((p: any) => p.review_id));

    const mapped: ReviewData[] = list.map(r => ({
      id: r.id,
      buyer_id: r.buyer_id,
      reviewer_name: nameMap[r.buyer_id]?.name || "Buyer",
      buyer_country: nameMap[r.buyer_id]?.country || null,
      rating: r.rating,
      title: r.title,
      comment: r.comment,
      is_verified_purchase: r.is_verified_purchase,
      created_at: r.created_at,
      photos: photoMap[r.id] || [],
      seller_reply: replyMap[r.id] || null,
      pinned: pinSet.has(r.id),
    }));
    // sort so pinned reviews float to top
    mapped.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    setReviews(mapped);
  };

  const submitReview = async () => {
    if (!user || !id || !product) return;
    if (reviewComment.trim().length < 20) {
      toast({ title: "Review too short", description: "Please write at least 20 characters.", variant: "destructive" });
      return;
    }
    setSubmittingReview(true);
    const { data: orderItems } = await supabase.from("order_items").select("order_id").eq("product_id", id);
    const orderIds = [...new Set(orderItems?.map(item => item.order_id).filter(Boolean) ?? [])];
    const { data: deliveredOrder } = orderIds.length > 0 ? await supabase
      .from("orders").select("id").eq("buyer_id", user.id).eq("seller_id", product.seller_id)
      .eq("status", "delivered").in("id", orderIds).limit(1).maybeSingle() : { data: null };
    if (!deliveredOrder) {
      toast({ title: "Review unavailable", description: "Only buyers with a delivered order can review this product.", variant: "destructive" });
      setSubmittingReview(false);
      return;
    }
    const { data: inserted, error } = await (supabase as any).from("reviews").insert({
      product_id: id,
      buyer_id: user.id,
      seller_id: product.seller_id,
      order_id: deliveredOrder.id,
      rating: reviewRating,
      title: reviewTitle.trim() || null,
      comment: reviewComment.trim(),
      is_verified_purchase: true,
    }).select("id").single();
    if (error || !inserted) {
      toast({ title: "Error", description: error?.message || "Could not save review", variant: "destructive" });
      setSubmittingReview(false);
      return;
    }
    // Upload photos
    for (let i = 0; i < reviewPhotoFiles.slice(0, 3).length; i++) {
      const file = reviewPhotoFiles[i];
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${inserted.id}/${Date.now()}_${i}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file);
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("product-images").getPublicUrl(path);
        await (supabase as any).from("review_photos").insert({ review_id: inserted.id, url: urlData.publicUrl, position: i });
      }
    }
    toast({ title: "Review submitted ✓" });
    setReviewComment(""); setReviewTitle(""); setReviewRating(5); setReviewPhotoFiles([]);
    setAlreadyReviewed(true);
    fetchReviews(); fetchKeywords();
    setSubmittingReview(false);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (user?.id === product.seller_id) {
      toast({ title: "Can't buy your own listing", description: "Sellers cannot purchase their own products.", variant: "destructive" });
      return;
    }
    const sizes = product.variants?.sizes || [];
    const colors = product.variants?.colors || [];
    if (sizes.length > 0 && !selectedSize) { toast({ title: "Pick a size first", variant: "destructive" }); return; }
    if (colors.length > 0 && !selectedColor) { toast({ title: "Pick a color first", variant: "destructive" }); return; }
    const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
    const variantSuffix = [selectedSize, selectedColor].filter(Boolean).join("/");
    const cartId = variantSuffix ? `${product.id}::${variantSuffix}` : product.id;
    const titleSuffix = variantSuffix ? ` (${variantSuffix})` : "";
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: cartId,
        title: product.title + titleSuffix,
        price: product.price,
        image_url: primaryImage?.image_url || null,
        seller_id: product.seller_id,
        seller_name: seller?.full_name || "Seller",
        stock_quantity: product.stock_quantity,
      });
    }
  };

  const handleChatWithSeller = () => {
    if (!product) return;
    const sellerId = seller?.user_id ?? product.seller_id;
    if (!user) {
      const redirect = encodeURIComponent(`/product/${product.id}?action=chat`);
      navigate(`/auth/login?redirect=${redirect}`);
      return;
    }
    if (user.id === sellerId) {
      toast({ title: "This is your listing", description: "You can't message yourself." });
      return;
    }
    navigate(`/buyer/chat?seller=${sellerId}&product=${product.id}`);
  };

  // Auto-open chat after login redirect (?action=chat)
  useEffect(() => {
    if (!product || !user) return;
    const sellerId = seller?.user_id ?? product.seller_id;
    const url = new URL(window.location.href);
    if (url.searchParams.get("action") === "chat" && user.id !== sellerId) {
      navigate(`/buyer/chat?seller=${sellerId}&product=${product.id}`, { replace: true });
    }
  }, [product, seller, user]);

  const handleSendOffer = async (offerPrice: number, note: string, attachmentUrl?: string | null) => {
    if (!user || !seller || !product) {
      toast({ title: "Sign in required", description: "Please sign in to send an offer.", variant: "destructive" });
      return;
    }
    const baseNote = note || `I'd like to offer $${offerPrice.toFixed(2)} for this item. Would you accept?`;
    const attachmentMarker = attachmentUrl ? ` [attachment:${attachmentUrl}]` : "";
    const text = `${baseNote} [product:${product.id}] [offer:${offerPrice}]${attachmentMarker}`;
    const { error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: seller.user_id,
      content: text,
    });
    if (error) {
      toast({ title: "Couldn't send offer", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Offer sent!", description: "The seller has been notified." });
    navigate(`/buyer/chat?seller=${seller.user_id}`);
  };

  const avgRating = product?.average_rating ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <MarketplaceNavbar showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="aspect-square rounded-xl bg-muted animate-pulse" />
            <div className="space-y-4">
              <div className="h-6 bg-muted rounded w-1/4 animate-pulse" />
              <div className="h-8 bg-muted rounded w-3/4 animate-pulse" />
              <div className="h-10 bg-muted rounded w-1/3 animate-pulse" />
              <div className="h-20 bg-muted rounded animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Package className="h-16 w-16 text-muted-foreground" />
      <h2 className="font-display text-2xl font-bold text-foreground">Product not found</h2>
      <Link to="/marketplace"><Button variant="outline">Back to Marketplace</Button></Link>
    </div>
  );

  const images = product.product_images || [];
  

  const specs: { label: string; value: string }[] = [];
  if (product.brand) specs.push({ label: "Brand", value: product.brand });
  if (product.material) specs.push({ label: "Material", value: product.material });
  if (product.color) specs.push({ label: "Color", value: product.color });
  if (product.weight) specs.push({ label: "Weight", value: product.weight });
  if (product.dimensions) specs.push({ label: "Dimensions", value: product.dimensions });
  if (product.condition) specs.push({ label: "Condition", value: product.condition.charAt(0).toUpperCase() + product.condition.slice(1) });

  // Parse color variants for display
  const colorVariants = product.color?.split(",").map(c => c.trim()).filter(Boolean) || [];

  const warrantyDisplay = formatWarranty(product.warranty_period || product.warranty);
  const shipInfoValid = product.shipping_info && !isLikelyTestData(product.shipping_info);
  const shipInfoDisplay = shipInfoValid ? product.shipping_info : "Ships within 3-5 business days";
  const descriptionValid = product.description && !isLikelyTestData(product.description);
  const validFeatures = (product.key_features || []).filter(f => !isLikelyTestFeature(f));
  const showSold = product.show_sold_count !== false && soldCount > 0;
  const soldLabel = soldCount >= 100 ? `${Math.floor(soldCount / 100) * 100}+ sold` : `${soldCount} sold`;
  const deliveryRange = deliveryEstimateRange();
  const positive = reviews.filter(r => r.rating >= 5).length;
  const neutral = reviews.filter(r => r.rating >= 3 && r.rating <= 4).length;
  const negative = reviews.filter(r => r.rating <= 2).length;
  const photoCount = reviews.filter(r => r.photos && r.photos.length > 0).length;
  const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach(r => { starCounts[r.rating] = (starCounts[r.rating] || 0) + 1; });
  const allVerified = reviews.length > 0 && reviews.every(r => r.is_verified_purchase);
  const visibleReviews = reviews.filter(r => {
    if (reviewFilter === "all") return true;
    if (reviewFilter === "photos") return (r.photos?.length || 0) > 0;
    return r.rating === Number(reviewFilter);
  });

  const scrollTo = (ref: React.RefObject<HTMLDivElement>, tab: typeof activeTab) => {
    setActiveTab(tab);
    if (ref.current) {
      const y = ref.current.getBoundingClientRect().top + window.scrollY - 120;
      window.scrollTo({ top: y, behavior: "smooth" });
    }
  };

  const tabs: { key: typeof activeTab; label: string; ref: React.RefObject<HTMLDivElement> }[] = [
    { key: "overview", label: "Overview", ref: overviewRef },
    { key: "reviews", label: `Reviews${reviews.length ? ` (${reviews.length})` : ""}`, ref: reviewsRef },
    { key: "description", label: "Description", ref: descriptionRef },
    { key: "recommended", label: "Recommended", ref: recommendedRef },
  ];

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNavbar showSearch={false} />
      <CartDrawer />

      <div className="mx-auto max-w-6xl px-4 lg:px-8 py-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        {/* Sticky Tabs */}
        <div className="sticky top-16 z-30 -mx-4 lg:-mx-8 px-4 lg:px-8 bg-background/95 backdrop-blur border-b border-border/60 mb-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(t => (
              <button
                key={t.key}
                onClick={() => scrollTo(t.ref, t.key)}
                className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div ref={overviewRef} className="grid lg:grid-cols-2 gap-8">
          {/* Images */}
          <div>
            <div className="rounded-xl bg-muted overflow-hidden border border-border/60">
              {images.length === 0 ? (
                <div className="aspect-square flex items-center justify-center"><Package className="h-16 w-16 text-muted-foreground/30" /></div>
              ) : (
                <Carousel setApi={setCarouselApi} opts={{ loop: images.length > 1 }} className="relative">
                  <CarouselContent>
                    {images.map(img => (
                      <CarouselItem key={img.id}>
                        <div className="aspect-square">
                          <img src={img.image_url} alt={product.title} className="w-full h-full object-cover" />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {images.length > 1 && (
                    <>
                      <CarouselPrevious className="left-3" />
                      <CarouselNext className="right-3" />
                    </>
                  )}
                </Carousel>
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 overflow-x-auto">
                {images.map((img, i) => (
                  <button key={img.id} onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all shrink-0 ${i === selectedImage ? "border-primary" : "border-border/60"}`}>
                    <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details */}
          <div className="space-y-5">
            {category && <Badge variant="secondary">{category.name}</Badge>}
            <h1 className="font-display text-3xl font-bold text-foreground">{product.title}</h1>

            {product.brand && (
              <p className="text-sm text-muted-foreground">by <span className="text-foreground font-medium">{product.brand}</span></p>
            )}

            {/* Sold + rating strip */}
            {(reviews.length > 0 || showSold) && (
              <div className="flex items-center gap-2 flex-wrap text-sm">
                {reviews.length > 0 && (
                  <>
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-4 w-4 fill-yellow-500 text-yellow-500" />
                      <span className="font-semibold text-foreground">{avgRating.toFixed(1)}</span>
                    </span>
                    <span className="text-muted-foreground">·</span>
                    <button onClick={() => scrollTo(reviewsRef, "reviews")} className="text-muted-foreground hover:text-primary">
                      {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                    </button>
                  </>
                )}
                {showSold && (
                  <>
                    {reviews.length > 0 && <span className="text-muted-foreground">·</span>}
                    <span className="text-muted-foreground">{soldLabel}</span>
                  </>
                )}
              </div>
            )}

            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl font-bold text-foreground">${product.price}</span>
              {product.compare_at_price && product.compare_at_price > product.price && (
                <>
                  <span className="text-xl text-muted-foreground line-through">${product.compare_at_price}</span>
                  <Badge className="bg-destructive text-destructive-foreground">Save {Math.round((1 - product.price / product.compare_at_price) * 100)}%</Badge>
                </>
              )}
            </div>

            {/* Delivery estimate */}
            <div className="flex items-center gap-2 text-sm text-foreground/80">
              <Truck className="h-4 w-4 text-accent" />
              <span className="font-medium">Free Shipping</span>
              <span className="text-muted-foreground">· Est. delivery: {deliveryRange}</span>
            </div>

            {descriptionValid && (
              <p className="text-muted-foreground leading-relaxed line-clamp-4">{product.description}</p>
            )}

            {/* Size variants */}
            {product.variants?.sizes && product.variants.sizes.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Size <span className="text-destructive">*</span></h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.sizes.map((s) => (
                    <button key={s} onClick={() => setSelectedSize(s)}
                      className={`min-w-12 h-10 px-3 rounded-md border text-sm font-medium transition-colors ${selectedSize === s ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color variants */}
            {product.variants?.colors && product.variants.colors.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Color <span className="text-destructive">*</span></h3>
                <div className="flex flex-wrap gap-2">
                  {product.variants.colors.map((c) => (
                    <button key={c} onClick={() => setSelectedColor(c)}
                      className={`px-3 h-10 rounded-md border text-sm font-medium transition-colors ${selectedColor === c ? "border-primary bg-primary text-primary-foreground" : "border-border hover:bg-muted"}`}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(!product.variants?.colors || product.variants.colors.length === 0) && colorVariants.length > 1 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Available Colors</h3>
                <div className="flex flex-wrap gap-2">
                  {colorVariants.map((c) => (
                    <Badge key={c} variant="outline" className="px-3 py-1.5 text-xs font-medium cursor-default">{c}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Key Features (validated) */}
            {validFeatures.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Key Features</h3>
                <ul className="space-y-1">
                  {validFeatures.map((feat, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="text-sm">
              {product.stock_quantity > 0 ? (
                <span className="text-accent font-medium">✓ In Stock ({product.stock_quantity} available)</span>
              ) : (
                <span className="text-destructive font-medium">Out of Stock</span>
              )}
            </div>

            {product.stock_quantity > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground">Quantity:</span>
                <div className="flex items-center border border-border rounded-lg">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">−</button>
                  <span className="px-4 py-2 font-medium text-foreground border-x border-border min-w-[3rem] text-center">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))} className="px-3 py-2 text-muted-foreground hover:text-foreground transition-colors">+</button>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button onClick={handleAddToCart} disabled={product.stock_quantity === 0 || user?.id === product.seller_id}
                className="flex-1 gap-2 bg-primary text-primary-foreground hover:bg-primary/90 h-12 font-semibold">
                <ShoppingCart className="h-5 w-5" /> {user?.id === product.seller_id ? "Your listing" : "Add to Cart"}
              </Button>
              {user && user.id !== product.seller_id && (
                <Button variant="outline" className="h-12 px-4" onClick={() => toggleWishlist(product.id)}>
                  <Heart className={`h-5 w-5 ${isWishlisted(product.id) ? "fill-destructive text-destructive" : ""}`} />
                </Button>
              )}
            </div>

            {user?.id !== product.seller_id && (
              <Button onClick={handleChatWithSeller}
                className="w-full h-12 gap-2 min-h-[44px] bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-glow">
                <MessageSquare className="h-5 w-5" /> Chat with Seller
                {!user && <span className="text-xs opacity-80">(sign in)</span>}
              </Button>
            )}
            {user?.id === product.seller_id && (
              <div className="w-full h-12 rounded-md border border-border flex items-center justify-center text-sm text-muted-foreground">
                This is your listing
              </div>
            )}

            <Link to="/checkout">
              <Button variant="outline" className="w-full h-12 font-semibold" onClick={handleAddToCart} disabled={product.stock_quantity === 0}>
                Buy Now
              </Button>
            </Link>

            {user && user.id !== product.seller_id && (
              <Button variant="outline" className="w-full h-11 gap-2 min-h-[44px]" onClick={() => setOfferOpen(true)}>
                <Tag className="h-4 w-4" /> Make Offer
              </Button>
            )}
            <CopyLinkButton className="w-full h-11 min-h-[44px]" label="Copy Product Link" />
            {product && (
              <MakeOfferDialog
                open={offerOpen}
                onOpenChange={setOfferOpen}
                productId={product.id}
                productTitle={product.title}
                productPrice={Number(product.price)}
                onSent={(sellerId) => navigate(`/buyer/chat?seller=${sellerId}&product=${product.id}`)}
              />
            )}

            {/* MarketHub Guarantee */}
            <ProductGuarantee />

            {/* Seller mini card */}
            {seller && (
              <SellerMiniCard
                sellerId={seller.user_id}
                name={seller.full_name}
                avatarUrl={sellerAvatar}
                isVerified={seller.is_verified}
                rating={sellerAvgRating}
                soldCount={sellerTotalSold}
                followers={sellerFollowers}
              />
            )}
          </div>
        </div>

        {/* Description tab section */}
        <div ref={descriptionRef} className="mt-12 scroll-mt-32">
          <h2 className="font-display text-2xl font-bold text-foreground mb-4 flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" /> Description
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            {specs.length > 0 && (
              <div className="rounded-xl border border-border p-6 bg-card">
                <h3 className="font-display text-lg font-semibold text-foreground mb-4">Specifications</h3>
                <div className="divide-y divide-border">
                  {specs.map(({ label, value }) => (
                    <div key={label} className="flex justify-between py-3 text-sm">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-medium text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-6">
              {descriptionValid && (
                <div className="rounded-xl border border-border p-6 bg-card">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2">About this product</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{product.description}</p>
                </div>
              )}
              {warrantyDisplay && (
                <div className="rounded-xl border border-border p-6 bg-card">
                  <h3 className="font-display text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Warranty
                  </h3>
                  <p className="text-sm text-muted-foreground">{warrantyDisplay}</p>
                </div>
              )}
              <div className="rounded-xl border border-border p-6 bg-card">
                <h3 className="font-display text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Truck className="h-4 w-4 text-primary" /> Shipping Information
                </h3>
                <p className="text-sm text-muted-foreground">{shipInfoDisplay}</p>
              </div>
              {productDocs.length > 0 && (
                <details className="rounded-xl border border-border bg-card">
                  <summary className="p-4 cursor-pointer text-sm font-semibold text-foreground flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" /> Item Guides & Documents ({productDocs.length})
                  </summary>
                  <ul className="p-4 pt-0 space-y-2">
                    {productDocs.map(d => (
                      <li key={d.id}>
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                          <FileText className="h-3.5 w-3.5" /> {d.label || "User Manual (PDF)"}
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {product.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div ref={reviewsRef} className="mt-12 scroll-mt-32">
          <h2 className="font-display text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" /> Customer Reviews
            {reviews.length > 0 && <span className="text-base font-normal text-muted-foreground">({reviews.length})</span>}
          </h2>

          {reviews.length > 0 && (
            <div className="mb-6">
              <ReviewSummary
                average={avgRating}
                total={reviews.length}
                positive={positive}
                neutral={neutral}
                negative={negative}
                keywords={keywords}
                activeFilter={reviewFilter}
                onFilterChange={setReviewFilter}
                photoCount={photoCount}
                starCounts={starCounts}
                allVerified={allVerified}
              />
            </div>
          )}

          {/* Write a review — only for eligible buyers */}
          {user && canReview && !alreadyReviewed && (
            <div className="rounded-xl border border-border p-5 mb-6 bg-card">
              <h3 className="font-display font-semibold text-foreground mb-3">Write a Review</h3>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setReviewRating(s)} className="p-0.5">
                    <Star className={`h-6 w-6 transition-colors ${s <= (hoverRating || reviewRating) ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
                <span className="text-sm text-muted-foreground ml-2">{reviewRating}/5</span>
              </div>
              <input
                value={reviewTitle}
                onChange={e => setReviewTitle(e.target.value)}
                placeholder="Review title (optional)"
                className="w-full mb-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              <Textarea value={reviewComment} onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your experience (min 20 characters)…" rows={3} className="mb-3" />
              {reviewPhotoFiles.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {reviewPhotoFiles.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(f)} alt="" className="h-16 w-16 rounded-lg object-cover border border-border" />
                      <button onClick={() => setReviewPhotoFiles(files => files.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted cursor-pointer">
                  <ImagePlus className="h-4 w-4" /> Add photos
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => {
                      const chosen = Array.from(e.target.files || []);
                      setReviewPhotoFiles(prev => [...prev, ...chosen].slice(0, 3));
                    }} />
                </label>
                <span className="text-xs text-muted-foreground">Up to 3 photos</span>
                <Button onClick={submitReview} disabled={submittingReview} className="ml-auto gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Send className="h-4 w-4" /> {submittingReview ? "Submitting…" : "Submit Review"}
                </Button>
              </div>
            </div>
          )}
          {user && !canReview && (
            <div className="mb-6 rounded-lg border border-border/60 p-3 text-xs text-muted-foreground bg-muted/30">
              You can leave a review once your order is delivered.
            </div>
          )}
          {user && alreadyReviewed && (
            <div className="mb-6 rounded-lg border border-accent/40 bg-accent/5 p-3 text-xs text-accent">
              Review Submitted ✓ — thanks for your feedback.
            </div>
          )}

          {reviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm">No reviews yet. Be the first to review this product!</p>
            </div>
          ) : visibleReviews.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No reviews match this filter.</div>
          ) : (
            <div className="space-y-3">
              {visibleReviews.map(r => <ReviewCard key={r.id} review={r} />)}
            </div>
          )}
        </div>

        {/* Q&A */}
        {product && <QAndASection productId={product.id} />}

        {/* Recommended */}
        <div ref={recommendedRef} className="scroll-mt-32">
          {product && <RecommendedProducts productId={product.id} categoryId={product.category_id} />}
        </div>

        <div className="mt-12">
          <RecentlyViewed />
        </div>
      </div>
    </div>
  );
}
