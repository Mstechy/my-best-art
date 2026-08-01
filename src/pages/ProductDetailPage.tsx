import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Package, Heart, Truck, Shield, Info, Star, MessageSquare, Send, Tag, FileText, ImagePlus, X, ZoomIn, ZoomOut, Share2, ChevronRight, Play, ChevronDown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { useProductDetailData, useCanReview, type Product, type ProductDoc, type ProductVariant, type ReviewData, type KeywordItem } from "@/hooks/useProductDetail";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import MakeOfferDialog from "@/components/MakeOfferDialog";
import RecentlyViewed from "@/components/RecentlyViewed";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import SellerMiniCard from "@/components/product/SellerMiniCard";
import ReviewSummary from "@/components/product/ReviewSummary";
import ReviewCard, { type ReviewData as ReviewCardData } from "@/components/product/ReviewCard";
import QAndASection from "@/components/product/QAndASection";
import RecommendedProducts from "@/components/product/RecommendedProducts";
import { formatWarranty, isLikelyTestData, isLikelyTestFeature } from "@/lib/productContent";
import { findProductTypeConfig, getCategoryAttributes, getProductType, getProductVideos } from "@/lib/categoryConfig";
import ProductImage from "@/components/product/ProductImage";
import { trackProductDiscovery } from "@/lib/productDiscovery";
import { trackView } from "@/hooks/useBatchedViewTracking";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { user } = useAuth();
  const { formatPrice } = useCurrency();

  const { isWishlisted, toggleWishlist } = useWishlist();
  const [selectedImage, setSelectedImage] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [playingVideos, setPlayingVideos] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const { add: addRecent } = useRecentlyViewed();

  const [specsOpen, setSpecsOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [shippingOpen, setShippingOpen] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);

  const {
    product: productQuery,
    seller: sellerQuery,
    category: categoryQuery,
    soldCount: soldCountQuery,
    docs: docsQuery,
    variants: variantsQuery,
    reviews: reviewsQuery,
    keywords: keywordsQuery,
    sellerFollowerCount: sellerFollowerQuery,
    sellerAvgRating,
    sellerTotalSold: sellerTotalSoldQuery,
    loading,
  } = useProductDetailData(id);

  const product = productQuery.data ?? null;
  const seller = sellerQuery.data ?? null;
  const category = categoryQuery.data ?? null;
  const soldCount = soldCountQuery.data ?? 0;
  const productDocs = docsQuery.data ?? [];
  const productVariants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const keywords = keywordsQuery.data ?? [];
  const sellerFollowers = sellerFollowerQuery.data ?? 0;
  const sellerTotalSold = sellerTotalSoldQuery.data ?? 0;

  const canReviewData = useCanReview(id, user?.id);
  const canReview = canReviewData.data?.canReview ?? false;
  const alreadyReviewed = canReviewData.data?.alreadyReviewed ?? false;

  useEffect(() => {
    if (product?.id) trackProductDiscovery(product.id, "view");
  }, [product?.id]);

  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  useEffect(() => {
    if (!id) return;
    const viewerId = user?.id ?? null;
    trackView(id, viewerId);
  }, [id, user?.id]);

  const variantSizes = useMemo(() => product?.variants?.sizes?.length ? product.variants.sizes : [...new Set(productVariants.map(variant => variant.option_values.size).filter(Boolean))], [product, productVariants]);
  const variantColors = useMemo(() => product?.variants?.colors?.length ? product.variants.colors : [...new Set(productVariants.map(variant => variant.option_values.color).filter(Boolean))], [product, productVariants]);
  const selectedVariant = productVariants.find(variant =>
    (!selectedSize || variant.option_values.size === selectedSize) &&
    (!selectedColor || variant.option_values.color === selectedColor) &&
    (!variant.option_values.size || !!selectedSize) && (!variant.option_values.color || !!selectedColor)
  );
  const purchasableStock = selectedVariant ? selectedVariant.stock_quantity : (product?.stock_quantity ?? 0);
  const purchasablePrice = selectedVariant?.price ?? product?.price ?? 0;

  const mediaItems = useMemo(() => {
    const images = product?.product_images || [];
    const productVideos = product ? getProductVideos(product.variants) : [];
    const list: { type: "video" | "image"; url: string; id: string }[] = [];
    productVideos.forEach((vurl, idx) => {
      list.push({ type: "video", url: vurl, id: `video-${idx}` });
    });
    images.forEach(img => {
      list.push({ type: "image", url: img.image_url, id: img.id });
    });
    return list;
  }, [product]);

  const carouselLockRef = useRef(false);
  const lastRequestedIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (!carouselApi) return;
    const onSelect = () => {
      // Ignore events triggered by our own programmatic scrollTo
      if (carouselLockRef.current) return;
      const snap = carouselApi.selectedScrollSnap();
      // Only update state if the snap actually changed
      setSelectedImage((prev) => (prev === snap ? prev : snap));
    };
    carouselApi.on("select", onSelect);
    onSelect();
    return () => { carouselApi.off("select", onSelect); };
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    const currentSnap = carouselApi.selectedScrollSnap();
    // Skip if already at the target or if this is the same request we already handled
    if (currentSnap === selectedImage || lastRequestedIndexRef.current === selectedImage) return;

    lastRequestedIndexRef.current = selectedImage;
    carouselLockRef.current = true;
    carouselApi.scrollTo(selectedImage);

    // Release the lock after the scroll animation completes
    const timer = window.setTimeout(() => {
      carouselLockRef.current = false;
      lastRequestedIndexRef.current = null;
    }, 400);

    return () => {
      window.clearTimeout(timer);
      carouselLockRef.current = false;
    };
  }, [selectedImage, carouselApi]);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewComment, setReviewComment] = useState("");
  const [reviewPhotoFiles, setReviewPhotoFiles] = useState<File[]>([]);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewFilter, setReviewFilter] = useState("all");

  const overviewRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "description" | "recommended">("overview");

  useEffect(() => {
    setReviewFilter("all");
    setActiveTab("overview");
  }, [id, product?.id]);

  const submitReview = useCallback(async () => {
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
    const { data: inserted, error } = await supabase.from("reviews").insert({
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
        await supabase.from("review_photos").insert({ review_id: inserted.id, url: urlData.publicUrl, position: i });
      }
    }
    toast.success("Review submitted ✓");
    setReviewComment(""); setReviewTitle(""); setReviewRating(5); setReviewPhotoFiles([]);
    setSubmittingReview(false);
    reviewsQuery.refetch();
    keywordsQuery.refetch();
    canReviewData.refetch();
  }, [user, id, product, reviewRating, reviewTitle, reviewComment, reviewPhotoFiles, reviewsQuery, keywordsQuery, canReviewData]);

  const handleAddToCart = useCallback(() => {
    if (!product || !seller) return;
    if (user?.id === product.seller_id) {
      toast.error("Sellers cannot purchase their own products.");
      return;
    }
    if (variantSizes.length > 0 && !selectedSize) { toast.error("Please select a size first."); return; }
    if (variantColors.length > 0 && !selectedColor) { toast.error("Please select a color first."); return; }
    if (productVariants.length > 0 && !selectedVariant) { toast.error("That option combination is unavailable."); return; }
    if (purchasableStock < quantity) { toast.error("That quantity is no longer available."); return; }
    const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
    const variantSuffix = [selectedSize, selectedColor].filter(Boolean).join("/");
    const cartId = variantSuffix ? `${product.id}::${variantSuffix}` : product.id;
    const titleSuffix = variantSuffix ? ` (${variantSuffix})` : "";
    for (let i = 0; i < quantity; i++) {
      addItem({
        id: cartId,
        product_id: product.id,
        product_variant_id: selectedVariant?.id,
        title: product.title + titleSuffix,
        price: purchasablePrice,
        image_url: primaryImage?.image_url || null,
        seller_id: product.seller_id,
        seller_name: seller.full_name || "Seller",
        stock_quantity: purchasableStock,
      });
    }
    toast.success(`Added ${quantity} item${quantity > 1 ? "s" : ""} to cart`);
  }, [product, seller, user, variantSizes, selectedSize, variantColors, selectedColor, productVariants, selectedVariant, purchasableStock, quantity, purchasablePrice, addItem]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#121212] text-[#111111] dark:text-[#FAF5F2]">
      <MarketplaceNavbar />
      <CartDrawer />
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6">
        <nav aria-label="Breadcrumb" className="mb-4 text-xs text-[#888880]">
          <Link to="/" className="hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">Marketplace</Link>
          {category && (
            <>
              <span className="mx-2">/</span>
              <Link to={`/categories/${category.slug || category.name}`} className="hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">{category.name}</Link>
            </>
          )}
          <span className="mx-2">/</span>
          <span className="text-[#111111] dark:text-[#FAF5F2] line-clamp-1">{product?.title}</span>
        </nav>

        {loading && !product ? (
          <div className="grid lg:grid-cols-2 gap-8 animate-pulse">
            <div className="aspect-square bg-[#F2F3F5] dark:bg-[#202020] rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-[#F2F3F5] dark:bg-[#202020] rounded w-3/4" />
              <div className="h-8 bg-[#F2F3F5] dark:bg-[#202020] rounded w-1/3" />
              <div className="h-20 bg-[#F2F3F5] dark:bg-[#202020] rounded" />
            </div>
          </div>
        ) : !product ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-[#888880]/30 mb-4" />
            <h2 className="text-lg font-bold">Product not found</h2>
            <p className="text-sm text-[#888880] mt-2">This product may have been removed or is unavailable.</p>
            <Link to="/marketplace" className="inline-block mt-6 px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold">
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <div>
              {mediaItems.length > 0 && (
                <Carousel setApi={setCarouselApi} className="w-full">
                  <CarouselContent>
                    {mediaItems.map((item) => (
                      <CarouselItem key={item.id}>
                        <div
                          className="aspect-square bg-[#F7F7F5] dark:bg-[#1E1E1E] rounded-2xl overflow-hidden cursor-zoom-in relative group"
                          onClick={() => { if (item.type === "image") setZoomedImage(item.url); }}
                        >
                          {item.type === "video" ? (
                            <div className="relative w-full h-full">
                              <video
                                src={item.url}
                                controls={playingVideos[item.id]}
                                autoPlay={playingVideos[item.id]}
                                muted
                                playsInline
                                loop
                                className="w-full h-full object-cover"
                                onMouseEnter={() => setPlayingVideos(prev => ({ ...prev, [item.id]: true }))}
                                onMouseLeave={() => setPlayingVideos(prev => ({ ...prev, [item.id]: false }))}
                                onClick={() => setPlayingVideos(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                              />
                              <div
                                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                                onClick={() => setPlayingVideos(prev => ({ ...prev, [item.id]: true }))}
                              >
                                {!playingVideos[item.id] && (
                                  <Play className="h-12 w-12 text-white drop-shadow-lg" />
                                )}
                              </div>
                            </div>
                          ) : (
                            <>
                              <ProductImage src={item.url} alt={product.title} className="group-hover:scale-105" />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </>
                          )}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                </Carousel>
              )}
              {mediaItems.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {mediaItems.map((item, idx) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedImage(idx)}
                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-colors ${idx === selectedImage ? "border-[#111111] dark:border-[#FAF5F2]" : "border-transparent hover:border-[#C8C8C0] dark:hover:border-[#444444]"}`}
                    >
                      {item.type === "video" ? (
                        <div className="relative w-full h-full bg-[#F2F3F5] dark:bg-[#202020] flex items-center justify-center">
                          <Play className="h-4 w-4 text-[#888880]" />
                        </div>
                      ) : (
                        <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                {category && (
                  <Link to={`/categories/${category.slug || category.name}`} className="text-[10px] font-bold uppercase tracking-wider text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">
                    {category.name}
                  </Link>
                )}
                <h1 className="text-2xl font-bold mt-1">{product.title}</h1>
                <div className="flex items-baseline gap-3 mt-3">
                  <span className="text-3xl font-black">{formatPrice(purchasablePrice)}</span>
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <span className="text-lg text-[#888880] line-through">{formatPrice(product.compare_at_price)}</span>
                  )}
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <span className="text-xs font-bold text-[#E53935] bg-[#E53935]/10 px-2 py-0.5 rounded-full">
                      -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-[#888880]">
                {product.review_count > 0 && (
                  <div className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-[#F6C75D] text-[#F6C75D]" />
                    <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{product.average_rating.toFixed(1)}</span>
                    <span>({product.review_count})</span>
                  </div>
                )}
                {soldCount > 0 && <span>{soldCount} sold</span>}
                {purchasableStock <= 5 && purchasableStock > 0 && (
                  <span className="text-[#E53935] font-semibold">Only {purchasableStock} left</span>
                )}
                {purchasableStock === 0 && <span className="text-[#E53935] font-semibold">Out of stock</span>}
              </div>

              {variantSizes.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2">Size: <span className="font-normal text-[#888880]">{selectedSize || "Select"}</span></p>
                  <div className="flex flex-wrap gap-2">
                    {variantSizes.map(size => (
                      <button key={size} onClick={() => setSelectedSize(size)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${selectedSize === size ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] border-[#E8E8E8] dark:border-[#222222] hover:border-[#111111] dark:hover:border-[#555555]"}`}>
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {variantColors.length > 0 && (
                <div>
                  <p className="text-xs font-bold mb-2">Color: <span className="font-normal text-[#888880]">{selectedColor || "Select"}</span></p>
                  <div className="flex flex-wrap gap-2">
                    {variantColors.map(color => (
                      <button key={color} onClick={() => setSelectedColor(color)}
                        className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${selectedColor === color ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] border-[#E8E8E8] dark:border-[#222222] hover:border-[#111111] dark:hover:border-[#555555]"}`}>
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4">
                <div className="flex items-center border border-[#E8E8E8] dark:border-[#222222] rounded-xl overflow-hidden">
                  <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm font-bold hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] transition-colors">−</button>
                  <span className="h-10 w-12 flex items-center justify-center text-sm font-semibold border-x border-[#E8E8E8] dark:border-[#222222]">{quantity}</span>
                  <button onClick={() => setQuantity(q => Math.min(purchasableStock, q + 1))} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sm font-bold hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] transition-colors">+</button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={purchasableStock === 0}
                  className="flex-1 py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50"
                >
                  {purchasableStock === 0 ? "Out of Stock" : "Add to Cart"}
                </button>
                {user && (
                  <button onClick={() => { if (product) toggleWishlist(product.id); }}
                    className={`h-12 w-12 flex items-center justify-center rounded-full border transition-colors ${isWishlisted(product?.id || "") ? "border-[#E53935] text-[#E53935]" : "border-[#E8E8E8] dark:border-[#222222] text-[#888880] hover:border-[#111111] dark:hover:border-[#555555]"}`}
                    aria-label={isWishlisted(product?.id || "") ? "Remove from wishlist" : "Add to wishlist"}>
                    <Heart className={`h-5 w-5 ${isWishlisted(product?.id || "") ? "fill-current" : ""}`} />
                  </button>
                )}
              </div>

              {product && (
                <MakeOfferDialog
                  productId={product.id}
                  productTitle={product.title}
                  productPrice={purchasablePrice}
                  open={offerOpen}
                  onOpenChange={setOfferOpen}
                  onSent={() => {}}
                />
              )}

              {seller && (
                <SellerMiniCard
                  sellerId={seller.user_id}
                  name={seller.full_name || "Seller"}
                  isVerified={seller.is_verified}
                  avatarUrl={null}
                  followers={sellerFollowers}
                  rating={sellerAvgRating}
                  soldCount={sellerTotalSold}
                />
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-[#888880]">
                  <Truck className="h-4 w-4" />
                  <span>{product.shipping_info || "Shipping calculated at checkout"}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#888880]">
                  <Shield className="h-4 w-4" />
                  <span>Buyer protection — full refund if not as described</span>
                </div>
                {product.warranty && (
                  <div className="flex items-center gap-2 text-xs text-[#888880]">
                    <Info className="h-4 w-4" />
                    <span>{formatWarranty(product.warranty)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {product && (
          <div className="mt-12 space-y-6">
            <Collapsible open={descriptionOpen} onOpenChange={setDescriptionOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b border-[#E8E8E8] dark:border-[#222222] text-sm font-bold">
                Description <ChevronDown className={`h-4 w-4 transition-transform ${descriptionOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 text-sm text-[#666666] dark:text-[#A0A0A0] leading-relaxed whitespace-pre-line">
                {product.description || "No description provided."}
              </CollapsibleContent>
            </Collapsible>

            {product.key_features && product.key_features.length > 0 && (
              <Collapsible open={specsOpen} onOpenChange={setSpecsOpen}>
                <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b border-[#E8E8E8] dark:border-[#222222] text-sm font-bold">
                  Key Features <ChevronDown className={`h-4 w-4 transition-transform ${specsOpen ? "rotate-180" : ""}`} />
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-4">
                  <ul className="space-y-2">
                    {product.key_features.filter(f => !isLikelyTestFeature(f)).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-[#666666] dark:text-[#A0A0A0]">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}

            <Collapsible open={shippingOpen} onOpenChange={setShippingOpen}>
              <CollapsibleTrigger className="flex items-center justify-between w-full py-3 border-b border-[#E8E8E8] dark:border-[#222222] text-sm font-bold">
                Shipping & Returns <ChevronDown className={`h-4 w-4 transition-transform ${shippingOpen ? "rotate-180" : ""}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-4 text-sm text-[#666666] dark:text-[#A0A0A0] leading-relaxed">
                {product.shipping_info || "Shipping costs calculated at checkout based on destination and weight."}
              </CollapsibleContent>
            </Collapsible>

            <div ref={reviewsRef}>
              <ReviewSummary
                average={product.average_rating}
                total={product.review_count}
                keywords={keywords}
                activeFilter={reviewFilter}
                onFilterChange={setReviewFilter}
                positive={reviews.filter(r => r.rating >= 4).length}
                neutral={reviews.filter(r => r.rating === 3).length}
                negative={reviews.filter(r => r.rating <= 2).length}
                photoCount={reviews.reduce((s, r) => s + r.photos.length, 0)}
                starCounts={{ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }}
                allVerified={false}
              />
              <div className="mt-4 space-y-4">
                {reviews
                  .filter(r => reviewFilter === "all" || r.rating === Number(reviewFilter))
                  .map(review => (
                    <ReviewCard key={review.id} review={review as unknown as ReviewCardData} />
                  ))}
                {reviews.length === 0 && (
                  <p className="text-sm text-[#888880] text-center py-8">No reviews yet.</p>
                )}
              </div>
              {user && canReview && !alreadyReviewed && (
                <div className="mt-6 border-t border-[#E8E8E8] dark:border-[#222222] pt-6">
                  <p className="text-sm font-bold mb-4">Write a Review</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map(star => (
                        <button key={star} onClick={() => setReviewRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)}
                          className="text-lg transition-colors">
                          <Star className={`h-5 w-5 ${star <= (hoverRating || reviewRating) ? "fill-[#F6C75D] text-[#F6C75D]" : "text-[#D8D8D2] dark:text-[#444444]"}`} />
                        </button>
                      ))}
                    </div>
                    <input
                      value={reviewTitle}
                      onChange={e => setReviewTitle(e.target.value)}
                      placeholder="Review title (optional)"
                      className="w-full h-10 px-3 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-sm outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors"
                    />
                    <textarea
                      value={reviewComment}
                      onChange={e => setReviewComment(e.target.value)}
                      placeholder="Share your experience (min 20 characters)"
                      rows={4}
                      className="w-full px-3 py-2 rounded-xl border border-[#E8E8E8] dark:border-[#2A2A2A] bg-[#FAFAFA] dark:bg-[#111111] text-sm outline-none focus:border-[#111111] dark:focus:border-[#555555] transition-colors resize-none"
                    />
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs text-[#888880] cursor-pointer hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">
                        <ImagePlus className="h-4 w-4" />
                        Add photos
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => setReviewPhotoFiles(Array.from(e.target.files || []))} />
                      </label>
                      {reviewPhotoFiles.length > 0 && (
                        <span className="text-xs text-[#888880]">{reviewPhotoFiles.length} selected</span>
                      )}
                    </div>
                    <button
                      onClick={submitReview}
                      disabled={submittingReview}
                      className="px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {submittingReview ? "Submitting..." : <><Send className="h-3.5 w-3.5" /> Submit Review</>}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <QAndASection productId={product.id} />

            <div ref={recommendedRef}>
              <RecommendedProducts productId={product.id} categoryId={product.category_id} />
            </div>

            <RecentlyViewed />
          </div>
        )}
      </div>

      {/* Sticky mobile CTA bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 border-t border-[#E8E8E8] dark:border-[#222222] bg-white/90 dark:bg-[#121212]/90 backdrop-blur md:hidden">
        <div className="mx-auto max-w-7xl px-4 py-2 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-[#888880] dark:text-[#A0A0A0] truncate">{product?.title}</p>
            <p className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{formatPrice(purchasablePrice)}</p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={purchasableStock === 0}
            className="rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            Add to Cart
          </button>
          <button
            onClick={() => { if (product) toggleWishlist(product.id); }}
            className={`h-10 w-10 rounded-full border flex items-center justify-center ${isWishlisted(product?.id || "") ? "border-[#E53935] text-[#E53935]" : "border-[#E8E8E8] dark:border-[#222222] text-[#888880]"}`}
            aria-label="Wishlist"
          >
            <Heart className={`h-4 w-4 ${isWishlisted(product?.id || "") ? "fill-current" : ""}`} />
          </button>
        </div>
      </div>

      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <img src={zoomedImage} alt="" className="max-w-full max-h-[85vh] object-contain rounded-2xl" style={{ transform: `scale(${zoomScale})`, transition: "transform 0.2s" }} />
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => setZoomScale(s => Math.min(3, s + 0.5))} className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors" aria-label="Zoom in"><ZoomIn className="h-5 w-5" /></button>
              <button onClick={() => setZoomScale(s => Math.max(1, s - 0.5))} className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors" aria-label="Zoom out"><ZoomOut className="h-5 w-5" /></button>
              <button onClick={() => setZoomedImage(null)} className="h-10 w-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center text-white hover:bg-white/30 transition-colors" aria-label="Close zoomed image"><X className="h-5 w-5" /></button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}