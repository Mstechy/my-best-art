import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2, Package, Heart, Truck, Shield, Info, Star, MessageSquare, Send, Tag, FileText, ImagePlus, X, ZoomIn, ZoomOut, Share2, Play, ChevronDown, ChevronLeft, ChevronRight, Store, ShoppingCart } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { useCurrency } from "@/hooks/useCurrency";
import { useProductDetailData, useCanReview, isProductNotFoundError, type Product, type ProductDoc, type ProductVariant, type ReviewData, type KeywordItem } from "@/hooks/useProductDetail";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import SiteFooter from "@/components/SiteFooter";
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
import { isLikelyTestFeature } from "@/lib/productContent";
import { findProductTypeConfig, getCategoryAttributes, getProductType, getProductVideos } from "@/lib/categoryConfig";
import ProductImage from "@/components/product/ProductImage";
import ProductVideoPlayer from "@/components/product/ProductVideoPlayer";
import ProductRichDescription from "@/components/product/ProductRichDescription";
import { trackProductDiscovery } from "@/lib/productDiscovery";
import { ANALYTICS_CONSENT_CHANGED } from "@/lib/analyticsConsent";
import { trackGA4Event } from "@/lib/marketingAnalytics";
import { trackView } from "@/hooks/useBatchedViewTracking";
import { useProductSEO } from "@/hooks/useSEO";
import { getProductPath } from "@/lib/productUrls";
import { useResolvedPolicies } from "@/hooks/useResolvedPolicies";
import { countryName } from "@/lib/countries";
import { getProductFactEntries } from "@/lib/cataloguePresentation";
import { formatVariantAttributeLabel, getProductDetailFactKeys, getProductSurface, getVariantAttributeOrder, getVariantSelectionDescription } from "@/lib/productDetailPresentation";

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addItem, beginDirectCheckout, totalItems, setIsOpen: setCartOpen } = useCart();
  const { user, role } = useAuth();
  const { formatPrice, country: preferredCountry } = useCurrency();
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
  const ga4ViewedProductRef = useRef<string | null>(null);
  const productViewRef = useRef<string | null>(null);
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
    category: categoryQuery,
    soldCount: soldCountQuery,
    docs: docsQuery,
    variants: variantsQuery,
    reviews: reviewsQuery,
    keywords: keywordsQuery,
    sellerFollowerCount: sellerFollowerQuery,
    sellerAvgRating,
    sellerTotalSold,
    error: productDetailError,
    secondaryError: productDetailSecondaryError,
    retry: retryProductDetail,
    loading,
  } = useProductDetailData(id);

  const product = productQuery.data ?? null;
  // Seller profile data enriches the buy box but is not required to render or
  // purchase an approved product. Keep a neutral identity fallback when that
  // optional profile request is unavailable; never invent a seller name or
  // verification state.
  const seller = useMemo(() => sellerQuery.data ?? (product ? {
    user_id: product.seller_id,
    full_name: null,
    is_verified: false,
    avatar_url: null,
  } : null), [product, sellerQuery.data]);
  const category = categoryQuery.data ?? null;
  const soldCount = soldCountQuery.data ?? 0;
  const productDocs = docsQuery.data ?? [];
  const productVariants = useMemo(() => variantsQuery.data ?? [], [variantsQuery.data]);
  const reviews = useMemo(() => reviewsQuery.data ?? [], [reviewsQuery.data]);
  const keywords = keywordsQuery.data ?? [];
  const sellerFollowers = sellerFollowerQuery.data ?? 0;
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
    if (!product) return;
    const trackProductView = () => {
      if (ga4ViewedProductRef.current === product.id) return;
      const sent = trackGA4Event("view_item", {
        currency: product.currency || "NGN",
        value: product.price,
        items: [{
          item_id: product.id,
          item_name: product.title,
          price: product.price,
          quantity: 1,
          ...(product.brand ? { item_brand: product.brand } : {}),
        }],
      });
      if (sent) ga4ViewedProductRef.current = product.id;
    };
    trackProductView();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED, trackProductView);
    return () => window.removeEventListener(ANALYTICS_CONSENT_CHANGED, trackProductView);
  }, [product]);

  useEffect(() => {
    if (id) addRecent(id);
  }, [id, addRecent]);

  useEffect(() => {
    if (!id) return;
    // React StrictMode and auth hydration can run this effect more than once.
    // A product view is a page-session event, so keep one write per product
    // visit instead of inflating analytics when the viewer changes from
    // anonymous to authenticated or the tree is replayed in development.
    if (productViewRef.current === id) return;
    productViewRef.current = id;
    trackView(id, user?.id ?? null);
  }, [id, user?.id]);

  const hasProductVariants = productVariants.length > 0;
  const productSurface = useMemo(
    () => getProductSurface(category?.slug, getProductType(product?.variants)?.key),
    [category?.slug, product?.variants],
  );
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
  const inStockVariants = useMemo(
    () => productVariants.filter((variant) => variant.is_active && variant.stock_quantity > 0),
    [productVariants],
  );
  const variantChoiceKeys = useMemo(() => {
    const keys = new Set<string>();
    [...variantAttributeKeys].forEach((key) => {
      const values = new Set(inStockVariants.map((variant) => variant.option_values[key]).filter(Boolean));
      if (values.size > 1) keys.add(key);
    });
    return keys;
  }, [inStockVariants, variantAttributeKeys]);
  const variantSelectionLabel = useMemo(() => {
    const orderedKeys = [
      ...getVariantAttributeOrder(productSurface),
      ...variantChoiceKeys,
    ].filter((key, index, keys) => keys.indexOf(key) === index && variantChoiceKeys.has(key));
    const labels = orderedKeys.map(formatVariantAttributeLabel).map((label) => label.toLowerCase());
    if (labels.length <= 1) return labels[0] || "options";
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }, [productSurface, variantChoiceKeys]);
  const productDetailSpecs = useMemo(() => {
    if (!product) return null;
    const productType = getProductType(product.variants);
    const productTypeConfig = findProductTypeConfig(category, productType?.key);
    const labels = Object.fromEntries(productTypeConfig.fields.map((field) => [field.key, field.label]));
    const variantKeys = new Set([...variantAttributeKeys].map((key) => key.toLowerCase()));
    const details: Record<string, string> = {};
    const facts = getProductFactEntries({
      attributes: getCategoryAttributes(product.variants),
      topLevel: { brand: product.brand, color: product.color, condition: product.condition },
      labels,
      // Variant values belong to the purchase sheet. Keep fixed listing facts
      // here so every technical fact is rendered once, below the purchase flow.
      keys: getProductDetailFactKeys(productSurface).filter((key) => !variantKeys.has(key.toLowerCase())),
      limit: 20,
    });
    facts.forEach((fact) => { details[fact.label] = fact.value; });

    Object.entries(getCategoryAttributes(product.variants)).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      if (variantKeys.has(normalizedKey) || normalizedKey === "categorygroup" || normalizedKey === "producttypekey" || !value?.trim()) return;
      const label = labels[key] ?? key;
      if (!details[label]) details[label] = value.trim();
    });
    const addDetail = (label: string, value: string | null | undefined) => {
      if (value?.trim() && !details[label]) details[label] = value.trim();
    };
    addDetail("Material", product.material);
    addDetail("Dimensions", product.dimensions);
    addDetail("Weight", product.weight);
    // Warranty is presented once in the purchase-service policy rows above;
    // do not repeat it in the long specification table.
    return Object.keys(details).length > 0 ? details : null;
  }, [category, product, productSurface, variantAttributeKeys]);
  const selectedVariant = hasProductVariants
    ? (variantAttributeKeys.size > 0 && [...variantAttributeKeys].every((key) => selectedVariantOptions[key])
      ? productVariants.find((variant) =>
          variant.is_active &&
          [...variantAttributeKeys].every((key) => variant.option_values[key] === selectedVariantOptions[key]),
        ) ?? null
      : variantChoiceKeys.size === 0
        ? inStockVariants[0] ?? productVariants.find((variant) => variant.is_active) ?? null
        : null)
    : (productVariants.find(variant =>
        variant.is_active &&
        (!selectedSize || variant.option_values.size === selectedSize) &&
        (!selectedColor || variant.option_values.color === selectedColor) &&
        (!variant.option_values.size || !!selectedSize) && (!variant.option_values.color || !!selectedColor)
      ) ?? null);
  const hasInStockVariant = inStockVariants.length > 0;
  const purchasableStock = selectedVariant
    ? selectedVariant.stock_quantity
    : hasProductVariants
      ? 0
      : (product?.stock_quantity ?? 0);
  const purchasablePrice = selectedVariant?.price ?? product?.price ?? 0;
  const canPurchase = Boolean(
    product &&
    purchasableStock > 0 &&
    (hasProductVariants
      ? Boolean(selectedVariant)
      : (!variantSizes.length || Boolean(selectedSize)) && (!variantColors.length || Boolean(selectedColor))),
  );
  const requiresOptionSelection = hasProductVariants
    ? !selectedVariant
    : (variantSizes.length > 0 && !selectedSize) || (variantColors.length > 0 && !selectedColor);
  const inventoryAvailable = hasProductVariants
    ? hasInStockVariant
    : (product?.stock_quantity ?? 0) > 0;
  const purchaseButtonLabel = !inventoryAvailable
    ? "Out of stock"
    : requiresOptionSelection
      ? "Choose options"
      : "Add to Cart";
  // An incomplete variant selection is an actionable state: the button opens
  // the selector sheet. Only a genuinely unavailable product/SKU is disabled.
  const purchaseDisabled = requiresOptionSelection ? !inventoryAvailable : !canPurchase;
  const deliveryDestination = preferredCountry ? countryName(preferredCountry) : null;
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
    description: product?.description || undefined,
    metaDescription: product?.meta_description,
    id: product?.id || id || "",
    availability: (hasProductVariants ? hasInStockVariant : (product?.stock_quantity ?? 0) > 0) ? "InStock" : "OutOfStock",
    rating: product?.average_rating,
    reviewCount: product?.review_count,
    brand: product?.brand,
    gtin: product?.gtin,
    mpn: product?.mpn,
    condition: product?.condition,
    slug: product?.seo_slug,
  });

  useEffect(() => {
    if (!product || !id || !product.seo_slug) return;
    const preferredPath = getProductPath(product);
    if (window.location.pathname !== preferredPath) {
      window.history.replaceState({}, "", preferredPath);
    }
  }, [id, product]);
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
    const seenImageUrls = new Set<string>();
    // If a variant with its own image is selected, show that image first (AliExpress behavior)
    if (selectedVariant?.image_url?.trim()) {
      const url = selectedVariant.image_url.trim();
      seenImageUrls.add(url);
      list.push({ type: "image", url, id: `variant-${selectedVariant.id}` });
    }
    productVideos.forEach((vurl, idx) => {
      list.push({ type: "video", url: vurl, id: `video-${idx}` });
    });
    images.forEach((img) => {
      const url = img.image_url.trim();
      if (seenImageUrls.has(url)) return;
      seenImageUrls.add(url);
      list.push({ type: "image", url, id: img.id });
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

  const detailsRef = useRef<HTMLDivElement>(null);
  const specificationsRef = useRef<HTMLDivElement>(null);
  const reviewsRef = useRef<HTMLDivElement>(null);
  const qaRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"details" | "specifications" | "reviews" | "qa">("details");

  useEffect(() => {
    setReviewFilter("all");
    setActiveTab("details");
  }, [id, product?.id]);

  useEffect(() => {
    const sections = [
      { id: "product-specifications", tab: "specifications" as const, element: specificationsRef.current },
      { id: "product-reviews", tab: "reviews" as const, element: reviewsRef.current },
      { id: "qa", tab: "qa" as const, element: qaRef.current },
    ].filter((section): section is typeof section & { element: HTMLDivElement } => Boolean(section.element));

    if (sections.length === 0 || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];

        if (!visible) return;
        const section = sections.find((candidate) => candidate.element === visible.target);
        if (section) setActiveTab(section.tab);
      },
      { rootMargin: "-88px 0px -58% 0px", threshold: [0, 0.1] },
    );

    sections.forEach((section) => observer.observe(section.element));
    return () => observer.disconnect();
  }, [product?.id, product?.description_images?.length]);

  useEffect(() => {
    setSelectedVariantOptions({});
    setQuantity(1);
    setPurchaseAction(null);
  }, [product?.id]);

  useEffect(() => {
    // Keep an explicitly shared SKU link reproducible, but do not silently
    // choose a colour/storage combination on a normal product visit. Buyers
    // should see the parent product first and choose the exact SKU at purchase.
    if (!hasProductVariants || variantAttributeKeys.size === 0 || !searchParams.get("variant")) return;
    const requestedVariantId = searchParams.get("variant");
    const requestedVariant = requestedVariantId
      ? productVariants.find((variant) => variant.id === requestedVariantId && variant.is_active)
      : undefined;
    const defaultVariant = requestedVariant
      ?? productVariants.find((variant) => variant.is_active && variant.stock_quantity > 0)
      ?? productVariants.find((variant) => variant.is_active);
    if (!defaultVariant) return;

    setSelectedVariantOptions(
      Object.fromEntries(
        [...variantAttributeKeys]
          .filter((key) => defaultVariant.option_values[key])
          .map((key) => [key, defaultVariant.option_values[key]]),
      ),
    );
  }, [hasProductVariants, product?.id, productVariants, variantAttributeKeys, searchParams]);

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
    toast.success("Review submitted");
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
      trackGA4Event("add_to_cart", {
        currency: product.currency || "NGN",
        value: purchasablePrice * quantity,
        items: [{
          item_id: product.id,
          item_name: product.title,
          price: purchasablePrice,
          quantity,
          ...(product.brand ? { item_brand: product.brand } : {}),
        }],
      });
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
    // Keep the exact-SKU picker behind the purchase action. Once a purchasable
    // SKU is selected, the same action completes without reopening the sheet.
    if (requiresOptionSelection) {
      setPurchaseAction(action);
      return;
    }
    completePurchase(action);
  }, [product, user, requiresOptionSelection, completePurchase]);

  const shareProduct = useCallback(async () => {
    if (!product) return;
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: product.title, url });
      } else {
        await navigator.clipboard?.writeText(url);
        toast.success("Product link copied");
      }
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") toast.error("Could not share this product");
    }
  }, [product]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-[calc(72px+env(safe-area-inset-bottom,0px))] text-[#111111] dark:bg-[#121212] dark:text-[#FAF5F2] md:pb-24">
      <div className="hidden md:block">
        <MarketplaceNavbar showTrending={false} />
      </div>
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[#E8E8E8] bg-white/95 px-4 py-3 backdrop-blur-md dark:border-[#222222] dark:bg-[#111111]/95 md:hidden">
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="grid h-10 w-10 place-items-center rounded-full text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Link to="/" aria-label="Tradibu home" className="select-none text-lg font-black tracking-tighter">
          tradi<span className="text-[#9E6300] dark:text-[#F6C75D]">bu</span>
        </Link>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => product && toggleWishlist(product.id)}
            aria-label={product && isWishlisted(product.id) ? "Remove from wishlist" : "Add to wishlist"}
            className={`grid h-10 w-10 place-items-center rounded-full transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222] ${product && isWishlisted(product.id) ? "text-[#E53935]" : "text-[#111111] dark:text-[#FAF5F2]"}`}
          >
            <Heart className={`h-5 w-5 ${product && isWishlisted(product.id) ? "fill-current" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => void shareProduct()}
            aria-label="Share product"
            className="grid h-10 w-10 place-items-center rounded-full text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            aria-label={`Open cart${totalItems > 0 ? `, ${totalItems} items` : ""}`}
            className="relative grid h-10 w-10 place-items-center rounded-full text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
          >
            <ShoppingCart className="h-5 w-5" />
            {totalItems > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#E53935] px-1 text-[9px] font-bold text-white">{totalItems > 99 ? "99+" : totalItems}</span>}
          </button>
        </div>
      </header>
      <CartDrawer />
      <main>
          <Container className="py-4 sm:py-6">
        {product && productDetailSecondaryError && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F3D7A6] bg-[#FFF8E8] px-4 py-3 text-xs text-[#7C4A03] dark:border-[#5B421B] dark:bg-[#2A2111] dark:text-[#F8D48A]" role="status">
            <span>Some seller or option details are temporarily unavailable. The product can still be viewed; retry to refresh them.</span>
            <button
              type="button"
              onClick={() => void retryProductDetail()}
              className="min-h-10 rounded-full border border-current px-4 font-semibold transition hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-white/5"
            >
              Retry details
            </button>
          </div>
        )}
        {loading && !product ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-pulse">
            <div className="aspect-square bg-[#F2F3F5] dark:bg-[#202020] rounded-2xl" />
            <div className="space-y-4">
              <div className="h-6 bg-[#F2F3F5] dark:bg-[#202020] rounded w-3/4" />
              <div className="h-8 bg-[#F2F3F5] dark:bg-[#202020] rounded w-1/3" />
              <div className="h-20 bg-[#F2F3F5] dark:bg-[#202020] rounded" />
            </div>
          </div>
        ) : productDetailError && !product && !isProductNotFoundError(productDetailError) ? (
          <div className="mx-auto max-w-xl py-20 text-center" role="alert">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-full bg-[#FFF4E8] text-[#C2410C] dark:bg-[#3A2112] dark:text-[#FDBA74]">
              <Package className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 className="text-xl font-bold tracking-tight">This product is temporarily unavailable</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#6E6C64] dark:text-[#A0A0A0]">
              We could not load the latest product information. Your account and order data were not changed.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => void retryProductDetail()}
                className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#111111] px-5 text-sm font-semibold text-white transition hover:bg-[#2D2D2D] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#FAF5F2] dark:text-[#111111]"
              >
                Try again
              </button>
              <Link
                to="/marketplace"
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#D9D6D0] bg-white px-5 text-sm font-semibold text-[#111111] transition hover:bg-[#F8F3F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:border-[#3B3B3B] dark:bg-transparent dark:text-[#FAF5F2] dark:hover:bg-[#1E1E1E]"
              >
                Browse marketplace
              </Link>
            </div>
          </div>
        ) : !product ? (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-[#6E6C64]/30 mb-4" />
            <h2 className="text-lg font-bold">Product not found</h2>
            <p className="text-sm text-[#6E6C64] mt-2">This product may have been removed or is unavailable.</p>
            <Link to="/marketplace" className="inline-block mt-6 px-6 py-2.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] text-xs font-bold">
              Browse Marketplace
            </Link>
          </div>
        ) : (
          <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(360px,0.92fr)] lg:gap-10">
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
                              <ProductImage variant="detail" src={item.url} alt={product.title} className="group-hover:scale-105" loading={index === 0 ? "eager" : "lazy"} fetchPriority={index === 0 ? "high" : "auto"} />
                              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                              </div>
                            </>
                          )}
                          {user && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleWishlist(product.id); }}
                              className={`absolute top-3 right-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/90 dark:bg-[#1E1E1E]/90 shadow-sm backdrop-blur transition-colors ${isWishlisted(product.id) ? "text-[#E53935]" : "text-[#6E6C64] dark:text-[#A0A0A0] hover:text-[#E53935]"}`}
                              aria-label={isWishlisted(product.id) ? "Remove from wishlist" : "Add to wishlist"}
                            >
                              <Heart className={`h-4 w-4 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                            </button>
                          )}
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {mediaItems.length > 1 && (
                    <>
                      <button type="button" onClick={(event) => { event.stopPropagation(); carouselApi?.scrollPrev(); }} className="absolute left-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#111111] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#1E1E1E]/90 dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2A]" aria-label="Previous product image">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); carouselApi?.scrollNext(); }} className="absolute right-3 top-1/2 z-10 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-[#111111] shadow-sm backdrop-blur transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:bg-[#1E1E1E]/90 dark:text-[#FAF5F2] dark:hover:bg-[#2A2A2A]" aria-label="Next product image">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </Carousel>
              )}
              {mediaItems.length > 1 && (
                <div className="flex gap-2 mt-3 overflow-x-auto pb-1">
                  {mediaItems.map((item, idx) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setSelectedImage(idx)}
                      className={`shrink-0 w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${idx === selectedImage ? "border-[#111111] ring-2 ring-[#111111]/20 dark:border-[#FAF5F2] dark:ring-[#FAF5F2]/20 scale-[1.05]" : "border-transparent hover:border-[#C8C8C0] dark:hover:border-[#444444]"}`}
                      aria-label={item.type === "video"
                        ? `Show product video ${idx + 1} of ${mediaItems.length}: ${product.title}`
                        : `Show product image ${idx + 1} of ${mediaItems.length}: ${product.title}`}
                      aria-pressed={idx === selectedImage}
                    >
                      {item.type === "video" ? (
                        <div className="relative w-full h-full bg-[#F2F3F5] dark:bg-[#202020] flex items-center justify-center">
                          <Play className="h-4 w-4 text-[#6E6C64]" />
                        </div>
                      ) : (
                        <ProductImage variant="thumb" src={item.url} alt={`${product.title} image ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

              <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
                <section aria-labelledby="product-title">
                  {/* The buy box follows the marketplace reading order: condition, title, proof, price, action. */}
                  <div className="flex items-center justify-between gap-3">
                    {product.condition ? (
                      <span className="inline-flex rounded-md border border-[#E8E8E2] bg-[#F7F7F3] px-2 py-1 text-[10px] font-semibold capitalize text-[#5F5D55] dark:border-[#333333] dark:bg-[#1E1E1E] dark:text-[#D8D5C8]">
                        {product.condition} condition
                      </span>
                   ) : <span aria-hidden="true" />}
                   <button type="button" onClick={() => void shareProduct()} className="hidden h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E8E8E8] text-[#6E6C64] transition hover:border-[#111111] hover:text-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:border-[#333333] dark:hover:border-[#FAF5F2] dark:hover:text-[#FAF5F2] md:grid" aria-label="Share product">
                     <Share2 className="h-4 w-4" />
                   </button>
                 </div>
                  <div className="mt-3 flex items-start">
                    <h1 id="product-title" className={`min-w-0 flex-1 text-[1.05rem] font-semibold leading-[1.32] tracking-[-0.005em] text-[#171717] dark:text-[#FAF5F2] sm:text-[1.12rem] lg:text-[1.22rem] ${!titleExpanded ? "line-clamp-3" : ""}`}>{product.title || "Untitled product"}</h1>
                  </div>
                 {(product.title ?? "").length > 90 && (
                   <button type="button" onClick={() => setTitleExpanded(e => !e)} className="mt-1 text-xs font-semibold text-[#111111] underline dark:text-[#FAF5F2]">
                     {titleExpanded ? "Show less" : "Read full title"}
                   </button>
                 )}

                 {/* Only show facts the marketplace has actually earned. */}
                 {(seller?.full_name || seller?.is_verified || product.review_count > 0 || (product.show_sold_count !== false && soldCount > 0)) && (
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#6E6C64] dark:text-[#A0A0A0]">
                      {seller?.full_name && <span>Sold by <span className="font-semibold text-[#111111] dark:text-[#FAF5F2]">{seller.full_name}</span></span>}
                     {seller?.is_verified && (
                       <span className="flex items-center gap-1 font-semibold text-[#16803C] dark:text-[#5EE38B]"><CheckCircle2 className="h-3.5 w-3.5" />Verified seller</span>
                     )}
                     {product.review_count > 0 && (
                       <span className="inline-flex items-center gap-1 font-semibold text-[#111111] dark:text-[#FAF5F2]"><Star className="h-3.5 w-3.5 fill-[#F6C75D] text-[#C99600]" />{(product.average_rating ?? 0).toFixed(1)} <span className="font-normal text-[#6E6C64] dark:text-[#A0A0A0]">({product.review_count} reviews)</span></span>
                     )}
                     {product.show_sold_count !== false && soldCount > 0 && <span>{soldCount} sold</span>}
                   </div>
                 )}

                  <div className="mt-3 rounded-2xl border border-[#E6E4DC] bg-[#FAFAF7] px-3.5 py-3 dark:border-[#333333] dark:bg-[#1A1A1A]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#77746A] dark:text-[#B7B3A7]">{hasProductVariants && !selectedVariant ? "Starting price" : "Price"}</p>
                        <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="text-[1.3rem] font-bold leading-none tracking-[-0.02em] text-[#111111] dark:text-[#FAF5F2] sm:text-[1.4rem] lg:text-[1.5rem]">{hasProductVariants && !selectedVariant ? `From ${formatPrice(startingVariantPrice ?? purchasablePrice)}` : formatPrice(purchasablePrice)}</span>
                          {product.compare_at_price && product.compare_at_price > product.price && !hasProductVariants && (
                            <>
                              <span className="text-xs font-medium text-[#77746A] line-through dark:text-[#B7B3A7]">{formatPrice(product.compare_at_price)}</span>
                              <span className="rounded-md bg-[#FFF0C2] px-1.5 py-0.5 text-[10px] font-bold text-[#705300] dark:bg-[#3A3014] dark:text-[#F6D96D]">-{Math.round((1 - product.price / product.compare_at_price) * 100)}%</span>
                            </>
                          )}
                        </div>
                        {hasProductVariants && !selectedVariant ? (
                        <p className="mt-1 text-[10px] leading-4 text-[#77746A] dark:text-[#B7B3A7]">Choose options at purchase to see the exact price, stock, and matching image.</p>
                        ) : selectedVariant ? (
                          <p className="mt-1 text-[10px] font-semibold text-[#5F5D55] dark:text-[#D8D5C8]" aria-live="polite">Selected: {Object.entries(selectedVariant.option_values).map(([key, value]) => `${formatVariantAttributeLabel(key)}: ${value}`).join(" / ")}</p>
                        ) : null}
                     </div>
                     <div className="shrink-0 text-right text-xs font-semibold">
                       {!inventoryAvailable ? <span className="text-[#B42318]">Out of stock</span> : selectedVariant || !hasProductVariants ? (
                         <span className={purchasableStock <= (product.low_stock_threshold ?? 5) ? "text-[#B42318]" : "text-[#16803C]"}>{purchasableStock <= (product.low_stock_threshold ?? 5) ? `Only ${purchasableStock} left` : "In stock"}</span>
                       ) : <span className="text-[#16803C]">In stock</span>}
                     </div>
                   </div>
                 </div>
               </section>

            {!hasProductVariants && (
              <>
                {variantSizes.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2">Size: <span className="font-normal text-[#6E6C64]">{selectedSize || "Select"}</span></p>
                    <div className="flex flex-wrap gap-2">
                      {variantSizes.map(size => (
                        <button
                          key={size}
                          type="button"
                          disabled={!hasAvailableVariant(size, selectedColor || undefined)}
                          onClick={() => setSelectedSize(size)}
                          aria-pressed={selectedSize === size}
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
                    <p className="text-xs font-bold mb-2">Color: <span className="font-normal text-[#6E6C64]">{selectedColor || "Select"}</span></p>
                    <div className="flex flex-wrap gap-2">
                      {variantColors.map(color => (
                        <button
                          key={color}
                          type="button"
                          disabled={!hasAvailableVariant(selectedSize || undefined, color)}
                          onClick={() => setSelectedColor(color)}
                          aria-pressed={selectedColor === color}
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

            <div className="flex flex-wrap items-end gap-4">
              {(!hasProductVariants || selectedVariant) && (
              <div className="shrink-0">
                <span className="mb-1.5 block text-xs font-bold text-[#111111] dark:text-[#FAF5F2]">Quantity</span>
                <div className="flex items-center overflow-hidden rounded-xl border border-[#E8E8E8] dark:border-[#222222]" aria-label="Quantity">
                  <button type="button" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={!canPurchase || quantity <= 1} aria-label="Decrease quantity" className="flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-bold transition-colors hover:bg-[#F2F3F5] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#2A2A2D]">−</button>
                  <span className="flex h-10 w-12 items-center justify-center border-x border-[#E8E8E8] text-sm font-semibold dark:border-[#222222]" aria-live="polite">{quantity}</span>
                  <button type="button" onClick={() => setQuantity(q => Math.min(purchasableStock, q + 1))} disabled={!canPurchase || quantity >= purchasableStock} aria-label="Increase quantity" className="flex min-h-[44px] min-w-[44px] items-center justify-center text-sm font-bold transition-colors hover:bg-[#F2F3F5] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-[#2A2A2D]">+</button>
                </div>
              </div>
              )}
              <div className="flex min-w-0 flex-1 gap-3">
                <button
                  type="button"
                  onClick={() => startPurchase("cart")}
                  disabled={purchaseDisabled}
                  className="min-w-0 flex-1 rounded-full bg-[#111111] py-3 text-sm font-bold text-white transition-colors hover:bg-[#2A2A2A] disabled:opacity-50 dark:bg-[#FAF5F2] dark:text-[#111111] dark:hover:bg-[#EAE0D8]"
                >
                  {purchaseButtonLabel}
                </button>
                <button
                  type="button"
                  onClick={() => startPurchase("buy")}
                  disabled={purchaseDisabled}
                  className="hidden min-w-0 flex-1 rounded-full border border-brand bg-brand py-3 text-sm font-bold text-ink transition-colors hover:bg-brand-dark disabled:opacity-50 md:block"
                >
                  Buy Now
                </button>
              </div>
            </div>

            {user && user.id !== product.seller_id && canPurchase && (
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

            <div className="space-y-2 border-t border-[#E8E8E8] pt-3 dark:border-[#222222]">
              {policiesLoading && <p className="px-1 text-xs text-[#6E6C64]">Loading policy information...</p>}
              {policiesError && <p className="px-1 text-xs text-[#6E6C64]">Policy information is unavailable.</p>}
              <button type="button" onClick={() => setServiceSheet("shipping")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222]">
                <Truck className="h-4 w-4 shrink-0 text-[#666666] dark:text-[#A0A0A0]" />
                <span className="min-w-0 flex-1"><span className="block text-xs font-semibold text-[#111111] dark:text-[#FAF5F2]">Shipping{deliveryDestination ? ` to ${deliveryDestination}` : ""}</span><span className="block truncate text-xs text-[#6E6C64]">{policies.shipping?.summary ?? "Choose a destination at checkout to confirm delivery cost and timing"}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#6E6C64]" />
              </button>
              <button type="button" onClick={() => setServiceSheet("returns")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-xs text-[#6E6C64] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222] ${!policies.returns ? "hidden" : ""}`}>
                <Shield className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#111111] dark:text-[#FAF5F2]">Returns & refunds</span><span className="block truncate">{policies.returns?.summary}</span></span>{/*
                <span>Buyer protection - full refund if not as described</span>
                */}<ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              <button type="button" onClick={() => setServiceSheet("protection")} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-xs text-[#6E6C64] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222] ${!policies.protection ? "hidden" : ""}`}>
                <Shield className="h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1"><span className="block font-semibold text-[#111111] dark:text-[#FAF5F2]">Buyer protection</span><span className="block truncate">{policies.protection?.summary}</span></span>
                <ChevronRight className="h-4 w-4 shrink-0" />
              </button>
              {policies.warranty && (
                <button type="button" onClick={() => setServiceSheet("warranty")} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-1 text-left text-xs text-[#6E6C64] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:hover:bg-[#222222]">
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
                reviewCount={product.review_count}
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
            <nav aria-label="Product information" className="sticky top-[57px] z-20 mt-8 flex snap-x gap-2 overflow-x-auto border-y border-[#E8E8E8] bg-[#FAFAFA]/95 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden dark:border-[#2A2A2A] dark:bg-[#171717]/95 md:top-[73px]">
             <a
               href="#product-details"
               onClick={() => setActiveTab("details")}
               aria-current={activeTab === "details" ? "location" : undefined}
               className={`min-h-10 shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] ${activeTab === "details" ? "bg-[#111111] text-white shadow-sm dark:bg-[#FAF5F2] dark:text-[#111111]" : "hover:bg-white hover:shadow-sm dark:hover:bg-[#222222]"}`}
             >
                Details
              </a>
              <a
                href="#product-specifications"
                onClick={() => setActiveTab("specifications")}
                aria-current={activeTab === "specifications" ? "location" : undefined}
                className={`min-h-10 shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] ${activeTab === "specifications" ? "bg-[#111111] text-white shadow-sm dark:bg-[#FAF5F2] dark:text-[#111111]" : "hover:bg-white hover:shadow-sm dark:hover:bg-[#222222]"}`}
              >
                Specifications
              </a>
             <a
               href="#product-reviews"
               onClick={() => setActiveTab("reviews")}
               aria-current={activeTab === "reviews" ? "location" : undefined}
               className={`min-h-10 shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] ${activeTab === "reviews" ? "bg-[#111111] text-white shadow-sm dark:bg-[#FAF5F2] dark:text-[#111111]" : "hover:bg-white hover:shadow-sm dark:hover:bg-[#222222]"}`}
             >
               Reviews{product.review_count > 0 ? ` (${product.review_count})` : ""}
             </a>
             <a
               href="#qa"
               onClick={() => setActiveTab("qa")}
               aria-current={activeTab === "qa" ? "location" : undefined}
               className={`min-h-10 shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] ${activeTab === "qa" ? "bg-[#111111] text-white shadow-sm dark:bg-[#FAF5F2] dark:text-[#111111]" : "hover:bg-white hover:shadow-sm dark:hover:bg-[#222222]"}`}
             >
               Questions & Answers
             </a>
           </nav>
           </>
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
              <SheetTitle>{serviceSheet ? policies[serviceSheet]?.title ?? (serviceSheet === "shipping" ? "Shipping" : "") : ""}</SheetTitle>
              <SheetDescription>
                {serviceSheet
                  ? policies[serviceSheet]?.detail ?? (serviceSheet === "shipping"
                    ? "Delivery cost and timing have not been provided for this listing. Contact the seller to confirm them before ordering."
                    : "")
                  : ""}
              </SheetDescription>
            </SheetHeader>
            {serviceSheet && policies[serviceSheet] && <p className="mt-4 text-xs font-semibold text-[#6E6C64]">{sourceLabel(policies[serviceSheet].source)} / Last updated {policies[serviceSheet].updatedAt ? new Date(policies[serviceSheet].updatedAt).toLocaleDateString() : "not available"}</p>}
          </SheetContent>
        </Sheet>

        {product && (
          <div id="product-details" ref={detailsRef} className="mt-12 space-y-6 scroll-mt-32">
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
              specificationsRef={specificationsRef}
            />

            {productDocs.length > 0 && (
              <section className="rounded-xl border border-[#E8E8E8] bg-white p-4 dark:border-[#222222] dark:bg-[#1A1A1A]" aria-labelledby="product-documents">
                <h2 id="product-documents" className="text-sm font-bold">Documents</h2>
                <div className="mt-3 space-y-2">
                  {productDocs.map((document: ProductDoc) => (
                    <a key={document.id} href={document.url} target="_blank" rel="noreferrer" className="flex items-center justify-between gap-3 rounded-lg border border-[#E8E8E8] px-3 py-2 text-sm font-semibold hover:bg-[#F2F3F5] dark:border-[#333333] dark:hover:bg-[#222222]">
                      <span className="flex min-w-0 items-center gap-2"><FileText className="h-4 w-4 shrink-0 text-[#6E6C64]" /><span className="truncate">{document.label || "Product document"}</span></span>
                      <span className="text-xs text-[#6E6C64]">Open</span>
                    </a>
                  ))}
                </div>
              </section>
            )}

            <div id="product-reviews" ref={reviewsRef} className="scroll-mt-32">
              <h2 className="mb-3 text-lg font-bold text-[#111111] dark:text-[#FAF5F2]">Customer reviews</h2>
              {reviewsQuery.isLoading && <div className="space-y-3 animate-pulse"><div className="h-5 w-24 rounded bg-[#F2F3F5] dark:bg-[#202020]" /><div className="h-20 rounded-xl bg-[#F2F3F5] dark:bg-[#202020]" /></div>}
              {!reviewsQuery.isLoading && reviews.length === 0 && <div className="flex min-h-11 items-center justify-between gap-3 border-y border-[#E8E8E8] py-3 dark:border-[#222222]"><div><p className="text-xs text-[#6E6C64]">No reviews yet</p></div>{user && canReview && !alreadyReviewed && <button type="button" onClick={() => setReviewFormOpen(true)} className="min-h-11 rounded-full border border-[#111111] px-4 text-xs font-bold dark:border-[#FAF5F2]">Be the first to review</button>}</div>}
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
                      <label className="flex items-center gap-2 text-xs text-[#6E6C64] cursor-pointer hover:text-[#111111] dark:hover:text-[#FAF5F2] transition-colors">
                        <ImagePlus className="h-4 w-4" />
                        Add photos
                        <input type="file" accept="image/*" multiple className="hidden" onChange={e => setReviewPhotoFiles(Array.from(e.target.files || []))} />
                      </label>
                      {reviewPhotoFiles.length > 0 && (
                        <span className="text-xs text-[#6E6C64]">{reviewPhotoFiles.length} selected</span>
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

            <div id="qa" ref={qaRef} className="scroll-mt-32">
              <QAndASection productId={product.id} />
            </div>

            <div>
              <RecommendedProducts productId={product.id} categoryId={product.category_id} />
            </div>

            <RecentlyViewed excludeId={product.id} />
          </div>
        )}
      </Container>
      </main>
      <SiteFooter />

      {/* Sticky mobile CTA bar - the ONLY bottom bar on this route (tab bar not mounted here): Store/Chat/Cart outline icons with labels, Add to Cart outlined pill, Buy Now brand pill */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#E8E8E8] bg-white pb-[env(safe-area-inset-bottom,0px)] dark:border-[#222222] dark:bg-[#111111] md:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-1.5 px-4 py-1.5">
          <button
            type="button"
            onClick={() => product && navigate(`/seller/${product.seller_id}`)}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
            aria-label="Visit store"
          >
            <Store className="h-5 w-5" />
            <span className="text-[9px] font-medium leading-none text-[#6E6C64] dark:text-[#A0A0A0]">Store</span>
          </button>
          <button
            type="button"
            onClick={() => product && navigate(`${chatPath}?seller=${product.seller_id}&product=${product.id}`)}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
            aria-label="Chat with seller"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="text-[9px] font-medium leading-none text-[#6E6C64] dark:text-[#A0A0A0]">Chat</span>
          </button>
          <button
            type="button"
            onClick={() => setCartOpen(true)}
            className="flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-0.5 rounded-lg text-[#111111] transition-colors hover:bg-[#F2F3F5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C75D] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
            aria-label={`Open cart${totalItems > 0 ? `, ${totalItems} items` : ""}`}
          >
            <span className="relative">
              <ShoppingCart className="h-5 w-5" />
              {totalItems > 0 && (
                <span className="absolute -right-1.5 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[#E53935] px-1 text-[9px] font-bold text-white">
                  {totalItems > 99 ? "99+" : totalItems}
                </span>
              )}
            </span>
            <span className="text-[9px] font-medium leading-none text-[#6E6C64] dark:text-[#A0A0A0]">Cart</span>
          </button>
          <button
            type="button"
            onClick={() => startPurchase("cart")}
            disabled={purchaseDisabled}
            className="h-11 min-w-0 flex-1 rounded-full border border-[#111111] bg-transparent px-1 text-[13px] font-bold leading-tight text-[#111111] transition-colors hover:bg-brand-tint hover:text-brand-dark disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#FAF5F2] dark:text-[#FAF5F2] dark:hover:bg-[#222222]"
          >
            {purchaseButtonLabel}
          </button>
          <button
            type="button"
            onClick={() => startPurchase("buy")}
            disabled={purchaseDisabled}
            className="h-11 min-w-0 flex-1 rounded-full bg-brand px-1 text-[13px] font-bold leading-tight text-ink transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            Buy Now
          </button>
        </div>
      </div>
      <Sheet open={purchaseAction !== null} onOpenChange={(open) => { if (!open) setPurchaseAction(null); }}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl border-[#E8E8E8] bg-white px-5 pb-6 pt-5 dark:border-[#222222] dark:bg-[#111111] sm:mx-auto sm:max-w-xl">
          <SheetHeader className="pr-8 text-left">
            <SheetTitle>Choose {variantSelectionLabel}</SheetTitle>
            <SheetDescription>{getVariantSelectionDescription(productSurface)}</SheetDescription>
          </SheetHeader>
          {mediaItems.find((item) => item.type === "image")?.url && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl border border-[#E8E8E8] bg-[#FAFAFA] p-3 dark:border-[#222222] dark:bg-[#181818]">
              <ProductImage
                variant="thumb"
                src={mediaItems.find((item) => item.type === "image")?.url || ""}
                alt={product?.title || "Product"}
                className="h-16 w-16 rounded-xl object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{product?.title}</p>
                <p className="mt-1 text-xs text-[#6E6C64]">The image, price, and stock update for the exact SKU you choose.</p>
              </div>
            </div>
          )}
          <div className="mt-5 space-y-5">
            <VariantSelector variants={productVariants} selectedOptions={selectedVariantOptions} onChange={setSelectedVariantOptions} surface={productSurface} />
            <div className="flex items-center justify-between rounded-2xl bg-[#F2F3F5] px-4 py-3 dark:bg-[#1E1E1E]">
              <div>
                <p className="text-xs text-[#6E6C64]">{selectedVariant ? "Selected SKU" : variantChoiceKeys.size === 1 ? "Select an option" : "Select every option"}</p>
                <p className="mt-1 text-lg font-black">{selectedVariant ? formatPrice(purchasablePrice) : `From ${formatPrice(startingVariantPrice ?? purchasablePrice)}`}</p>
              </div>
              <div className="text-right text-xs font-semibold text-[#6E6C64]">
                {selectedVariant ? `${purchasableStock} available` : ""}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm font-semibold">Quantity</span>
              <div className="flex items-center overflow-hidden rounded-xl border border-[#E8E8E8] dark:border-[#222222]">
                <button type="button" onClick={() => setQuantity((current) => Math.max(1, current - 1))} className="flex h-10 w-10 items-center justify-center text-sm font-bold disabled:opacity-40" disabled={!selectedVariant}>-</button>
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
            <ProductImage variant="detail" src={zoomedImage} alt="Zoomed product image" className="max-w-full max-h-[85vh] object-contain rounded-2xl" style={{ transform: `scale(${zoomScale})` }} />
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
