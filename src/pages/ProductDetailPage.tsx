import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Package, ShoppingCart, Heart, Truck, Shield, Info, Star, MessageSquare, Send, Tag, FileText, ImagePlus, X, ZoomIn, ZoomOut, Share2, Search, ChevronRight, BookmarkPlus, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { toast } from "sonner";
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
import { findCategoryConfig, findProductTypeConfig, getCategoryAttributes, getProductType, getProductVideos } from "@/lib/categoryConfig";
import ProductImage from "@/components/product/ProductImage";

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
  variants: { sizes?: string[]; colors?: string[]; categoryAttributes?: Record<string, string> } | null;
  product_images: { id: string; image_url: string; is_primary: boolean }[];
}

interface ProductDoc { id: string; url: string; label: string | null; }

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<{ full_name: string | null; is_verified: boolean; user_id: string } | null>(null);
  const [category, setCategory] = useState<{ name: string; slug?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [playingVideos, setPlayingVideos] = useState<Record<string, boolean>>({});
  const { add: addRecent } = useRecentlyViewed();

  const images = product?.product_images || [];
  const productVideos = product ? getProductVideos(product.variants) : [];

  // Combine videos and images into a single media array (videos first)
  const mediaItems = useMemo(() => {
    const list: { type: "video" | "image"; url: string; id: string }[] = [];
    productVideos.forEach((vurl, idx) => {
      list.push({ type: "video", url: vurl, id: `video-${idx}` });
    });
    images.forEach(img => {
      list.push({ type: "image", url: img.image_url, id: img.id });
    });
    return list;
  }, [productVideos, images]);


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
        data.category_id ? supabase.from("categories").select("name, slug").eq("id", data.category_id).single() : Promise.resolve({ data: null }),
        (supabase as any).rpc("product_sold_count", { _product_id: id }),
        (supabase as any).from("product_documents").select("*").eq("product_id", id),
      ]);
      if (sellerRes.data) {
        const sellerData = sellerRes.data as any;
        setSeller({ user_id: sellerData.user_id, full_name: sellerData.full_name, is_verified: sellerData.is_verified });
        setSellerAvatar(sellerData.avatar_url || null);
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
      supabase.from("product_views").insert({ product_id: id, viewer_id: null } as any).then(() => { });
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
    mapped.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    setReviews(mapped);
  };

  const submitReview = async () => {
    if (!user || !id || !product) return;
    if (reviewComment.trim().length < 20) {
      toast.error("Please write at least 20 characters.");
      return;
    }
    setSubmittingReview(true);
    const { data: orderItems } = await supabase.from("order_items").select("order_id").eq("product_id", id);
    const orderIds = [...new Set(orderItems?.map(item => item.order_id).filter(Boolean) ?? [])];
    const { data: deliveredOrder } = orderIds.length > 0 ? await supabase
      .from("orders").select("id").eq("buyer_id", user.id).eq("seller_id", product.seller_id)
      .eq("status", "delivered").in("id", orderIds).limit(1).maybeSingle() : { data: null };
    if (!deliveredOrder) {
      toast.error("Only buyers with a delivered order can review this product.");
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
      toast.error(error?.message || "Could not save review");
      setSubmittingReview(false);
      return;
    }
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
    toast.success("Review submitted ✓");
    setReviewComment(""); setReviewTitle(""); setReviewRating(5); setReviewPhotoFiles([]);
    setAlreadyReviewed(true);
    fetchReviews(); fetchKeywords();
    setSubmittingReview(false);
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (user?.id === product.seller_id) {
      toast.error("Sellers cannot purchase their own products.");
      return;
    }
    const sizes = product.variants?.sizes || [];
    const colors = product.variants?.colors || [];
    if (sizes.length > 0 && !selectedSize) { toast.error("Please select a size first."); return; }
    if (colors.length > 0 && !selectedColor) { toast.error("Please select a color first."); return; }
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
    toast.success("Added to cart!");
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
      toast.info("This is your listing.");
      return;
    }
    navigate(`/buyer/chat?seller=${sellerId}&product=${product.id}`);
  };

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
      toast.error("Please sign in to make an offer.");
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
      toast.error(error.message);
      return;
    }
    toast.success("Offer sent successfully!");
    navigate(`/buyer/chat?seller=${seller.user_id}`);
  };

  const avgRating = product?.average_rating ?? 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E]">
        <MarketplaceNavbar showSearch={false} />
        <div className="mx-auto max-w-6xl px-4 lg:px-8 py-8">
          <div className="grid lg:grid-cols-2 gap-8">
            <div className="aspect-square rounded-2xl bg-muted animate-pulse" />
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
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-[#FAFAFA] dark:bg-[#0E0E0E]">
      <Package className="h-16 w-16 text-[#888880]" />
      <h2 className="text-xl font-bold text-[#111111] dark:text-[#FAF5F2]">Product not found</h2>
      <Link to="/marketplace">
        <button className="px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] transition-colors">
          Back to Marketplace
        </button>
      </Link>
    </div>
  );

  const productType = getProductType(product.variants);
  const productTypeConfig = findProductTypeConfig(category, productType?.key);
  const categoryAttributes = getCategoryAttributes(product.variants);
  const specs: { label: string; value: string }[] = productTypeConfig.fields
    .map(field => ({ label: field.label, value: categoryAttributes[field.key] }))
    .filter((item): item is { label: string; value: string } => Boolean(item.value));

  const addFallbackSpec = (label: string, value?: string | null) => {
    if (value && !specs.some(spec => spec.label === label)) specs.push({ label, value });
  };
  addFallbackSpec("Brand", product.brand);
  addFallbackSpec("Material", product.material);
  addFallbackSpec("Color", product.color);
  addFallbackSpec("Weight", product.weight);
  addFallbackSpec("Dimensions", product.dimensions);
  addFallbackSpec("Condition", product.condition ? product.condition.charAt(0).toUpperCase() + product.condition.slice(1) : null);

  const colorVariants = product.color?.split(",").map(c => c.trim()).filter(Boolean) || [];
  const warrantyDisplay = formatWarranty(product.warranty_period || product.warranty);
  const shipInfoValid = product.shipping_info && !isLikelyTestData(product.shipping_info);
  const shipInfoDisplay = shipInfoValid ? product.shipping_info : "Ships within 3-5 business days";
  const descriptionValid = product.description && !isLikelyTestData(product.description);
  const validFeatures = (product.key_features || []).filter(f => !isLikelyTestFeature(f));
  const showSold = product.show_sold_count !== false && soldCount > 0;
  const soldLabel = soldCount >= 10000 ? "10,000+ sold" : soldCount >= 100 ? `${Math.floor(soldCount / 100) * 100}+ sold` : `${soldCount} sold`;
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

  // Calculate discount
  const discountPercent = product.compare_at_price && product.compare_at_price > product.price
    ? Math.round((1 - product.price / product.compare_at_price) * 100)
    : 0;
  const savingsAmount = product.compare_at_price && product.compare_at_price > product.price
    ? (product.compare_at_price - product.price).toFixed(2)
    : null;

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#0E0E0E] pb-24 md:pb-6">
      {/* Desktop navbar only */}
      <div className="hidden md:block">
        <MarketplaceNavbar showSearch={false} />
      </div>
      <CartDrawer />

      {/* Mobile Floating Controls & Navigation Pills */}
      <div className="md:hidden">
        {/* Floating Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="fixed top-3 left-3 z-40 h-8 w-8 rounded-full bg-white/80 dark:bg-[#1A1A1A]/80 border border-[#E8E8E8] dark:border-[#222222] backdrop-blur-sm shadow flex items-center justify-center text-[#111111] dark:text-[#FAF5F2] active:scale-95 transition-transform"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Floating Top Navigation Pills */}
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-40 bg-white/80 dark:bg-[#1A1A1A]/80 border border-[#E8E8E8] dark:border-[#222222] backdrop-blur-sm rounded-full p-1 flex items-center gap-1 shadow max-w-[calc(100vw-110px)] overflow-x-auto scrollbar-none">
          {tabs.map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => scrollTo(t.ref, t.key)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap transition-all duration-150 ${isActive ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]" : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"
                      }`}
              >
                {t.label.split(" ")[0]} {/* Shorten tab labels on mobile if needed */}
              </button>
            );
          })}
        </div>

        {/* Floating Share Button */}
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            toast.success("Product link copied!");
          }}
          className="fixed top-3 right-3 z-40 h-8 w-8 rounded-full bg-white/80 dark:bg-[#1A1A1A]/80 border border-[#E8E8E8] dark:border-[#222222] backdrop-blur-sm shadow flex items-center justify-center text-[#111111] dark:text-[#FAF5F2] active:scale-95 transition-transform"
        >
          <Share2 className="h-4 w-4" />
        </button>
      </div>

      {/* Desktop Sticky Tabs Sub-bar */}
      <div className="hidden md:sticky md:top-14 md:z-30 w-full bg-white/80 dark:bg-[#111111]/80 backdrop-blur-md border-b border-[#E8E8E8] dark:border-[#222222] transition-all duration-200">
        <div className="mx-auto max-w-6xl flex items-center h-11 px-4 gap-1.5 overflow-x-auto scrollbar-none">
          {tabs.map(t => {
            const isActive = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => scrollTo(t.ref, t.key)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all duration-150 ${isActive ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]" : "text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#222222]"
                      }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto max-w-6xl md:px-4 lg:px-8 py-0 md:py-4">


        <div ref={overviewRef} className="grid md:grid-cols-2 gap-0 md:gap-8">
          {/* Left: Images */}
          <div className="relative">
            <div className="overflow-hidden bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm md:rounded-2xl md:border border-[#E8E8E8] dark:border-[#222222] aspect-square relative">
              {mediaItems.length === 0 ? (
                <div className="aspect-square flex items-center justify-center">
                  <Package className="h-14 w-14 text-[#C0C0B8]" />
                </div>
              ) : (
                <Carousel setApi={setCarouselApi} opts={{ loop: mediaItems.length > 1 }} className="relative h-full w-full">
                  <CarouselContent className="h-full">
                    {mediaItems.map(item => (
                      <CarouselItem key={item.id} className="h-full flex items-center justify-center">
                        {item.type === "video" ? (
                          <div className="w-full h-full relative bg-black">
                            <video src={item.url} controls className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => { setZoomScale(1); setZoomedImage(item.url); }}
                            className="w-full h-full cursor-zoom-in bg-[#FAFAFA] dark:bg-[#1A1A1A]"
                          >
                            <ProductImage src={item.url} alt={product.title} variant="detail" className="w-full h-full object-contain" loading="eager" />
                          </button>
                        )}
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              )}

              {/* Mobile overlay status pill: "Item 1/6 | Review | Color" */}
              {mediaItems.length > 0 && (
                <div className="absolute bottom-4 left-4 bg-black/60 backdrop-blur-sm rounded-full px-3 py-1 text-[10px] font-semibold text-white flex items-center gap-1.5 z-10">
                  <span>Item {selectedImage + 1}/{mediaItems.length}</span>
                  {reviews.length > 0 && (
                    <>
                      <span className="opacity-40">|</span>
                      <span className="flex items-center gap-0.5"><Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" /> {avgRating.toFixed(1)}</span>
                    </>
                  )}
                  {product.color && (
                    <>
                      <span className="opacity-40">|</span>
                      <span>{product.color.split(",")[0]}</span>
                    </>
                  )}
                </div>
              )}

              {/* Floating heart for wishlist */}
              {user && user.id !== product.seller_id && (
                <button
                  onClick={() => toggleWishlist(product.id)}
                  className="absolute bottom-4 right-4 h-9 w-9 rounded-full bg-white dark:bg-[#1A1A1A] shadow-md border border-[#E8E8E8] dark:border-[#222222] flex items-center justify-center z-10 text-[#888880] active:scale-95 transition-transform"
                >
                  <Heart className={`h-4.5 w-4.5 ${isWishlisted(product.id) ? "fill-red-500 text-red-500" : ""}`} />
                </button>
              )}
            </div>

            {/* List of mini thumbnails below the main image/video */}
            {mediaItems.length > 1 && (
              <div className="flex gap-2 p-4 md:px-0 overflow-x-auto scrollbar-none">
                {mediaItems.map((item, i) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedImage(i)}
                    className={`w-14 h-14 rounded-xl overflow-hidden border-2 transition-all shrink-0 bg-white dark:bg-[#111111] flex items-center justify-center relative ${i === selectedImage ? "border-[#111111] dark:border-[#FAF5F2]" : "border-[#E8E8E8] dark:border-[#222222]"
                      }`}
                  >
                    {item.type === "video" ? (
                      <div className="w-full h-full bg-[#111111] flex items-center justify-center relative">
                        <span className="absolute inset-0 bg-black/40 flex items-center justify-center">
                          <Play className="h-5 w-5 text-white fill-white" />
                        </span>
                      </div>
                    ) : (
                      <ProductImage src={item.url} alt="" variant="thumb" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Lightbox zoom dialog */}
          {zoomedImage && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
              role="dialog"
              aria-modal="true"
              onClick={() => setZoomedImage(null)}
            >
              <button
                type="button"
                className="absolute right-4 top-4 rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-colors"
                onClick={() => { setZoomScale(1); setZoomedImage(null); }}
              >
                <X className="h-5 w-5" />
              </button>
              <div className="absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/10 px-2 py-1 text-white" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-full p-2 disabled:opacity-40"
                  onClick={() => setZoomScale((scale) => Math.max(1, scale - 0.5))}
                  disabled={zoomScale <= 1}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="min-w-10 text-center text-xs font-semibold">{Math.round(zoomScale * 100)}%</span>
                <button
                  type="button"
                  className="rounded-full p-2 disabled:opacity-40"
                  onClick={() => setZoomScale((scale) => Math.min(3, scale + 0.5))}
                  disabled={zoomScale >= 3}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
              <div className="flex max-h-[92vh] max-w-[96vw] overflow-auto" onClick={(event) => event.stopPropagation()}>
                <img
                  src={zoomedImage}
                  alt={product.title}
                  className="object-contain transition-[max-height,max-width] duration-200"
                  style={{
                    maxHeight: `${92 * zoomScale}vh`,
                    maxWidth: `${96 * zoomScale}vw`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Right: Info / Pricing / Checkout actions */}
          <div className="p-4 md:p-0 space-y-4">
            <div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {category && <span className="inline-flex px-2 py-0.5 rounded bg-[#F2F3F5] dark:bg-[#1A1A1A] text-[9px] font-bold uppercase tracking-wider text-[#888880]">{category.name}</span>}
                {productType && <span className="inline-flex px-2 py-0.5 rounded border border-[#E8E8E8] dark:border-[#222222] text-[9px] font-bold uppercase tracking-wider text-[#888880]">{productType.label}</span>}
              </div>
              <h1 className="text-lg font-bold text-[#111111] dark:text-[#FAF5F2] leading-snug tracking-tight">{product.title}</h1>
              {product.brand && (
                <p className="text-xs text-[#888880] mt-1">Brand: <span className="text-[#111111] dark:text-[#FAF5F2] font-semibold">{product.brand}</span></p>
              )}
            </div>

            {/* Rating / Sold count */}
            {(reviews.length > 0 || showSold) && (
              <div className="flex items-center gap-2 text-xs">
                {reviews.length > 0 && (
                  <>
                    <span className="inline-flex items-center gap-0.5">
                      <Star className="h-3.5 w-3.5 fill-[#F6C75D] text-[#F6C75D]" />
                      <span className="font-bold text-[#111111] dark:text-[#FAF5F2]">{avgRating.toFixed(1)}</span>
                    </span>
                    <span className="text-[#E8E8E8] dark:text-[#222222]">|</span>
                    <button onClick={() => scrollTo(reviewsRef, "reviews")} className="text-[#888880] hover:text-[#111111] font-semibold underline underline-offset-2">
                      {reviews.length} review{reviews.length !== 1 ? "s" : ""}
                    </button>
                  </>
                )}
                {showSold && (
                  <>
                    {reviews.length > 0 && <span className="text-[#E8E8E8] dark:text-[#222222]">|</span>}
                    <span className="text-[#888880] font-semibold">{soldLabel}</span>
                  </>
                )}
              </div>
            )}

            {/* Brand Accent Price Box */}
            <div className="bg-[#F6C75D]/10 dark:bg-[#F6C75D]/5 border border-[#F6C75D]/20 dark:border-[#F6C75D]/10 rounded-2xl p-4 flex flex-col gap-1.5 relative overflow-hidden">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-[#111111] dark:text-[#FAF5F2]">${product.price.toFixed(2)}</span>
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="text-sm text-[#888880] line-through font-medium">${product.compare_at_price.toFixed(2)}</span>
                )}
              </div>

              {discountPercent > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex px-1.5 py-0.5 rounded bg-[#F6C75D] text-[10px] font-bold text-[#111111] uppercase tracking-wider">
                    -{discountPercent}% OFF
                  </span>
                  {savingsAmount && (
                    <span className="text-[10px] font-bold text-[#5C3A00] dark:text-[#F6C75D]">
                      Save ${savingsAmount}
                    </span>
                  )}
                </div>
              )}
              <p className="text-[9px] text-[#888880] mt-0.5 leading-none">Tax excluded, added at checkout if applicable</p>
            </div>

            {/* Commitments Section (Brand Style) */}
            <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm rounded-2xl border border-[#E8E8E8] dark:border-[#222222] overflow-hidden divide-y divide-[#F2F3F5] dark:divide-[#222222]">
              <div className="p-3 flex items-start justify-between cursor-pointer group hover:bg-[#FAFAFA] dark:hover:bg-[#111111] transition-colors">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Truck className="h-4 w-4 text-[#F6C75D] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Free shipping</p>
                    <p className="text-[10px] text-[#888880] mt-0.5">Delivery: {deliveryRange}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#C0C0B8] shrink-0 self-center group-hover:translate-x-0.5 transition-transform" />
              </div>

              <div className="p-3 flex items-start justify-between cursor-pointer group hover:bg-[#FAFAFA] dark:hover:bg-[#111111] transition-colors">
                <div className="flex items-start gap-2.5 min-w-0">
                  <Shield className="h-4 w-4 text-[#F6C75D] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Return & refund policy</p>
                    <p className="text-[10px] text-[#888880] mt-0.5">{warrantyDisplay || "Refund within 30 days if unsatisfied"}</p>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-[#C0C0B8] shrink-0 self-center group-hover:translate-x-0.5 transition-transform" />
              </div>

              <div className="p-3 flex items-start gap-2.5 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-[#F6C75D] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Security & Privacy</p>
                  <p className="text-[10px] text-[#888880] mt-0.5">Safe payments · Secure personal details</p>
                </div>
              </div>
            </div>

            {/* Size / Color selection */}
            {product.variants?.sizes && product.variants.sizes.length > 0 && (
              <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4">
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-3 flex items-center gap-1">Size <span className="text-red-500">*</span></p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.sizes.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSelectedSize(s)}
                      className={`h-9 px-3 rounded-full border text-xs font-semibold transition-colors ${selectedSize === s
                          ? "border-[#111111] dark:border-[#FAF5F2] bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                          : "border-[#E8E8E8] dark:border-[#222222] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2]"
                        }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {product.variants?.colors && product.variants.colors.length > 0 && (
              <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4">
                <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-3 flex items-center gap-1">Color <span className="text-red-500">*</span></p>
                <div className="flex flex-wrap gap-2">
                  {product.variants.colors.map((c) => (
                    <button
                      key={c}
                      onClick={() => setSelectedColor(c)}
                      className={`h-9 px-4 rounded-full border text-xs font-semibold transition-colors ${selectedColor === c
                          ? "border-[#111111] dark:border-[#FAF5F2] bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111]"
                          : "border-[#E8E8E8] dark:border-[#222222] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] text-[#111111] dark:text-[#FAF5F2]"
                        }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            {product.stock_quantity > 0 && (
              <div className="bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-4 flex items-center justify-between">
                <span className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Quantity:</span>
                <div className="flex items-center border border-[#E8E8E8] dark:border-[#222222] rounded-full overflow-hidden shrink-0">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#888880] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors">−</button>
                  <span className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#111111] dark:text-[#FAF5F2] border-x border-[#E8E8E8] dark:border-[#222222]">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))} className="w-8 h-8 flex items-center justify-center text-xs font-bold text-[#888880] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] transition-colors">+</button>
                </div>
              </div>
            )}

            {/* Desktop Action row */}
            <div className="hidden md:grid grid-cols-2 gap-2.5">
              <button
                onClick={handleAddToCart}
                disabled={product.stock_quantity === 0 || user?.id === product.seller_id}
                className="py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50"
              >
                Add to Cart
              </button>
              <Link to="/checkout" className="block">
                <button
                  onClick={handleAddToCart}
                  disabled={product.stock_quantity === 0}
                  className="w-full py-3 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-bold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
                >
                  Buy Now
                </button>
              </Link>
            </div>

            {/* Negotiation tools */}
            <div className="space-y-2">
              {user && user.id !== product.seller_id && (
                <button
                  onClick={() => setOfferOpen(true)}
                  className="w-full py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Tag className="h-3.5 w-3.5" /> Make Offer
                </button>
              )}

              {user?.id !== product.seller_id ? (
                <button
                  onClick={handleChatWithSeller}
                  className="w-full py-2.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors flex items-center justify-center gap-1.5"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Chat with Seller
                </button>
              ) : (
                <div className="py-2.5 rounded-full bg-[#FAFAFA] dark:bg-[#111111] border border-[#E8E8E8] dark:border-[#222222] text-center text-xs text-[#888880] select-none font-semibold">
                  This is your listing
                </div>
              )}
            </div>

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

            {/* Empty space/redundancy blocker */}
          </div>
        </div>

        {/* Balanced Info Block: Seller Card & Guarantee Card (Desktop: side-by-side, Mobile: stacked) */}
        <div className="grid md:grid-cols-2 gap-4 mt-4 px-4 md:px-0">
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
          <ProductGuarantee />
        </div>

        {/* Tab contents (Specs, Details, etc) */}
        <div ref={descriptionRef} className="mt-10 scroll-mt-32 px-4 md:px-0 space-y-4">
          {/* Specifications */}
          {specs.length > 0 && (
            <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-3 flex items-center gap-1.5">
                <Info className="h-4.5 w-4.5 text-[#111111] dark:text-[#FAF5F2]" /> Specifications
              </p>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-1">
                {specs.map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2 text-xs border-b border-[#F2F3F5] dark:border-[#222222] last:border-0 sm:last:border-b sm:[&:nth-last-child(-n+2)]:border-0">
                    <span className="text-[#888880]">{label}</span>
                    <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* About this product */}
          {descriptionValid && (
            <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm">
              <p className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-3 flex items-center gap-1.5">
                <FileText className="h-4.5 w-4.5 text-[#111111] dark:text-[#FAF5F2]" /> About this product
              </p>
              <p className="text-xs text-[#888880] leading-relaxed whitespace-pre-wrap">{product.description}</p>
            </div>
          )}

          {/* Shipping & Warranty Metadata Cards */}
          {(warrantyDisplay || shipInfoDisplay) && (
            <div className="grid sm:grid-cols-2 gap-4">
              {shipInfoDisplay && (
                <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm flex gap-3 items-start">
                  <Truck className="h-4 w-4 text-[#F6C75D] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-1">Shipping Policy</h4>
                    <p className="text-xs text-[#888880] leading-relaxed">{shipInfoDisplay}</p>
                  </div>
                </div>
              )}
              {warrantyDisplay && (
                <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm flex gap-3 items-start">
                  <Shield className="h-4 w-4 text-[#111111] dark:text-[#FAF5F2] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-1">Warranty Details</h4>
                    <p className="text-xs text-[#888880] leading-relaxed">{warrantyDisplay}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div ref={reviewsRef} className="mt-10 scroll-mt-32 px-4 md:px-0">
          <h2 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2] mb-5 flex items-center gap-1.5">
            <Star className="h-4.5 w-4.5 fill-[#F6C75D] text-[#F6C75D]" /> Customer Reviews
            {reviews.length > 0 && <span className="text-xs font-normal text-[#888880] ml-1">({reviews.length})</span>}
          </h2>

          {reviews.length > 0 && (
            <div className="mb-4">
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

          {/* Submit Review */}
          {user && canReview && !alreadyReviewed && (
            <div className="rounded-2xl border border-[#E8E8E8] dark:border-[#222222] p-5 mb-5 bg-white/80 dark:bg-[#1A1A1A]/80 backdrop-blur-sm">
              <h3 className="text-xs font-bold text-[#111111] dark:text-[#FAF5F2] mb-3">Write a Review</h3>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onMouseEnter={() => setHoverRating(s)} onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setReviewRating(s)} className="p-0.5">
                    <Star className={`h-5.5 w-5.5 transition-colors ${s <= (hoverRating || reviewRating) ? "text-[#F6C75D] fill-[#F6C75D]" : "text-[#C0C0B8]/30"}`} />
                  </button>
                ))}
                <span className="text-xs text-[#888880] ml-2">{reviewRating}/5</span>
              </div>
              <input
                value={reviewTitle}
                onChange={e => setReviewTitle(e.target.value)}
                placeholder="Review title (optional)"
                className="w-full mb-3 h-10 px-3 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs text-[#111111] dark:text-[#FAF5F2] outline-none"
              />
              <textarea
                value={reviewComment}
                onChange={e => setReviewComment(e.target.value)}
                placeholder="Share your experience (min 20 characters)…"
                rows={3}
                className="w-full mb-3 p-3 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-xs text-[#111111] dark:text-[#FAF5F2] outline-none"
              />
              {reviewPhotoFiles.length > 0 && (
                <div className="flex gap-2 mb-3 flex-wrap">
                  {reviewPhotoFiles.map((f, i) => (
                    <div key={i} className="relative">
                      <img src={URL.createObjectURL(f)} alt="" className="h-14 w-14 rounded-xl object-cover border border-[#E8E8E8] dark:border-[#222222]" />
                      <button onClick={() => setReviewPhotoFiles(files => files.filter((_, j) => j !== i))}
                        className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px]">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <label className="inline-flex items-center gap-1.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] px-3 py-1.5 text-xs text-[#888880] hover:bg-[#F2F3F5] dark:hover:bg-[#222222] cursor-pointer font-semibold">
                  <ImagePlus className="h-3.5 w-3.5" /> Add photos
                  <input type="file" accept="image/*" multiple className="hidden"
                    onChange={e => {
                      const chosen = Array.from(e.target.files || []);
                      setReviewPhotoFiles(prev => [...prev, ...chosen].slice(0, 3));
                    }} />
                </label>
                <span className="text-[10px] text-[#888880]">Up to 3 photos</span>
                <button
                  onClick={submitReview}
                  disabled={submittingReview}
                  className="ml-auto flex items-center gap-1.5 px-5 py-2 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors"
                >
                  <Send className="h-3.5 w-3.5" /> {submittingReview ? "Submitting…" : "Submit Review"}
                </button>
              </div>
            </div>
          )}
          {user && !canReview && (
            <div className="mb-4 rounded-xl border border-[#E8E8E8] dark:border-[#222222] p-3 text-[10px] text-[#888880] bg-[#FAFAFA] dark:bg-[#111111] font-semibold">
              You can leave a review once your order is delivered.
            </div>
          )}
          {user && alreadyReviewed && (
            <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900/30 bg-emerald-50 dark:bg-emerald-900/10 p-3 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Review Submitted ✓ — thanks for your feedback.
            </div>
          )}

          {reviews.length === 0 ? (
            <div className="text-center py-8 text-[#888880]">
              <Star className="h-6 w-6 mx-auto mb-2 text-[#C0C0B8]/40" />
              <p className="text-xs">No reviews yet. Be the first to review this product!</p>
            </div>
          ) : visibleReviews.length === 0 ? (
            <div className="text-center py-8 text-[#888880] text-xs">No reviews match this filter.</div>
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

        <div className="mt-8 px-4 md:px-0">
          <RecentlyViewed />
        </div>
      </div>

      {/* Sticky Bottom bar for mobile layout */}
      <div className="md:hidden fixed bottom-0 inset-x-0 bg-white/85 dark:bg-[#111111]/85 border-t border-[#E8E8E8] dark:border-[#222222] p-3 z-40 flex items-center justify-between gap-3 shadow-lg backdrop-blur-md">
        {/* Buy Now border button */}
        <Link to="/checkout" className="flex-1">
          <button
            onClick={handleAddToCart}
            disabled={product.stock_quantity === 0}
            className="w-full py-3.5 rounded-full border border-[#E8E8E8] dark:border-[#222222] text-xs font-bold text-[#111111] dark:text-[#FAF5F2] hover:bg-[#F2F3F5] dark:hover:bg-[#1A1A1A] transition-colors disabled:opacity-50"
          >
            Buy Now
          </button>
        </Link>
        {/* Add to cart solid pill */}
        <button
          onClick={handleAddToCart}
          disabled={product.stock_quantity === 0 || user?.id === product.seller_id}
          className="flex-1 py-3.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50"
        >
          {user?.id === product.seller_id ? "Your listing" : "Add to cart"}
        </button>
      </div>
    </div>
  );
}
