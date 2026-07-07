import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import MarketplaceNavbar from "@/components/MarketplaceNavbar";
import CartDrawer from "@/components/CartDrawer";
import HeroSlider from "@/components/HeroSlider";
import PromoBanner from "@/components/PromoBanner";
import MarqueeBanner from "@/components/MarqueeBanner";
import {
  ShoppingCart, Package, CheckCircle2, ArrowRight, Flame, Heart,
  Truck, Shield, CreditCard, Headphones, Mail, Star
} from "lucide-react";

import heroSlide1 from "@/assets/hero-slide-1.jpg";
import heroSlide2 from "@/assets/hero-slide-2.jpg";
import heroSlide3 from "@/assets/hero-slide-3.jpg";

const heroSlides = [
  { image: heroSlide1, title: "Shop the Best Deals", subtitle: "Premium products from verified sellers worldwide", badge: "🔥 Trending Now" },
  { image: heroSlide2, title: "New Season Arrivals", subtitle: "Discover the latest in fashion, tech & lifestyle", badge: "🛍️ New Arrivals" },
  { image: heroSlide3, title: "Your Workspace, Upgraded", subtitle: "Top-rated electronics and home office essentials", badge: "💻 Tech Deals" },
];

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

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sellerProfiles, setSellerProfiles] = useState<Record<string, { full_name: string | null; is_verified: boolean }>>({});
  const { addItem } = useCart();
  const { user } = useAuth();
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
          const { data: profiles } = await supabase.from("seller_profiles_public" as any).select("user_id, full_name, is_verified").in("user_id", sellerIds);
          if (profiles) {
            const map: Record<string, { full_name: string | null; is_verified: boolean }> = {};
            profiles.forEach(p => { map[p.user_id] = { full_name: p.full_name, is_verified: p.is_verified }; });
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

  return (
    <div className="min-h-screen bg-background">
      <MarketplaceNavbar search={search} onSearchChange={setSearch} />
      <CartDrawer />
      <PromoBanner />
      <MarqueeBanner />

      {/* Hero */}
      <HeroSlider slides={heroSlides}>
        <div className="mt-8 flex gap-3">
          <Link to="/marketplace">
            <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 gap-2 px-8 py-5 shadow-lg font-semibold rounded-lg">
              Shop Now <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>
        </div>
      </HeroSlider>

      {/* Trust bar */}
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: Truck, text: "Free Shipping" },
              { icon: Shield, text: "Buyer Protection" },
              { icon: CreditCard, text: "Secure Payment" },
              { icon: Headphones, text: "24/7 Support" },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Icon className="h-4 w-4 text-primary" />
                <span className="font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8 pt-8">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <button onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-colors ${!selectedCategory ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`whitespace-nowrap rounded-full px-5 py-2 text-sm font-medium transition-colors ${selectedCategory === cat.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-muted"}`}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Product grid */}
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-2xl font-bold text-foreground">Featured Products</h2>
          <Link to="/marketplace" className="text-sm text-primary hover:underline font-medium flex items-center gap-1">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card overflow-hidden animate-pulse">
                <div className="aspect-square bg-muted" />
                <div className="p-2 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-4 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="font-display text-xl font-semibold text-foreground">
              {search || selectedCategory ? "No products match your filters" : "No products listed yet"}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              {search || selectedCategory ? "Try different search terms or categories" : "Products will appear here as sellers list them."}
            </p>
          </div>
        ) : (
          <div className="grid gap-2.5 sm:gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map(product => {
              const primaryImage = product.product_images?.find(i => i.is_primary) || product.product_images?.[0];
              const seller = sellerProfiles[product.seller_id];
              const discount = product.compare_at_price && product.compare_at_price > product.price
                ? Math.round((1 - product.price / product.compare_at_price) * 100)
                : null;

              return (
                <div key={product.id} className="group rounded-lg border border-border bg-card overflow-hidden transition-shadow hover:shadow-md">
                  <Link to={`/product/${product.id}`}>
                    <div className="aspect-square bg-muted relative overflow-hidden">
                      {primaryImage ? (
                        <img src={primaryImage.image_url} alt={product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                      ) : (
                        <div className="flex items-center justify-center h-full"><Package className="h-10 w-10 text-muted-foreground/20" /></div>
                      )}
                      {discount && (
                        <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground font-bold text-[10px] px-1.5 py-0">
                          -{discount}%
                        </Badge>
                      )}
                      {product.stock_quantity <= 5 && product.stock_quantity > 0 && (
                        <Badge className="absolute top-1.5 right-1.5 bg-accent text-accent-foreground text-[10px] px-1.5 py-0">
                          <Flame className="h-2.5 w-2.5 mr-0.5" /> Hot
                        </Badge>
                      )}
                      {user && (
                        <button
                          onClick={(e) => { e.preventDefault(); toggleWishlist(product.id); }}
                          className={`absolute bottom-1.5 right-1.5 h-7 w-7 flex items-center justify-center rounded-full bg-background/90 backdrop-blur transition-colors ${isWishlisted(product.id) ? "text-destructive" : "text-muted-foreground hover:text-destructive"}`}
                        >
                          <Heart className={`h-3.5 w-3.5 ${isWishlisted(product.id) ? "fill-current" : ""}`} />
                        </button>
                      )}
                    </div>
                  </Link>
                  <div className="p-2">
                    <Link to={`/product/${product.id}`}>
                      <h3 className="font-medium text-foreground line-clamp-2 group-hover:text-primary transition-colors text-xs leading-snug min-h-[2rem]">{product.title}</h3>
                    </Link>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="flex items-baseline gap-1 min-w-0">
                        <span className="font-display text-base font-bold text-destructive">${product.price}</span>
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-[10px] text-muted-foreground line-through">${product.compare_at_price}</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={(e) => { e.preventDefault(); handleAddToCart(product); }}
                        className="h-7 w-7 p-0 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 shrink-0"
                        disabled={product.stock_quantity === 0}
                      >
                        <ShoppingCart className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {seller && (
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-[10px] text-muted-foreground truncate">{seller.full_name || "Seller"}</span>
                        {seller.is_verified && <CheckCircle2 className="h-2.5 w-2.5 text-accent shrink-0" />}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border bg-[hsl(var(--navbar))] text-[hsl(var(--navbar-foreground))] mt-12">
        <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <Package className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-display text-lg font-bold">MarketHub</span>
              </div>
              <p className="text-sm text-[hsl(var(--navbar-foreground)/0.6)] leading-relaxed">
                Your trusted multi-vendor marketplace. Shop from thousands of verified sellers.
              </p>
            </div>
            <div>
              <h4 className="font-display font-semibold mb-3 text-sm">Shop</h4>
              <ul className="space-y-2 text-sm text-[hsl(var(--navbar-foreground)/0.6)]">
                <li><Link to="/marketplace" className="hover:text-[hsl(var(--navbar-foreground))] transition-colors">All Products</Link></li>
                <li><Link to="/marketplace" className="hover:text-[hsl(var(--navbar-foreground))] transition-colors">Categories</Link></li>
                <li><Link to="/marketplace" className="hover:text-[hsl(var(--navbar-foreground))] transition-colors">Deals</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold mb-3 text-sm">Sell</h4>
              <ul className="space-y-2 text-sm text-[hsl(var(--navbar-foreground)/0.6)]">
                <li><Link to="/auth/register" className="hover:text-[hsl(var(--navbar-foreground))] transition-colors">Start Selling</Link></li>
                <li><Link to="/auth/login" className="hover:text-[hsl(var(--navbar-foreground))] transition-colors">Seller Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-display font-semibold mb-3 text-sm">Support</h4>
              <ul className="space-y-2 text-sm text-[hsl(var(--navbar-foreground)/0.6)]">
                <li><Link to="/auth/login" className="hover:text-[hsl(var(--navbar-foreground))] transition-colors">My Account</Link></li>
                <li><span className="cursor-default">Contact Us</span></li>
                <li><span className="cursor-default">Terms of Service</span></li>
                <li><span className="cursor-default">Privacy Policy</span></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-[hsl(var(--navbar-foreground)/0.1)] mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[hsl(var(--navbar-foreground)/0.4)]">© {new Date().getFullYear()} MarketHub. All rights reserved.</p>
            <div className="flex items-center gap-1 text-xs text-[hsl(var(--navbar-foreground)/0.4)]">
              <Mail className="h-3 w-3" /> support@markethub.com
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
