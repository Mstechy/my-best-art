import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Package, Heart, Truck, Shield, Info, Star, MessageSquare, Send, Tag, FileText, ImagePlus, X, ZoomIn, ZoomOut, Share2, Play, ChevronDown, ChevronRight, Flame, Store, ShoppingCart } from "lucide-react";
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
import { Container } from "@/components/ui/Container";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { toast } from "sonner";
import MakeOfferDialog from "@/components/MakeOfferDialog";
import RecentlyViewed from "@/components/RecentlyViewed";
import VariantSelector from "@/components/product/VariantSelector";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import SellerMiniCard from "@/components/product/SellerMiniCard";
import ReviewSummary from "@/components/product/ReviewSummary";
import ReviewCard, { type ReviewData as ReviewCardData } from "@/components/product/ReviewCard";
import QAndASection from "@/components/product/QAndASection";
import RecommendedProducts from "@/components/product/RecommendedProducts";
import { isLikelyTestData, isLikelyTestFeature } from "@/lib/productContent";
import { findProductTypeConfig, getCategoryAttributes, getProductType, getProductVideos } from "@/lib/categoryConfig";
import ProductImage from "@/components/product/ProductImage";
import ProductVideoPlayer from "@/components/product/ProductVideoPlayer";
import { BottomTabBar } from "@/components/ui/BottomTabBar";
import ProductRichDescription from "@/components/product/ProductRichDescription";
import { trackProductDiscovery } from "@/lib/productDiscovery";
import { trackView } from "@/hooks/useBatchedViewTracking";
import { useProductSEO } from "@/hooks/useSEO";
import { useResolvedPolicies } from "@/hooks/useResolvedPolicies";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, beginDirectCheckout, totalItems, setIsOpen: setCartOpen } = useCart();
  const { user, role } = useAuth();
  const { formatPrice } = useCurrency();
  const chatPath = role === "seller" || role === "admin" ? "/seller/chat" : "/buyer/chat";

  const { isWishlisted, toggleWishlist } = useWishlist();
  const [selectedImage, setSelectedImage] = useState(0);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [offerOpen, setOfferOpen] = useState(false);
  const [selectedVariantOptions, setSelectedVariantOptions] = useState<Record<string, string>>({});
  const [purchaseAction, setPurchaseAction] = useState<"cart" | "buy" | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [titleExpanded, setTitleExpanded] = useState(false);
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const { add: addRecent } = useRecentlyViewed();

  const [specsOpen, setSpecsOpen] = useState(false);
  const [reviewFormOpen, setReviewFormOpen] = useState(false);
  const [verifiedSellerOpen, setVerifiedSellerOpen] = useState(false);
  const [serviceSheet, setServiceSheet] = useState<"shipping" | "returns" | "protection" | "warranty" | null>(null);

  const {
    product: productQuery,
    seller: sellerQuery,
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
  const soldCount = soldCountQuery.data ?? 0;
  const productDocs = docsQuery.data ?? [];
  const productVariants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const keywords = keywordsQuery.data ?? [];
  const sellerFollowers = sellerFollowerQuery.data ?? 0;
  const sellerTotalSold = sellerTotalSoldQuery.data ?? 0;
  const reviewStarCounts = useMemo(() => reviews.reduce<Record<number, number>>((counts, review) => {
    counts[review.rating] = (counts[review.rating] ?? 0) + 1;
    return counts;
  }, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }), [reviews]);
  const reviewPhotoCount = useMemo(() => reviews.reduce((total, review) => total + review.photos.length, 0), [reviews]);
  const allReviewsVerified = reviews.length > 0 && reviews.every((review) => review.is_verified_purchase);
  const { policies, isLoading: policiesLoading, isError: policiesError, sourceLabel } = useResolvedPolicies(product?.seller_id, product);

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

  const hasProductVariants = productVariants.length > 0;
  const variantSizes = useMemo(() => product?.variants?.sizes?.length ? product.variants.sizes : [...new Set(productVariants.map(variant => variant.option_values.size).filter(Boolean))], [product, productVariants]);
  const variantColors = useMemo(() => product?.variants?.colors?.length ? product.variants.colors : [...new Set(productVariants.map(variant => variant.option_values.color).filter(Boolean))], [product, productVariants]);
  const variantAttributeKeys = useMemo(() => {
    const keys = new Set<string>();
    productVariants.forEach(v => {
      Object.keys(v.option_values || {}).forEach(k => {
        if (v.option_values[k]) keys.add(k);
      });
    });
    return keys;
  }, [productVariants]);
  const productDetailSpecs = useMemo(() => {
    if (!product) return null;
    const systemKeys = new Set(["categoryGroup", "productTypeKey"]);
    const details = Object.fromEntries(
      Object.entries(getCategoryAttributes(product.variants)).filter(([key]) => !variantAttributeKeys.has(key) && !systemKeys.has(key))
    ) as Record<string, string>;
    const addDetail = (label: string, value: string | null | undefined) => {
      if (value?.trim()) details[label] = value.trim();
    };
    addDetail("Brand", product.brand);
    addDetail("Material", product.material);
    addDetail("Colour", product.color);
    addDetail("Dimensions", product.dimensions);
    addDetail("Weight", product.weight);
    addDetail("Condition", product.condition);
    addDetail("Warranty", product.warranty || product.warranty_period);
    return Object.keys(details).length > 0 ? details : null;
  }, [product, variantAttributeKeys]);
  const selectedVariant = hasProductVariants
    ? (variantAttributeKeys.size > 0 && [...variantAttributeKeys].every((key) => selectedVariantOptions[key])
      ? productVariants.find((variant) =>
          variant.is_active &&
          [...variantAttributeKeys].every((key) => variant.option_values[key] === selectedVariantOptions[key]),
        ) ?? null
      : null)
    : (productVariants.find(variant =>
        variant.is_active &&
        (!selectedSize || variant.option_values.size === selectedSize) &&
        (!selectedColor || variant.option_values.color === selectedColor) &&
        (!variant.option_values.size || !!selectedSize) && (!variant.option_values.color || !!selectedColor)
      ) ?? null);
  const inStockVariants = useMemo(
    () => productVariants.filter((variant) => variant.is_active && variant.stock_quantity > 0),
    [productVariants],
  );
  const hasInStockVariant = inStockVariants.length > 0;
  const purchasableStock = selectedVariant
    ? selectedVariant.stock_quantity
    : hasProductVariants
      ? Number(hasInStockVariant)
      : (product?.stock_quantity ?? 0);
  const purchasablePrice = selectedVariant?.price ?? product?.price ?? 0;
  const startingVariantPrice = useMemo(() => {
    if (!hasProductVariants || !product) return null;
    const priceSource = inStockVariants.length > 0 ? inStockVariants : productVariants;
    return Math.min(...priceSource.map((variant) => variant.price ?? product.price));
  }, [hasProductVariants, product, productVariants, inStockVariants]);
  const seoImage = product?.product_images?.find((image) => image.is_primary)?.image_url || product?.product_images?.[0]?.image_url;
  useProductSEO({
    productName: product?.title || "Product",
    price: purchasablePrice,
    currency: product?.currency || "NGN",
    image: seoImage,
    description: product?.meta_description || product?.description || undefined,
    id: product?.id || id || "",
    availability: purchasableStock > 0 ? "InStock" : "OutOfStock",
    rating: product?.average_rating,
    reviewCount: product?.review_count,
    brand: product?.brand,
  });
  const hasAvailableVariant = (size?: string, color?: string) => productVariants.some(variant =>
    variant.is_active &&
    variant.stock_quantity > 0 &&
    (!size || variant.option_values.size === size) &&
    (!color || variant.option_values.color === color)
  );

  const mediaItems = useMemo(() => {
    const images = (product?.product_images || []).filter((img) => img.image_url?.trim().length > 0);
    const productVideos = product ? getProductVideos(product.variants).filter((vurl) => vurl?.trim().length > 0) : [];
    const list: { type: "video" | "image"; url: string; id: string }[] = [];
    // If a variant with its own image is selected, show that image first (AliExpress behavior)
    if (selectedVariant?.image_url?.trim()) {
      list.push({ type: "image", url: selectedVariant.image_url.trim(), id: `variant-${selectedVariant.id}` });
    }
    productVideos.forEach((vurl, idx) => {
      list.push({ type: "video", url: vurl, id: `video-${idx}` });
    });
    images.forEach(img => {
      list.push({ type: "image", url: img.image_url.trim(), id: img.id });
    });
    return list;
  }, [product, selectedVariant]);

  // A colour/SKU image is deliberately placed first in the gallery. Reset the
  // carousel whenever the shopper changes a selection so the visible product
  // matches the option they just chose.
  useEffect(() => {
    setSelectedImage(0);
  }, [selectedVariantOptions]);

  useEffect(() => {
    if (selectedVariant) setQuantity((current) => Math.max(1, Math.min(current, selectedVariant.stock_quantity)));
  }, [selectedVariant]);

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
  const [showAllReviews, setShowAllReviews] = useState(false);

  const overviewRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const recommendedRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "reviews" | "description" | "recommended">("overview");

  useEffect(() => {
    setReviewFilter("all");
    setActiveTab("overview");
  }, [id, product?.id]);

  useEffect(() => {
    setSelectedVariantOptions({});
    setQuantity(1);
    setPurchaseAction(null);
  }, [product?.id]);

  useEffect(() => {
    if (!hasProductVariants || variantAttributeKeys.size === 0) return;
    const defaultVariant = productVariants.find((variant) => variant.is_active && variant.stock_quantity > 0)
      ?? productVariants.find((variant) => variant.is_active);
    if (!defaultVariant) return;

    setSelectedVariantOptions(
      Object.fromEntries(
        [...variantAttributeKeys]
          .filter((key) => defaultVariant.option_values[key])
          .map((key) => [key, defaultVariant.option_values[key]]),
      ),
    );
  }, [hasProductVariants, product?.id, productVariants, variantAttributeKeys]);

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

  const completePurchase = useCallback((action: "cart" | "buy") => {
    if (!product || !seller) return;
    if (user?.id === product.seller_id) {
      toast.error("Sellers cannot purchase their own products.");
      return;
    }
    if (hasProductVariants && !selectedVariant) { toast.error("Please select every option first."); return; }
    if (!hasProductVariants && variantSizes.length > 0 && !selectedSize) { toast.error("Please select a size first."); return; }
    if (!hasProductVariants && variantColors.length > 0 && !selectedColor) { toast.error("Please select a color first."); return; }
    if (productVariants.length > 0 && (!selectedVariant || !selectedVariant.is_active)) { toast.error("That option combination is unavailable."); return; }
    if (purchasableStock < quantity) { toast.error("That quantity is no longer available."); return; }
    const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
    const cartImage = selectedVariant?.image_url || primaryImage?.image_url || null;
    const variantSuffix = selectedVariant
      ? Object.entries(selectedVariant.option_values).map(([key, value]) => `${key}: ${value}`).join(", ")
      : [selectedSize, selectedColor].filter(Boolean).join("/");
    const cartId = selectedVariant ? `${product.id}::variant:${selectedVariant.id}` : variantSuffix ? `${product.id}::${variantSuffix}` : product.id;
    const item = {
      id: cartId,
      product_id: product.id,
      product_variant_id: selectedVariant?.id,
      variant_attributes: selectedVariant?.option_values,
      title: product.title,
      price: purchasablePrice,
      image_url: cartImage,
      seller_id: product.seller_id,
      seller_name: seller.full_name || "Seller",
      stock_quantity: purchasableStock,
      quantity,
    };
    if (action === "cart") {
      addItem(item);
      toast.success(`Added ${quantity} item${quantity > 1 ? "s" : ""} to cart`);
      setPurchaseAction(null);
      return;
    }
    beginDirectCheckout(item);
    setPurchaseAction(null);
    navigate("/checkout");
  }, [product, seller, user, hasProductVariants, variantSizes, selectedSize, variantColors, selectedColor, productVariants, selectedVariant, purchasableStock, quantity, purchasablePrice, addItem, beginDirectCheckout, navigate]);

  const startPurchase = useCallback((action: "cart" | "buy") => {
    if (product && user?.id === product.seller_id) {
      toast.error("Sellers cannot purchase their own products.");
      return;
    }
    // The page already exposes the complete selector on desktop. Once a
    // purchasable SKU is selected, a second picker would be needless friction.
    // Keep the sheet only as a guard when options are still incomplete.
    if (hasProductVariants && !selectedVariant) {
      setPurchaseAction(action);
      return;
    }
    completePurchase(action);
  }, [product, user, hasProductVariants, selectedVariant, completePurchase]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-[156px] text-[#111111] dark:bg-[#121212] dark:text-[#FAF5F2] md:pb-24">
      <MarketplaceNavbar showSearch={false} />
      <CartDrawer />
      <BottomTabBar />
      <Container className="py-6">
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
                    {mediaItems.map((item, index) => (
                      <CarouselItem key={item.id}>
                        <div
                          className="aspect-square bg-[#F7F7F5] dark:bg-[#1E1E1E] rounded-2xl overflow-hidden cursor-zoom-in relative group"
                          onClick={() => { if (item.type === "image") setZoomedImage(item.url); }}
                        >
                          {/* Image index badge (AliExpress parity) */}
                          <span className="absolute bottom-3 left-3 z-10 rounded-full bg-black/65 text-white text-[11px] px-2 py-1 backdrop-blur-md">
                            Item {index + 1}/{mediaItems.length}
                          </span>
                          {item.type === "video" ? (
                            <div className="relative w-full h-full">
                              <ProductVideoPlayer
                                src={item.url}
                                compact={false}
                                className="h-full w-full"
                                alt="Product video"
                              />
                            </div>
                          ) : (
                            <>
                              <ProductImage src={item.url} alt={product.title} className="group-hover:scale-105" loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </>
                          )}
                          {user && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                              className={`absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 dark:bg-[#1E1E1E]/90 shadow-sm backdrop-blur transition-colors ${isWishlisted(product.id) ? "text-[#E53935]" : "text-[#888880] dark:text-[#A0A0A0] hover:text-[#E53935]"}`}
                              aria-label={isWishlisted(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                            >
                              <Heart className={`h-4 w-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                            </button>
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
                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${idx === selectedImage ? "border-[#111111] ring-2 ring-[#111111]/20 dark:border-[#FAF5F2] dark:ring-[#FAF5F2]/20 scale-[1.05]" : "border-transparent hover:border-[#C8C8C0] dark:hover:border-[#444444]"}`}
                    >
                      {item.type === "video" ? (
                        <div className="relative w-full h-full bg-[#F2F3F5] dark:bg-[#202020] flex items-center justify-center">
                          <Play className="h-4 w-4 text-[#888880]" />
                        </div>
                      ) : (
                        <ProductImage src={item.url} alt="Product thumbnail" className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div>
                {/* Condition pill + title (2-line clamp with expand) */}
                {product.condition && (
                  <span className="inline-block mb-2 rounded-md bg-[#F2F3F5] dark:bg-[#202020] px-2 py-0.5 text-[11px] font-semibold text-[#666666] dark:text-[#A0A0A0]">
                    {product.condition}
                  </span>
                )}
                <h1 className={`text-2xl font-bold ${!titleExpanded ? "line-clamp-2" : ""}`}>{product.title || "Untitled product"}</h1>
                {(product.title ?? "").length > 90 && (
                  <button type="button" onClick={() => setTitleExpanded(e => !e)} className="mt-1 text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] underline">
                    {titleExpanded ? "Less" : "More"}
                  </button>
                )}

                {selectedVariant && (
                  <p className="mt-2 text-xs font-medium text-[#666666] dark:text-[#A0A0A0]" aria-live="polite">
                    Selected: {Object.entries(selectedVariant.option_values).map(([key, value]) => `${key}: ${value}`).join(" · ")}
                  </p>
                )}

                {/* Social proof directly under title (AliExpress parity) */}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#888880]">
                  {seller?.is_verified && (
                    <span className="flex items-center gap-1 font-semibold text-[#16803C] dark:text-[#5EE38B]">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Verified seller
                    </span>
                  )}
                  {product.review_count > 0 && (
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-[#F6C75D] text-[#F6C75D]" />
                      <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{(product.average_rating ?? 0).toFixed(1)}</span>
                      <span>({product.review_count})</span>
                    </div>
                  )}
                  {soldCount > 0 && <span>{soldCount} sold</span>}
                  {policies.shipping && <span className="truncate">Delivery: {policies.shipping.summary}</span>}
                  {purchasableStock === 0 && <span className="text-[#E53935] font-semibold">Out of stock</span>}
                </div>

                {/* Compatible price block (no quantity selector here - moved to variant section) */}
                {/* Promo pricing banner (MarketHub-adapted) */}
                {product.compare_at_price && product.compare_at_price > product.price ? (
                  <div className="mt-4 rounded-2xl bg-[#1A1A1A] dark:bg-[#252525] text-white px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#F6C75D]">
                        <Flame className="h-3 w-3" />
                        Limited Offer
                      </span>
                      <span className="text-[10px] font-bold text-[#888880]">
                        Save {Math.round((1 - product.price / product.compare_at_price) * 100)}%
                      </span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-2 mt-2">
                      <span className="text-3xl font-black text-white">{hasProductVariants && !selectedVariant ? `From ${formatPrice(startingVariantPrice ?? purchasablePrice)}` : formatPrice(purchasablePrice)}</span>
                      <span className="text-base text-[#888880] line-through">{formatPrice(product.compare_at_price)}</span>
                      <span className="text-xs font-bold text-[#E53935] bg-[#E53935]/20 px-2 py-0.5 rounded-full">
                        -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-3xl font-black">{hasProductVariants && !selectedVariant ? `From ${formatPrice(startingVariantPrice ?? purchasablePrice)}` : formatPrice(purchasablePrice)}</span>
                    {purchasableStock > 0 && purchasableStock <= (product.low_stock_threshold ?? 5) && (
                      <span className="text-xs font-semibold text-[#E53935]">Only {purchasableStock} left</span>
                    )}
                  </div>
                )}
              </div>

            {hasProductVariants && (
              <section className="rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] p-4 dark:border-[#222222] dark:bg-[#181818]" aria-label="Product options">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-bold">Choose your options</h2>
                    <p className="mt-1 text-xs text-[#888880]">Select storage, colour, or another option to see its exact price and availability.</p>
                  </div>
                  {Object.keys(selectedVariantOptions).length > 0 && (
                    <button type="button" onClick={() => setSelectedVariantOptions({})} className="shrink-0 text-xs font-semibold underline text-[#666666] hover:text-[#111111] dark:text-[#A0A0A0] dark:hover:text-[#FAF5F2]">
                      Clear selection
                    </button>
                  )}
                </div>
                <VariantSelector variants={productVariants} selectedOptions={selectedVariantOptions} onChange={setSelectedVariantOptions} />
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-[#F2F3F5] px-3 py-2.5 text-xs dark:bg-[#222222]" aria-live="polite">
                  {selectedVariant ? (
                    <>
                      <span className="font-bold">{formatPrice(purchasablePrice)}</span>
                      <span className="font-semibold text-[#666666] dark:text-[#A0A0A0]">{purchasableStock} available</span>
                    </>
                  ) : (
                    <span className="font-medium text-[#666666] dark:text-[#A0A0A0]">Choose every option to see the exact SKU price.</span>
                  )}
                </div>
              </section>
            )}

            {!hasProductVariants && (
              <>
                {variantSizes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2">Size: <span className="font-normal text-[#888880]">{selectedSize || "Select"}</span></p>
                    <div className="flex flex-wrap gap-2">
                      {variantSizes.map(size => (
                        <button
                          key={size}
                          type="button"
                          disabled={!hasAvailableVariant(size, selectedColor || undefined)}
                          onClick={() => setSelectedSize(size)}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${selectedSize === size ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] border-[#E8E8E8] dark:border-[#222222] hover:border-[#111111] dark:hover:border-[#555555]"}`}
                        >
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
                        <button
                          key={color}
                          type="button"
                          disabled={!hasAvailableVariant(selectedSize || undefined, color)}
                          onClick={() => setSelectedColor(color)}
                          className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${selectedColor === color ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] border-[#E8E8E8] dark:border-[#222222] hover:border-[#111111] dark:hover:border-[#555555]"}`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-4">
              {!hasProductVariants && <div className="flex items-center overflow-hidden rounded-xl border border-[#E8E8E8] dark:border-[#222222]">
                <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-bold transition-colors hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]">−</button>
                <span className="flex h-10 w-12 items-center justify-center border-x border-[#E8E8E8] text-sm font-semibold dark:border-[#222222]">{quantity}</span>
                <button onClick={() => setQuantity(q => Math.min(purchasableStock, q + 1))} className="flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-bold transition-colors hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D]">+</button>
              </div>}
              <button
                onClick={() => startPurchase("cart")}
                disabled={!hasProductVariants && purchasableStock === 0}
                className="flex-1 py-3 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-bold hover:bg-[#2A2A2A] dark:hover:bg-[#EAE0D8] transition-colors disabled:opacity-50"
              >
                {!hasProductVariants && purchasableStock === 0 ? "Out of Stock" : "Add to Cart"}
              </button>
              <button
                onClick={() => startPurchase("buy")}
                disabled={!hasProductVariants && purchasableStock === 0}
                className="hidden flex-1 rounded-full border border-[#111111] py-3 text-sm font-bold text-[#111111] transition-colors hover:bg-[#F2F3F5] disabled:opacity-50 dark:border-[#FAF5F2] dark:text-[#FAF5F2] dark:hover:bg-[#222222] md:block"
              >
                Buy Now
              </button>
            </div>

            {user && user.id !== product.seller_id && purchasableStock > 0 && (
              <button
                type="button"
                onClick={() => setOfferOpen(true)}
                className="w-full rounded-full border border-[#111111] py-2.5 text-sm font-bold text-[#111111] transition-colors hover:bg-[#F2F3F5] dark:border-[#FAF5F2] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
              >
                Make an Offer
              </button>
            )}

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

            <div className="space-y-2">
              {policiesLoading && <p className="px-1 text-xs text-[#888880]">Loading policy information…</p>}
              {policiesError && <p className="px-1 text-xs text-[#888880]">Policy information is unavailable.</p>}
              <button type="button" onClick={() => setServiceSheet("shipping")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222] ${!policies.shipping ? "hidden" : ""}`}>
                <Truck className="h-4 w-4 shrink-0 text-[#666666] dark:text-[#A0A0A0]" />
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">Shipping</span><span className="block truncate text-xs text-[#888880]">{policies.shipping?.summary}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#888880]" />
              </button>
              <button type="button" onClick={() => setServiceSheet("returns")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-xs text-[#888880] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222] ${!policies.returns ? "hidden" : ""}`}>
                <Shield className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#111111] dark:text-[#FAF5F2]">Returns & refunds</span><span className="block truncate">{policies.returns?.summary}</span></span>{/*
                <span>Buyer protection — full refund if not as described</span>
                */}<ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              <button type="button" onClick={() => setServiceSheet("protection")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-xs text-[#888880] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222] ${!policies.protection ? "hidden" : ""}`}>
                <Shield className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#111111] dark:text-[#FAF5F2]">Buyer protection</span><span className="block truncate">{policies.protection?.summary}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              {policies.warranty && (
                <button type="button" onClick={() => setServiceSheet("warranty")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-xs text-[#888880] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222]">
                  <Info className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1"><span className="block font-semibold text-[#111111] dark:text-[#FAF5F2]">Warranty</span><span className="block truncate">{policies.warranty.summary}</span></span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              )}
            </div>

            {seller && (
              <SellerMiniCard
                sellerId={seller.user_id}
                name={seller.full_name || "Seller"}
                isVerified={seller.is_verified}
                avatarUrl={null}
                followers={sellerFollowers}
                rating={sellerAvgRating}
                soldCount={sellerTotalSold}
                chatHref={`${chatPath}?seller=${seller.user_id}&product=${product.id}`}
                onVerifiedClick={() => setVerifiedSellerOpen(true)}
              />
            )}

            {/* Specifications are rendered once in the Product Details section below (AliExpress style) */}
            </div>
          </div>
        )}

        <Sheet open={verifiedSellerOpen} onOpenChange={setVerifiedSellerOpen}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-[#22C55E]" /> Verified seller</SheetTitle>
              <SheetDescription>This badge is shown only for seller profiles marked as verified by Marketplace. It does not replace the product details, shipping terms, or buyer protection shown for this listing.</SheetDescription>
            </SheetHeader>
          </SheetContent>
        </Sheet>

        <Sheet open={serviceSheet !== null} onOpenChange={(open) => !open && setServiceSheet(null)}>
          <SheetContent side="bottom" className="rounded-t-2xl">
            <SheetHeader>
              <SheetTitle>{serviceSheet ? policies[serviceSheet]?.title : ""}</SheetTitle>
              <SheetDescription>{serviceSheet ? policies[serviceSheet]?.detail : ""}</SheetDescription>
            </SheetHeader>
            {serviceSheet && policies[serviceSheet] && <p className="mt-4 text-xs font-semibold text-[#888880]">{sourceLabel(policies[serviceSheet].source)} · Last updated {policies[serviceSheet].updatedAt ? new Date(policies[serviceSheet].updatedAt).toLocaleDateString() : "not available"}</p>}
          </SheetContent>
        </Sheet>

        {product && (
          <div className="mt-12 space-y-6">
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

            <ProductRichDescription
              images={product.description_images}
              description={product.description}
              specs={productDetailSpecs}
            />

            {productDocs.length > 0 && (
              <section className="rounded-xl border border-[#E8E8E8] bg-white p-4 dark:border-[#222222] dark:bg-[#1A1A1A]" aria-labelledby="product-documents">
                <h2 id="product-documents" className="text-sm font-bold">Documents</h2>
                <div className="mt-3 space-y-2">
                  {productDocs.map((document: ProductDoc) => (
                    <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#333333] dark:hover:bg-[#222222]">
                      <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-[#888880]" /><span className="truncate">{document.label || "Product document"}</span></span>
                      <span className="text-xs text-[#888880]">Open</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <div ref={reviewsRef}>
              {reviewsQuery.isLoading && <div className="space-y-3 animate-pulse"><div className="h-5 w-24 rounded bg-[#F2F3F5] dark:bg-[#202020]" /><div className="h-20 rounded-xl bg-[#F2F3F5] dark:bg-[#202020]" /></div>}
              {!reviewsQuery.isLoading && reviews.length === 0 && <div className="flex min-h-11 items-center justify-between gap-3 border-y border-[#E8E8E8] py-3 dark:border-[#222222]"><div><h2 className="text-base font-bold">Reviews</h2><p className="text-xs text-[#888880]">No reviews yet</p></div>{user && canReview && !alreadyReviewed && <button type="button" onClick={() => setReviewFormOpen(true)} className="min-h-11 rounded-full border border-[#111111] px-4 text-xs font-bold dark:border-[#FAF5F2]">Be the first to review</button>}</div>}
              {reviews.length > 0 && <ReviewSummary
                average={product.average_rating}
                total={product.review_count}
                keywords={[]}
                activeFilter={reviewFilter}
                onFilterChange={setReviewFilter}
                positive={reviews.filter(r => r.rating >= 4).length}
                neutral={reviews.filter(r => r.rating === 3).length}
                negative={reviews.filter(r => r.rating <= 2).length}
                photoCount={reviewPhotoCount}
                starCounts={reviewStarCounts}
                allVerified={allReviewsVerified}
                showDistribution={reviews.length >= 5}
              />}
              {/* Review photo gallery (AliExpress-style horizontal scroll) */}
              {(() => {
                const allPhotos = reviews.flatMap(r => r.photos.map(p => ({ url: p.url, reviewId: r.id })));
                if (allPhotos.length === 0) return null;
                return (
                  <div className="mt-4">
                    <p className="text-xs font-bold mb-2">Customer Photos</p>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {allPhotos.map((photo, idx) => (
                        <button
                          key={`${photo.reviewId}-${idx}`}
                          type="button"
                          onClick={() => setZoomedImage(photo.url)}
                          className="shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-[#E8E8E8] dark:border-[#222222]"
                        >
                          <ProductImage src={photo.url} alt="Customer review photo" className="w-full h-full object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div className="mt-4 space-y-4">
                {reviews.length > 0 && reviews
                  .filter(r => reviewFilter === "all" || r.rating === Number(reviewFilter))
                  .slice(0, showAllReviews ? undefined : 3)
                  .map(review => (
                    <ReviewCard key={review.id} review={review as unknown as ReviewCardData} />
                  ))}
              </div>
              {reviews.filter(r => reviewFilter === "all" || r.rating === Number(reviewFilter)).length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllReviews(current => !current)}
                  className="mt-4 min-h-11 w-full rounded-full border border-[#111111] px-4 text-xs font-bold transition-colors hover:bg-[#FAFAFA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111111] focus-visible:ring-offset-2 dark:border-[#FAF5F2] dark:hover:bg-[#1A1A1A] dark:focus-visible:ring-[#FAF5F2]"
                >
                  {showAllReviews ? "Show fewer reviews" : "See all reviews"}
                </button>
              )}
              {user && canReview && !alreadyReviewed && (reviews.length > 0 || reviewFormOpen) && (
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

            <RecentlyViewed excludeId={product.id} />
          </div>
        )}
      </Container>

      {/* Sticky mobile CTA bar - store icon (→ seller page) + price left + full-width Add to Cart + Buy Now */}
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-[60] border-t border-[#E8E8E8] bg-white/95 backdrop-blur dark:border-[#222222] dark:bg-[#121212]/95 md:hidden">
        <Container className="flex items-center gap-2 py-2">
          <button
            onClick={() => product && navigate(`/seller/${product.seller_id}`)}
            className="shrink-0 rounded-full bg-[#111111]/80 dark:bg-[#1E1E1E]/80 p-2 transition-colors hover:bg-[#111111]/90 dark:hover:bg-[#FAF5F2]/90"
            aria-label="Visit store"
          >
            <Store className="h-5 w-5 text-white dark:text-[#FAF5F2]" />
          </button>
          <button
            type="button"
            onClick={() => product && navigate(`${chatPath}?seller=${product.seller_id}&product=${product.id}`)}
            className="shrink-0 rounded-full bg-[#111111]/80 p-2 text-white transition-colors hover:bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#1E1E1E]/80 dark:text-[#FAF5F2] dark:hover:bg-[#FAF5F2]/90"
            aria-label="Chat with seller"
          >
            <MessageSquare className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="relative shrink-0 rounded-full bg-[#111111]/80 p-2 text-white transition-colors hover:bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#1E1E1E]/80 dark:text-[#FAF5F2] dark:hover:bg-[#FAF5F2]/90"
            aria-label={`Open cart${totalItems > 0 ? `, ${totalItems} items` : ""}`}
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-1 text-[9px] font-bold text-white">{totalItems > 99 ? "99+" : totalItems}</span>}
          </button>
          <span className="shrink-0 text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{hasProductVariants && !selectedVariant ? `From ${formatPrice(startingVariantPrice ?? purchasablePrice)}` : formatPrice(purchasablePrice)}</span>
          <button
            onClick={() => startPurchase("cart")}
            disabled={!hasProductVariants && purchasableStock === 0}
            className="flex-1 h-[44px] rounded-full border border-[#111111] dark:border-[#FAF5F2] text-[#111111] dark:text-[#FAF5F2] text-sm font-semibold disabled:opacity-50"
          >
            Add to Cart
          </button>
          <button
            onClick={() => startPurchase("buy")}
            disabled={!hasProductVariants && purchasableStock === 0}
            className="flex-1 h-[44px] rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-sm font-semibold disabled:opacity-50"
          >
            Buy Now
          </button>
        </Container>
      </div>
      <Sheet open={purchaseAction !== null} onOpenChange={(open) => { if (!open) setPurchaseAction(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#E8E8E8] bg-white px-5 pb-6 pt-5 dark:border-[#222222] dark:bg-[#111111] sm:mx-auto sm:max-w-xl">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>Select options</SheetTitle>
            <SheetDescription>Choose a complete in-stock combination to see its exact price.</SheetDescription>
          </SheetHeader>
          <div className="mt-5 space-y-5">
            <VariantSelector variants={productVariants} selectedOptions={selectedVariantOptions} onChange={setSelectedVariantOptions} />
            <div className="flex items-center justify-between rounded-2xl bg-[#F2F3F5] px-4 py-3 dark:bg-[#1E1E1E]">
              <div>
                <p className="text-xs text-[#888880]">{selectedVariant ? "Selected SKU" : "Select every option"}</p>
                <p className="mt-1 text-lg font-black">{selectedVariant ? formatPrice(purchasablePrice) : `From ${formatPrice(startingVariantPrice ?? purchasablePrice)}`}</p>
              </div>
              <div className="text-right text-xs font-semibold text-[#888880]">
                {selectedVariant ? `${purchasableStock} available` : ""}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">Quantity</span>
              <div className="flex items-center overflow-hidden rounded-xl border border-[#E8E8E8] dark:border-[#222222]">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center text-sm font-bold disabled:opacity-40" disabled={!selectedVariant}>−</button>
                <span className="flex h-10 w-10 items-center justify-center border-x border-[#E8E8E8] text-sm font-semibold dark:border-[#222222]">{quantity}</span>
                <button type="button" onClick={() => setQuantity((current) => Math.min(purchasableStock, current + 1))} className="flex h-10 w-10 items-center justify-center text-sm font-bold disabled:opacity-40" disabled={!selectedVariant || quantity >= purchasableStock}>+</button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => purchaseAction && completePurchase(purchaseAction)}
              disabled={!selectedVariant || purchasableStock === 0}
              className="w-full rounded-full bg-[#111111] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2A2A2A] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#FAF5F2] dark:text-[#111111]"
            >
              {purchaseAction === "buy" ? "Buy Now" : "Add to Cart"}
            </button>
          </div>
        </SheetContent>
      </Sheet>
      {zoomedImage && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setZoomedImage(null)}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <ProductImage src={zoomedImage} alt="Zoomed product image" className="max-w-full max-h-[85vh] object-contain rounded-2xl" style={{ transform: `scale(${zoomScale})` }} />
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
