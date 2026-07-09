import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import PromoBanner from "@/components/PromoBanner";
import MarqueeBanner from "@/components/MarqueeBanner";
import SiteFooter from "@/components/SiteFooter";
import headphonesHero from "@/assets/headphones_hero.png";
import tomasAvatar from "@/assets/tomas_avatar.png";
import cardboardBox from "@/assets/cardboard_box.png";
import multicooker from "@/assets/multicooker.png";
import smartwatchHero from "@/assets/smartwatch_hero.png";
import speakerHero from "@/assets/speaker_hero.png";
import catElectronics from "@/assets/cat_electronics.png";
import catFashion from "@/assets/cat_fashion.png";
import catJewelry from "@/assets/cat_jewelry.png";
import catHome from "@/assets/cat_home.png";
import bannerImmersive from "@/assets/banner_immersive.png";
import styleHer from "@/assets/style_her.png";
import styleHim from "@/assets/style_him.png";
import thumbHandbag from "@/assets/thumb_handbag.png";
import thumbShirt from "@/assets/thumb_shirt.png";
import {
  ShoppingCart, Package, CheckCircle2, ArrowRight, Heart,
  Mail, Star, Sparkles, Laptop, Gamepad, Compass, Gift, Award, Send,
  ChevronRight, Paintbrush, Library, UserCheck, User
} from "lucide-react";

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
  product_images: { image_url: string; is_primary: boolean }[];
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

type SellerProfilePublic = Database["public"]["Views"]["seller_profiles_public"]["Row"];

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, { full_name: string | null; is_verified: boolean }>>({});
  const { addItem } = useCart();
  const { user, profile } = useAuth();
  const { isWishlisted, toggleWishlist } = useWishlist();

  useEffect(() => {
    const fetchData = async () => {
      const [productsRes, categoriesRes] = await Promise.all([
        supabase.from("products").select("*, product_images(*)").eq("status", "active").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("sort_order"),
      ]);

      if (productsRes.data) {
        setProducts(productsRes.data as unknown as Product[]);
        const sellerIds = [...new Set(productsRes.data.map(p => p.seller_id))];
        if (sellerIds.length > 0) {
          const { data: profiles } = await supabase.from("seller_profiles_public").select("user_id, full_name, is_verified").in("user_id", sellerIds);
          if (profiles) {
            const map: Record<string, { full_name: string | null; is_verified: boolean }> = {};
            profiles.forEach((p: SellerProfilePublic) => {
              if (p.user_id) map[p.user_id] = { full_name: p.full_name, is_verified: !!p.is_verified };
            });
            setSellerProfiles(map);
          }
        }
      }
      if (categoriesRes.data) setCategories(categoriesRes.data);
      setLoading(false);
    };
    fetchData();
  }, []);

  const filtered = products.filter(p => {
    const matchesSearch = !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = !selectedCategory || p.category_id === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleAddToCart = (product: Product) => {
    const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
    const seller = sellerProfiles[product.seller_id];
    addItem({
      id: product.id,
      title: product.title,
      price: product.price,
      image_url: primaryImage?.image_url || null,
      seller_id: product.seller_id,
      seller_name: seller?.full_name || "Seller",
      stock_quantity: product.stock_quantity,
    });
  };

  // Select a hero product dynamically from the products database, otherwise a placeholder
  const heroProduct = products[0] || null;
  const heroProductImage = heroProduct?.product_images?.find(i => i.is_primary)?.image_url || heroProduct?.product_images?.[0]?.image_url;

  // Helper for generating custom fallback icon per category slug
  const getCategoryIcon = (slug: string) => {
    switch (slug) {
      case "computers-accessories":
      case "electronics":
        return Laptop;
      case "video-games":
      case "gaming":
        return Gamepad;
      case "art":
      case "paintings":
        return Paintbrush;
      case "books":
        return Library;
      case "gifts":
        return Gift;
    }
  };

  const getCategoryMockImage = (slug: string, index: number) => {
    const s = slug.toLowerCase();
    if (s.includes("electronics") || s.includes("computer") || s.includes("tech")) {
      return catElectronics;
    }
    if (s.includes("fashion") || s.includes("apparel") || s.includes("clothing") || s.includes("wear")) {
      return catFashion;
    }
    if (s.includes("jewelry") || s.includes("jewel") || s.includes("ring") || s.includes("necklace")) {
      return catJewelry;
    }
    if (s.includes("home") || s.includes("kitchen") || s.includes("furniture") || s.includes("decor")) {
      return catHome;
    }
    const fallbacks = [catElectronics, catFashion, catJewelry, catHome];
    return fallbacks[index % 4];
  };

  // Helper to render static stars based on string hash for visual design consistency
  const renderStars = (id: string) => {
    const code = id.charCodeAt(0) || 5;
    const rating = (code % 2) === 0 ? 5 : 4;
    return (
      <div className="flex gap-0.5 text-[#F6C75D] text-[13px] my-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i}>{i < rating ? "★" : "☆"}</span>
        ))}
      </div>
    );
  };

  const isSearchOrFilterActive = search !== "" || selectedCategory !== null;

  const [activeSlide, setActiveSlide] = useState(0);

  const heroSlides = [
    {
      title: "SHOP COMPUTERS\n& ACCESSORIES",
      description: "Shop laptops, desktops, monitors, tablets, PC gaming, hard drives and storage, accessories and more",
      image: headphonesHero,
      badge: "50%",
      link: "/marketplace"
    },
    {
      title: "UPGRADE TO\nSMART WEARABLES",
      description: "Track your fitness, receive notifications, monitor health metrics, and stay connected with top smartwatches.",
      image: smartwatchHero,
      badge: "30%",
      link: "/marketplace"
    },
    {
      title: "EXPERIENCE THE\nBEST IN AUDIO",
      description: "Immersive sound, voice-assistant support, cylindrical smart mesh structure speaker for modern living room spaces.",
      image: speakerHero,
      badge: "40%",
      link: "/marketplace"
    },
    {
      title: "CURATE MODERN\nHOME & KITCHEN",
      description: "Upgrade your culinary tools with smart instant multicookers, pressure cookers, and modern cooking appliances.",
      image: multicooker,
      badge: "35%",
      link: "/marketplace"
    }
  ];

  useEffect(() => {
    if (isSearchOrFilterActive) return;
    const interval = setInterval(() => {
      setActiveSlide(prev => (prev + 1) % heroSlides.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [isSearchOrFilterActive, heroSlides.length]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] font-sans antialiased">
      <MarketplaceNavbar search={search} onSearchChange={setSearch} />
      <CartDrawer />
      <PromoBanner />
      <MarqueeBanner />

      {isSearchOrFilterActive ? (
        /* MARKETPLACE SEARCH MODE */
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium tracking-tight text-[#111111] dark:text-[#FAF5F2] uppercase">
              {search ? `Search results for "${search}"` : "Filtered Products"}
            </h2>
            <button
              onClick={() => { setSelectedCategory(null); setSearch(""); }}
              className="text-xs text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2] underline transition-colors"
            >
              Clear filters
            </button>
          </div>

          {loading ? (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="rounded-xl border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1E1E1E] overflow-hidden animate-pulse">
                  <div className="aspect-square bg-[#F2F3F5] dark:bg-[#202022]" />
                  <div className="p-3 space-y-2">
                    <div className="h-3 bg-[#F2F3F5] dark:bg-[#202022] rounded w-3/4" />
                    <div className="h-4 bg-[#F2F3F5] dark:bg-[#202022] rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-[#1E1E1E] border border-[#E8E8E8] dark:border-[#222222] rounded-xl">
              <Package className="h-12 w-12 text-[#888880] mb-3 opacity-60" />
              <h3 className="text-base font-medium text-[#111111] dark:text-[#FAF5F2]">No products found</h3>
              <p className="mt-1 text-xs text-[#888880] max-w-xs">
                Try using more general keywords or removing filters.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {filtered.map(product => {
                const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
                const seller = sellerProfiles[product.seller_id];
                const discount = product.compare_at_price && product.compare_at_price > product.price
                  ? Math.round((1 - product.price / product.compare_at_price) * 100)
                  : null;

                return (
                  <div key={product.id} className="group rounded-xl border border-[#E8E8E8] dark:border-[#222222] bg-white dark:bg-[#1E1E1E] overflow-hidden hover:border-[#888880] dark:hover:border-[#555555] transition-colors duration-200">
                    <Link to={`/product/${product.id}`}>
                      <div className="aspect-square bg-[#FAFAFA] dark:bg-[#151515] relative overflow-hidden">
                        {primaryImage ? (
                          <img src={primaryImage.image_url} alt={product.title} className="w-full h-full object-cover transition-transform duration-300" loading="lazy" />
                        ) : (
                          <div className="flex items-center justify-center h-full bg-[#F2F3F5] dark:bg-[#202022]">
                            <Package className="h-8 w-8 text-[#888880] opacity-40" />
                          </div>
                        )}
                        {discount && (
                          <span className="absolute top-2.5 left-2.5 bg-[#F6C75D] text-[#5C3A00] font-semibold text-[10px] px-2 py-0.5 rounded-[4px]">
                            -{discount}%
                          </span>
                        )}
                        {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                          <span className="absolute top-2.5 right-2.5 bg-[#F8F3F0] dark:bg-[#2A2A2D] text-[#111111] dark:text-[#FAF5F2] text-[10px] font-semibold px-2 py-0.5 rounded-[4px] border border-[#E8E8E8] dark:border-[#222222]">
                            Low Stock
                          </span>
                        )}
                        {user && (
                          <button
                            onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
                            className={`absolute bottom-2.5 right-2.5 h-8 w-8 flex items-center justify-center rounded-full bg-white/95 dark:bg-[#1E1E1E]/95 shadow-sm border border-[#E8E8E8] dark:border-[#222222] transition-colors ${isWishlisted(product.id) ? "text-[#destructive]" : "text-[#888880] dark:text-[#888880] hover:text-[#111111] dark:hover:text-[#FAF5F2]"}`}
                          >
                            <Heart className={`h-4 w-4 ${isWishlisted(product.id) ? "fill-current text-red-500" : ""}`} />
                          </button>
                        )}
                      </div>
                    </Link>
                    <div className="p-3">
                      <Link to={`/product/${product.id}`}>
                        <h3 className="font-normal text-[#111111] dark:text-[#FAF5F2] text-xs line-clamp-2 leading-relaxed min-h-[2.5rem]">{product.title}</h3>
                      </Link>
                      {renderStars(product.id)}
                      <div className="flex items-baseline gap-1.5 mt-1">
                        <span className="text-base font-semibold text-[#111111] dark:text-[#FAF5F2]">${product.price}</span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-xs text-[#888880] line-through">${product.compare_at_price}</span>
                        )}
                      </div>
                      {seller && (
                        <div className="flex items-center gap-1 mt-1.5 border-t border-[#F2F3F5] dark:border-[#222222] pt-1.5">
                          <span className="text-[10px] text-[#888880] truncate">By {seller.full_name || "Seller"}</span>
                          {seller.is_verified && <CheckCircle2 className="h-3 w-3 text-[#F6C75D] shrink-0" />}
                        </div>
                      )}
                      <button
                        onClick={(e) => { e.preventDefault(); handleAddToCart(product); }}
                        className="w-full mt-2 bg-[#111111] dark:bg-[#FAF5F2] hover:bg-[#222222] dark:hover:bg-[#EAE0D8] text-white dark:text-[#111111] text-xs font-medium py-2 rounded-full transition-colors flex items-center justify-center gap-1.5"
                        disabled={product.stock_quantity === 0}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                        Add to Cart
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* 10-SECTION EDITORIAL AMAZON LAYOUT */
        <div className="space-y-12 pb-16">
          <div>
            {/* SECTION 1: HERO SECTION */}
            <section className="bg-[#FAFAFA] dark:bg-[#121212] border-b border-[#E8E8E8] dark:border-[#222222] relative overflow-hidden">
              {/* Gradient overlay for mobile text readability */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#FAFAFA]/95 via-[#FAFAFA]/75 to-[#FAFAFA]/0 dark:from-[#111111]/95 dark:via-[#111111]/75 dark:to-transparent md:hidden pointer-events-none z-10" />

              <div className="mx-auto max-w-7xl px-4 lg:px-8 py-6 md:py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 md:gap-0 relative min-h-[300px] md:min-h-0">
                {/* Bullet indicators on left (Desktop Only) */}
                <div className="hidden md:flex flex-col gap-3 mr-8 shrink-0 items-center w-5 select-none">
                  {heroSlides.map((_, idx) => (
                    <div key={idx} className="h-5 w-5 flex items-center justify-center">
                      {idx === activeSlide ? (
                        <button
                          onClick={() => setActiveSlide(idx)}
                          className="h-4 w-4 rounded-full border border-[#F6C75D] flex items-center justify-center cursor-pointer focus:outline-none"
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-[#111111] dark:bg-[#FAF5F2]"></span>
                        </button>
                      ) : (
                        <button
                          onClick={() => setActiveSlide(idx)}
                          className="h-2 w-2 rounded-full bg-[#888880]/30 hover:bg-[#888880]/60 transition-colors cursor-pointer focus:outline-none"
                        ></button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Main text column */}
                <div className="flex-1 space-y-4 md:space-y-6 max-w-[70%] md:max-w-md z-10 transition-all duration-300 relative text-left pl-0 text-[#111111] dark:text-[#FAF5F2]">
                  <h1 className="text-3xl md:text-5xl font-black tracking-tight text-[#111111] dark:text-[#FAF5F2] uppercase leading-[1.05] font-sans whitespace-pre-line">
                    {heroSlides[activeSlide].title}
                  </h1>
                  <p className="text-[12px] md:text-[13px] text-[#888880] dark:text-[#A0A0A0] leading-relaxed min-h-[3rem] md:min-h-[3.5rem] max-w-xs md:max-w-none">
                    {heroSlides[activeSlide].description}
                  </p>
                  <div>
                    <Link to={heroSlides[activeSlide].link}>
                      <button className="bg-white dark:bg-[#1E1E1E] hover:bg-[#F2F3F5] dark:hover:bg-[#2A2A2D] text-[#111111] dark:text-[#FAF5F2] text-[13px] font-semibold px-6 py-2.5 rounded-full border border-[#C8C8C0] dark:border-[#333333] transition-colors duration-200">
                        View more
                      </button>
                    </Link>
                  </div>
                </div>

                {/* Right product display / Absolute overlay on mobile */}
                <div className="absolute inset-0 md:relative md:flex-1 w-full h-full md:w-auto md:h-auto flex items-center justify-end pointer-events-none md:pointer-events-auto">
                  <div className="relative aspect-square w-full h-full md:w-[360px] md:h-auto bg-transparent flex items-center justify-end mx-auto md:mx-0 opacity-80 md:opacity-100">
                    <img
                      src={heroSlides[activeSlide].image}
                      alt={heroSlides[activeSlide].title}
                      className="w-auto h-full max-h-[85%] md:max-h-none object-contain drop-shadow-md select-none animate-fade-in pr-4 md:pr-0"
                      key={activeSlide}
                    />
                    {/* Gold Badge (Desktop Only) */}
                    <div className="hidden md:flex absolute top-[5%] right-[5%] bg-[#F6C75D] text-[#5C3A00] font-bold text-xs h-10 w-10 rounded-full items-center justify-center shadow-sm select-none">
                      {heroSlides[activeSlide].badge}
                    </div>
                  </div>
                </div>

                {/* Mobile Dot indicators */}
                <div className="flex md:hidden justify-center gap-2 mt-4 select-none w-full relative z-25">
                  {heroSlides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlide(idx)}
                      className={`h-2 w-2 rounded-full transition-all duration-200 ${
                        idx === activeSlide ? "bg-[#111111] dark:bg-[#FAF5F2] w-4" : "bg-[#888880]/30"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </section>

            {/* SECTION 2: BUYER/RECOMMENDATION STRIP */}
            <section className="bg-[#F8F3F0] dark:bg-[#151515] border-b border-[#E8E8E8] dark:border-[#222222] py-4 relative overflow-hidden">
              <div className="mx-auto max-w-7xl px-4 lg:px-8">
                <div className="flex items-center justify-between gap-6 overflow-x-auto scrollbar-hide w-full">
                  {/* User greeting */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="h-10 w-10 rounded-full border border-[#E8E8E8] dark:border-[#2A2A2D] overflow-hidden bg-[#FAFAFA] dark:bg-[#1E1E1E] flex items-center justify-center shrink-0">
                      {user && profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt={profile.full_name || "User"} className="h-full w-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-[#888880] dark:text-[#A0A0A0]" />
                      )}
                    </div>
                    <div className="text-[11px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                      <span className="font-semibold block">Hi, {user && profile?.full_name ? profile.full_name : "Guest"}</span>
                      <span className="text-[#888880] dark:text-[#A0A0A0]">recommendations for you 👋</span>
                    </div>
                  </div>

                  {/* Your Orders */}
                  <Link to="/buyer/orders" className="flex items-center gap-3 shrink-0 group relative py-1">
                    <img src={cardboardBox} alt="Orders package" className="h-9 w-9 object-contain" />
                    <div className="text-[11px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                      <span className="font-bold block">Your Orders</span>
                      <span className="text-[#888880] dark:text-[#A0A0A0]">View your orders</span>
                    </div>
                  </Link>

                  {/* Electronics */}
                  <Link to="/marketplace" className="flex items-center gap-3 shrink-0 group py-1">
                    <img src={headphonesHero} alt="Electronics" className="h-9 w-9 object-contain" />
                    <div className="text-[11px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                      <span className="font-bold block">Electronics</span>
                      <span className="text-[#888880] dark:text-[#A0A0A0]">Big Sale 30%</span>
                    </div>
                  </Link>

                  {/* Home & Kitchen */}
                  <Link to="/marketplace" className="flex items-center gap-3 shrink-0 group py-1">
                    <img src={multicooker} alt="Home & Kitchen cooker" className="h-9 w-9 object-contain" />
                    <div className="text-[11px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                      <span className="font-bold block">Home & Kitchen</span>
                      <span className="text-[#888880] dark:text-[#A0A0A0]">Big Sale 30%</span>
                    </div>
                  </Link>
                </div>
              </div>
            </section>
          </div>

          {/* SECTION 3: SHOP BY CATEGORIES */}
          <section className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-base font-semibold text-[#111111] dark:text-[#FAF5F2]">Shop by categories</h2>
              <Link to="/marketplace" className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:underline flex items-center gap-2 transition-all group">
                All <span className="transition-transform group-hover:translate-x-1 duration-200">────→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {(() => {
                const findCategory = (nameQuery: string, defaultSlug: string) => {
                  const dbCat = categories.find(c =>
                    c.name.toLowerCase().includes(nameQuery.toLowerCase()) ||
                    c.slug.toLowerCase().includes(nameQuery.toLowerCase())
                  );
                  return dbCat || { id: defaultSlug, name: nameQuery, slug: defaultSlug };
                };

                const displayCategories = [
                  findCategory("Electronics", "electronics"),
                  findCategory("Fashion", "fashion"),
                  findCategory("Jewelry", "jewelry"),
                  findCategory("Home", "home")
                ];

                return displayCategories.map((cat, index) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className="group w-full aspect-[3/4] rounded-2xl bg-white dark:bg-[#1E1E1E] flex flex-col justify-between items-center overflow-hidden hover:shadow-md dark:hover:shadow-black/40 transition-shadow duration-300 relative border border-[#E8E8E8] dark:border-[#222222]"
                  >
                    <div className="flex-1 w-full flex items-center justify-center overflow-hidden relative bg-white dark:bg-[#1E1E1E]">
                      <img
                        src={getCategoryMockImage(cat.slug, index)}
                        alt={cat.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105 select-none"
                      />
                    </div>
                    <div className="w-full text-left px-6 py-4 bg-white dark:bg-[#1E1E1E] border-t border-[#F2F3F5] dark:border-[#222222]">
                      <span className="text-[13px] font-semibold text-[#111111] dark:text-[#FAF5F2] leading-tight block group-hover:underline">
                        {cat.name}
                      </span>
                    </div>
                  </button>
                ));
              })()}
            </div>
          </section>

          {/* SECTION 4: MID-PAGE BANNER */}
          <section className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="bg-[#F8F3F0] dark:bg-[#1C1C1E] border border-[#E8E8E8] dark:border-[#222222] rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-[1.35fr_0.65fr]">
              <div className="p-8 md:p-12 flex flex-col justify-center space-y-6">
                <span className="text-xs font-semibold text-[#888880] dark:text-[#A0A0A0] tracking-wider uppercase">MarketHub Platform</span>
                <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-[#111111] dark:text-[#FAF5F2] uppercase leading-tight font-sans">
                  The Trusted Multi-Vendor Marketplace
                </h2>
                <p className="text-[13px] text-[#888880] dark:text-[#A0A0A0] leading-relaxed max-w-sm">
                  Connect with verified independent sellers worldwide. Shop with total peace of mind using our secure escrow payments, buyer protection guarantees, and fast delivery channels.
                </p>
                <div>
                  <Link to="/marketplace">
                    <button className="bg-[#111111] dark:bg-[#FAF5F2] hover:bg-[#222222] dark:hover:bg-[#EAE0D8] text-white dark:text-[#111111] text-[13px] font-medium px-6 py-2.5 rounded-full transition-colors duration-200">
                      Explore Marketplace
                    </button>
                  </Link>
                </div>
              </div>
              <div className="bg-[#F2F3F5] dark:bg-[#2A2A2D] flex items-center justify-center relative aspect-video md:aspect-auto overflow-hidden">
                <img
                  src={bannerImmersive}
                  alt="MarketHub premium items and secure parcel delivery illustration"
                  className="w-full h-full object-cover select-none animate-fade-in"
                />
              </div>
            </div>
          </section>

          {/* SECTION 5: TOP SELLERS */}
          <section className="mx-auto max-w-7xl px-4 lg:px-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-[#111111] dark:text-[#FAF5F2]">Top Sellers</h2>
              <Link to="/marketplace" className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:underline flex items-center gap-2 transition-all group">
                All Products <span className="transition-transform group-hover:translate-x-1 duration-200">────→</span>
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(() => {
                const staticFallbacks = [
                  { id: "fs-1", title: "Instant Pot Duo 7-in-1 Electric Cooker", price: 79.00, compare_at_price: 99.95, image: multicooker, reviews: "117,879", rating: 5, isBestSeller: true },
                  { id: "fs-2", title: "JBL T460BT Black Wireless Headphones", price: 125.00, compare_at_price: 150.00, image: headphonesHero, reviews: "1,245", rating: 5, isBestSeller: true },
                  { id: "fs-3", title: "Active Waterproof Fitness Smartwatch", price: 89.00, compare_at_price: 120.00, image: smartwatchHero, reviews: "3,401", rating: 4, isBestSeller: false },
                  { id: "fs-4", title: "Premium Bluetooth Cylindrical Speaker", price: 69.00, compare_at_price: 89.00, image: speakerHero, reviews: "892", rating: 5, isBestSeller: false },
                  { id: "fs-5", title: "Scandinavian Minimalist Lounge Chair", price: 299.00, compare_at_price: 399.00, image: catHome, reviews: "453", rating: 5, isBestSeller: true },
                  { id: "fs-6", title: "Professional 4K Mirrorless Camera v2", price: 899.00, compare_at_price: 1100.00, image: catElectronics, reviews: "1,988", rating: 5, isBestSeller: true },
                  { id: "fs-7", title: "Classic Gold Diamond Wedding Band", price: 450.00, compare_at_price: 600.00, image: catJewelry, reviews: "124", rating: 5, isBestSeller: false },
                  { id: "fs-8", title: "Premium Cotton Everyday Trench Coat", price: 120.00, compare_at_price: 175.00, image: catFashion, reviews: "908", rating: 4, isBestSeller: false },
                  { id: "fs-9", title: "Cardboard Delivery Shipping Box Pack", price: 15.00, compare_at_price: 25.00, image: cardboardBox, reviews: "10,230", rating: 5, isBestSeller: false },
                  { id: "fs-10", title: "Modern Desktop Computing Display Pro", price: 199.00, compare_at_price: 249.00, image: smartwatchHero, reviews: "654", rating: 4, isBestSeller: true }
                ];

                const displaySellers = [];
                for (let i = 0; i < 10; i++) {
                  if (products[i]) {
                    const p = products[i];
                    const image_url = p.product_images?.find(img => img.is_primary)?.image_url || p.product_images?.[0]?.image_url || null;
                    displaySellers.push({
                      id: p.id,
                      title: p.title,
                      price: p.price,
                      compare_at_price: p.compare_at_price,
                      image_url: image_url,
                      reviews: `${((p.id.charCodeAt(0) || 5) * 73) % 400 + 42}`,
                      rating: ((p.id.charCodeAt(0) || 5) % 2) === 0 ? 5 : 4,
                      isBestSeller: ((p.id.charCodeAt(0) || 5) % 3) === 0,
                      isDb: true
                    });
                  } else {
                    const fallback = staticFallbacks[i];
                    displaySellers.push({
                      id: fallback.id,
                      title: fallback.title,
                      price: fallback.price,
                      compare_at_price: fallback.compare_at_price,
                      image_url: fallback.image,
                      reviews: fallback.reviews,
                      rating: fallback.rating,
                      isBestSeller: fallback.isBestSeller,
                      isDb: false
                    });
                  }
                }

                return displaySellers.map((item, index) => {
                  const cardElement = (
                    <div
                      className={`group rounded-2xl bg-[#F5F5F5] dark:bg-[#1E1E1E] overflow-hidden flex flex-col p-4 relative border border-[#E8E8E8]/40 dark:border-[#222222]/60 hover:border-[#888880]/60 dark:hover:border-[#555555] transition-all duration-200 h-full ${index >= 4 ? "hidden md:flex" : "flex"
                        }`}
                    >
                      {/* Best Seller Badge */}
                      {item.isBestSeller && (
                        <span className="absolute top-3 left-3 bg-[#FFA000] text-white text-[9px] font-bold px-2 py-0.5 rounded-[3px] z-10 shadow-sm select-none">
                          Best seller
                        </span>
                      )}

                      {/* Product Image */}
                      <div className="aspect-square bg-[#F5F5F5] dark:bg-[#1E1E1E] flex items-center justify-center p-4 relative overflow-hidden shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="max-h-[120px] w-auto object-contain select-none transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-[#E8E8E8] dark:bg-[#2A2A2D] rounded-xl">
                            <Package className="h-8 w-8 text-[#888880] opacity-40" />
                          </div>
                        )}
                      </div>

                      {/* Metadata & Title */}
                      <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-3 block select-none">
                        Ships to Nigeria
                      </span>
                      <h4 className="text-[12px] font-semibold text-[#111111] dark:text-[#FAF5F2] line-clamp-2 mt-1 hover:underline min-h-[32px] leading-snug">
                        {item.title}
                      </h4>

                      {/* Stars & Reviews */}
                      <div className="flex items-center gap-1.5 mt-1.5 select-none">
                        <div className="flex text-[#F6C75D] text-[11px] gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < item.rating ? "★" : "☆"}</span>
                          ))}
                        </div>
                        <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">{item.reviews} reviews</span>
                      </div>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-1.5 mt-2.5">
                        <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">${item.price.toFixed(2)}</span>
                        {item.compare_at_price && (
                          <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] line-through">${item.compare_at_price.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  );

                  return item.isDb ? (
                    <Link key={item.id} to={`/product/${item.id}`} className={index >= 4 ? "hidden md:block" : "block"}>
                      {cardElement}
                    </Link>
                  ) : (
                    <Link key={item.id} to="/marketplace" className={index >= 4 ? "hidden md:block" : "block"}>
                      {cardElement}
                    </Link>
                  );
                });
              })()}
            </div>
          </section>

          {/* SECTION 6: EDITORIAL SHOWCASE (FOR HER / FOR HIM SPLIT) */}
          <section className="mx-auto max-w-7xl px-4 lg:px-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* For Her Card */}
            <div className="bg-[#F8F3F0] dark:bg-[#1C1C1E] border border-[#E8E8E8] dark:border-[#222222] rounded-2xl pl-6 md:pl-8 pr-0 pt-4 md:pt-5 pb-0 flex flex-row justify-between items-stretch overflow-hidden min-h-[190px] md:min-h-[210px]">
              <div className="flex-1 flex flex-col justify-between pb-4 max-w-[200px] md:max-w-[240px]">
                <div className="space-y-1">
                  <h3 className="text-[16px] md:text-[18px] font-bold text-[#111111] dark:text-[#FAF5F2] leading-tight">
                    Own the narrative
                  </h3>
                  <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] leading-snug">
                    Shop bold streetwear styles, custom-made graphic hoodies, and accessories designed for you.
                  </p>
                  <Link to="/marketplace" className="text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:underline pt-0.5 block">
                    See more
                  </Link>
                </div>

                {/* Lower handbag thumbnail tag */}
                <Link to="/marketplace" className="flex items-center gap-2 bg-[#FFFFFF]/80 dark:bg-[#252528]/80 border border-[#E8E8E8]/40 dark:border-[#333333]/40 rounded-lg p-1.5 max-w-[170px] select-none hover:bg-white dark:hover:bg-[#252528] transition-all shadow-sm mt-2 shrink-0">
                  <img src={thumbHandbag} alt="Top Handbags preview" className="h-7 w-7 object-contain" />
                  <div className="text-[9px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                    <span className="font-bold block">Top Handbags</span>
                    <span className="text-[#888880] dark:text-[#A0A0A0] text-[8px]">Big Sale 30%</span>
                  </div>
                  <div className="h-4 w-4 rounded-full border border-[#E8E8E8] dark:border-[#333333] flex items-center justify-center ml-auto bg-white dark:bg-[#252528] text-[#888880] dark:text-[#A0A0A0] shrink-0">
                    <ChevronRight className="h-2.5 w-2.5" />
                  </div>
                </Link>
              </div>

              {/* Right Aligned Crop Model Image */}
              <div className="w-[100px] md:w-[130px] flex items-end justify-end shrink-0 overflow-hidden self-end">
                <img
                  src={styleHer}
                  alt="Streetwear for her model"
                  className="w-full h-auto max-h-[180px] md:max-h-[200px] object-contain object-bottom select-none translate-y-[2px]"
                />
              </div>
            </div>

            {/* For Him Card */}
            <div className="bg-[#F2F3F5] dark:bg-[#151515] border border-[#E8E8E8] dark:border-[#222222] rounded-2xl pl-6 md:pl-8 pr-0 pt-4 md:pt-5 pb-0 flex flex-row justify-between items-stretch overflow-hidden min-h-[190px] md:min-h-[210px]">
              <div className="flex-1 flex flex-col justify-between pb-4 max-w-[200px] md:max-w-[240px]">
                <div className="space-y-1">
                  <h3 className="text-[16px] md:text-[18px] font-bold text-[#111111] dark:text-[#FAF5F2] leading-tight">
                    Steez in every thread
                  </h3>
                  <p className="text-[10px] text-[#888880] dark:text-[#A0A0A0] leading-snug">
                    Shop structured oversized sets, heavyweight fleece hoodies, and fresh utility outerwear drops.
                  </p>
                  <Link to="/marketplace" className="text-[10px] font-semibold text-[#111111] dark:text-[#FAF5F2] hover:underline pt-0.5 block">
                    See more
                  </Link>
                </div>

                {/* Lower folded shirt thumbnail tag */}
                <Link to="/marketplace" className="flex items-center gap-2 bg-[#FFFFFF]/80 dark:bg-[#252528]/80 border border-[#E8E8E8]/40 dark:border-[#333333]/40 rounded-lg p-1.5 max-w-[170px] select-none hover:bg-white dark:hover:bg-[#252528] transition-all shadow-sm mt-2 shrink-0">
                  <img src={thumbShirt} alt="Graphic tee preview" className="h-7 w-7 object-contain" />
                  <div className="text-[9px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                    <span className="font-bold block">Graphic tee</span>
                    <span className="text-[#888880] dark:text-[#A0A0A0] text-[8px]">Big Sale 30%</span>
                  </div>
                  <div className="h-4 w-4 rounded-full border border-[#E8E8E8] dark:border-[#333333] flex items-center justify-center ml-auto bg-white dark:bg-[#252528] text-[#888880] dark:text-[#A0A0A0] shrink-0">
                    <ChevronRight className="h-2.5 w-2.5" />
                  </div>
                </Link>
              </div>

              {/* Right Aligned Crop Model Image */}
              <div className="w-[100px] md:w-[130px] flex items-end justify-end shrink-0 overflow-hidden self-end">
                <img
                  src={styleHim}
                  alt="Streetwear for him model"
                  className="w-full h-auto max-h-[180px] md:max-h-[200px] object-contain object-bottom select-none translate-y-[2px]"
                />
              </div>
            </div>
          </section>

          {/* SECTION 7: "FOR YOU" PERSONALIZED ROW */}
          <section className="mx-auto max-w-7xl px-4 lg:px-8 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-[#111111] dark:text-[#FAF5F2]">
                {profile?.full_name || "Tomas"}, this must have for you ⚡
              </h2>
              <Link to="/marketplace" className="text-xs font-semibold text-[#111111] dark:text-[#FAF5F2] hover:underline flex items-center gap-2 group transition-all">
                View more <span className="transition-transform group-hover:translate-x-1 duration-200">────→</span>
              </Link>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {(() => {
                const staticRecFallbacks = [
                  { id: "rec-1", title: "Xiaomi Mi Bluetooth Mouse Silver", price: 20.99, compare_at_price: null, image: smartwatchHero, reviews: "1,078", rating: 5, isBestSeller: false },
                  { id: "rec-2", title: "Instant Pot Duo 7-in-1 Electric Cooker", price: 400.60, compare_at_price: null, image: multicooker, reviews: "147,879", rating: 5, isBestSeller: false },
                  { id: "rec-3", title: "Razer Man O'War 7.1 headphones Razer", price: 45.45, compare_at_price: 64.00, image: headphonesHero, reviews: "147,879", rating: 5, isBestSeller: true },
                  { id: "rec-4", title: "Bluetooth Sennheiser CX 150BT Earphones", price: 20.50, compare_at_price: 32.00, image: speakerHero, reviews: "147,879", rating: 5, isBestSeller: true },
                  { id: "rec-5", title: "Headphones wireless TWS Xiaomi Mi True", price: 67.00, compare_at_price: 100.00, image: smartwatchHero, reviews: "12,678", rating: 5, isBestSeller: false }
                ];

                const displayRec = [];
                for (let i = 0; i < 5; i++) {
                  // Skip first 10 items to keep recommendations fresh
                  const dbIndex = i + 10;
                  if (products[dbIndex]) {
                    const p = products[dbIndex];
                    const image_url = p.product_images?.find(img => img.is_primary)?.image_url || p.product_images?.[0]?.image_url || null;
                    displayRec.push({
                      id: p.id,
                      title: p.title,
                      price: p.price,
                      compare_at_price: p.compare_at_price,
                      image_url: image_url,
                      reviews: `${((p.id.charCodeAt(0) || 3) * 67) % 300 + 12}`,
                      rating: ((p.id.charCodeAt(0) || 3) % 2) === 0 ? 5 : 4,
                      isBestSeller: ((p.id.charCodeAt(0) || 3) % 4) === 0,
                      isDb: true
                    });
                  } else {
                    const fallback = staticRecFallbacks[i];
                    displayRec.push({
                      id: fallback.id,
                      title: fallback.title,
                      price: fallback.price,
                      compare_at_price: fallback.compare_at_price,
                      image_url: fallback.image,
                      reviews: fallback.reviews,
                      rating: fallback.rating,
                      isBestSeller: fallback.isBestSeller,
                      isDb: false
                    });
                  }
                }

                return displayRec.map((item, index) => {
                  const cardElement = (
                    <div
                      className={`group rounded-2xl bg-[#F5F5F5] dark:bg-[#1E1E1E] overflow-hidden flex flex-col p-4 relative border border-[#E8E8E8]/40 dark:border-[#222222]/60 hover:border-[#888880]/60 dark:hover:border-[#555555] transition-all duration-200 h-full ${
                        index >= 2 ? "hidden md:flex" : "flex"
                      }`}
                    >
                      {/* Best Seller Badge */}
                      {item.isBestSeller && (
                        <span className="absolute top-3 left-3 bg-[#FFA000] text-white text-[9px] font-bold px-2 py-0.5 rounded-[3px] z-10 shadow-sm select-none">
                          Best seller
                        </span>
                      )}

                      {/* Product Image */}
                      <div className="aspect-square bg-[#F5F5F5] dark:bg-[#1E1E1E] flex items-center justify-center p-4 relative overflow-hidden shrink-0">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="max-h-[120px] w-auto object-contain select-none transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="flex items-center justify-center h-full w-full bg-[#E8E8E8] dark:bg-[#2A2A2D] rounded-xl">
                            <Package className="h-8 w-8 text-[#888880] opacity-40" />
                          </div>
                        )}
                      </div>

                      {/* Metadata & Title */}
                      <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] mt-3 block select-none">
                        Ships to Nigeria
                      </span>
                      <h4 className="text-[12px] font-semibold text-[#111111] dark:text-[#FAF5F2] line-clamp-2 mt-1 hover:underline min-h-[32px] leading-snug">
                        {item.title}
                      </h4>

                      {/* Stars & Reviews */}
                      <div className="flex items-center gap-1.5 mt-1.5 select-none">
                        <div className="flex text-[#F6C75D] text-[11px] gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <span key={i}>{i < item.rating ? "★" : "☆"}</span>
                          ))}
                        </div>
                        <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0]">{item.reviews} reviews</span>
                      </div>

                      {/* Pricing */}
                      <div className="flex items-baseline gap-1.5 mt-2.5">
                        <span className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">${item.price.toFixed(2)}</span>
                        {item.compare_at_price && (
                          <span className="text-[10px] text-[#888880] dark:text-[#A0A0A0] line-through">${item.compare_at_price.toFixed(2)}</span>
                        )}
                      </div>
                    </div>
                  );

                  return item.isDb ? (
                    <Link key={item.id} to={`/product/${item.id}`} className={index >= 2 ? "hidden md:block" : "block"}>
                      {cardElement}
                    </Link>
                  ) : (
                    <Link key={item.id} to="/marketplace" className={index >= 2 ? "hidden md:block" : "block"}>
                      {cardElement}
                    </Link>
                  );
                });
              })()}
            </div>

            {/* Bottom Categories & Discounts Strip */}
            <div className="bg-[#FAF5F2] dark:bg-[#1C1C1E] border border-[#E8E8E8] dark:border-[#222222] rounded-2xl p-4 md:p-6 mt-8 select-none">
              {/* Categories Strip */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 justify-items-stretch">
                {[
                  { title: "Vacuum cleaners", discount: "Big Sale 70%", image: multicooker },
                  { title: "Xbox & Consoles", discount: "Big Sale 30%", image: catElectronics },
                  { title: "Portable speakers", discount: "Big Sale 30%", image: speakerHero },
                  { title: "Projectors", discount: "Big Sale 20%", image: catElectronics }
                ].map((item, idx) => (
                  <Link key={idx} to="/marketplace" className="flex items-center gap-3 group w-full">
                    <div className="h-12 w-12 rounded-full bg-[#FFFFFF]/80 dark:bg-[#252528]/80 border border-[#E8E8E8]/40 dark:border-[#333333]/40 flex items-center justify-center p-1.5 overflow-hidden group-hover:bg-white dark:group-hover:bg-[#252528] transition-all shadow-sm shrink-0">
                      <img src={item.image} alt={item.title} className="h-full w-full object-contain" />
                    </div>
                    <div className="text-[11px] leading-tight text-[#111111] dark:text-[#FAF5F2]">
                      <span className="font-bold block group-hover:underline">{item.title}</span>
                      <span className="text-[#888880] dark:text-[#A0A0A0] text-[10px]">{item.discount}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>

          {/* SECTION 10: E-COMMERCE FOOTER */}
          <SiteFooter />
        </div>
      )}
    </div>
  );
}
