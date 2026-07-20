import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { CartProvider } from "@/hooks/useCart";
import { CurrencyProvider } from "@/hooks/useCurrency";
import ProtectedRoute from "@/components/ProtectedRoute";
import DashboardLayout from "@/components/DashboardLayout";
import RoleRedirect from "@/components/RoleRedirect";
import PageTransition from "@/components/PageTransition";
import NotificationsHub from "@/components/NotificationsHub";
import CookieConsent from "@/components/CookieConsent";

// Public pages - Landing page and marketplace are critical, lazy load the rest
import LandingPage from "@/pages/LandingPage";
const MarketplacePage = lazy(() => import("@/pages/MarketplacePage"));
const ProductDetailPage = lazy(() => import("@/pages/ProductDetailPage"));
const SellerStorePage = lazy(() => import("@/pages/SellerStorePage"));
const CheckoutPage = lazy(() => import("@/pages/CheckoutPage"));
const OrderSuccessPage = lazy(() => import("@/pages/OrderSuccessPage"));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/auth/RegisterPage"));
const NotFound = lazy(() => import("@/pages/NotFound"));
const PublicWishlistPage = lazy(() => import("@/pages/PublicWishlistPage"));
const TermsPage = lazy(() => import("@/pages/legal/TermsPage"));
const PrivacyPage = lazy(() => import("@/pages/legal/PrivacyPage"));
const RefundPolicyPage = lazy(() => import("@/pages/legal/RefundPolicyPage"));
const ContactPage = lazy(() => import("@/pages/legal/ContactPage"));
const CollectionPage = lazy(() => import("@/pages/CollectionPage"));
const CategoriesPage = lazy(() => import("@/pages/CategoriesPage"));

// Admin pages (lazy loaded)
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const AdminSellers = lazy(() => import("@/pages/admin/AdminSellers"));
const AdminAds = lazy(() => import("@/pages/admin/AdminAds"));
const AdminAnalytics = lazy(() => import("@/pages/admin/AdminAnalytics"));
const AdminDisputes = lazy(() => import("@/pages/admin/AdminDisputes"));
const AdminProducts = lazy(() => import("@/pages/admin/AdminProducts"));
const AdminOrders = lazy(() => import("@/pages/admin/AdminOrders"));
const AdminPages = lazy(() => import("@/pages/admin/AdminPages"));
const AdminCollections = lazy(() => import("@/pages/admin/AdminCollections"));

// Seller pages (lazy loaded)
const SellerDashboard = lazy(() => import("@/pages/seller/SellerDashboard"));
const SellerProducts = lazy(() => import("@/pages/seller/SellerProducts"));
const SellerOrders = lazy(() => import("@/pages/seller/SellerOrders"));
const SellerAds = lazy(() => import("@/pages/seller/SellerAds"));
const SellerWallet = lazy(() => import("@/pages/seller/SellerWallet"));
const SellerChat = lazy(() => import("@/pages/seller/SellerChat"));
const SellerStore = lazy(() => import("@/pages/seller/SellerStore"));
const SellerReviews = lazy(() => import("@/pages/seller/SellerReviews"));
const SellerAnalytics = lazy(() => import("@/pages/seller/SellerAnalytics"));
const SellerCollections = lazy(() => import("@/pages/seller/SellerCollections"));

// Buyer pages (lazy loaded)
const BuyerDashboard = lazy(() => import("@/pages/buyer/BuyerDashboard"));
const BuyerOrders = lazy(() => import("@/pages/buyer/BuyerOrders"));
const BuyerTracking = lazy(() => import("@/pages/buyer/BuyerTracking"));
const BuyerChat = lazy(() => import("@/pages/buyer/BuyerChat"));
const BuyerReports = lazy(() => import("@/pages/buyer/BuyerReports"));
const BuyerWishlist = lazy(() => import("@/pages/buyer/BuyerWishlist"));
const BuyerProfile = lazy(() => import("@/pages/buyer/BuyerProfile"));

// Legal pages (lazy loaded)
const ShippingPage = lazy(() => import("@/pages/legal/ShippingPage"));
const PaymentPage = lazy(() => import("@/pages/legal/PaymentPage"));
const AboutPage = lazy(() => import("@/pages/legal/AboutPage"));

const queryClient = new QueryClient();

function AdminRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function SellerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["seller", "admin"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function BuyerRoute({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["buyer"]}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

function RouteSuspense({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#111111]"></div>
      </div>
    }>
      {children}
    </Suspense>
  );
}

function AppRoutes() {
  return (
    <PageTransition>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/marketplace" element={<RouteSuspense><MarketplacePage /></RouteSuspense>} />
        <Route path="/categories" element={<RouteSuspense><CategoriesPage /></RouteSuspense>} />
        <Route path="/categories/:slug" element={<RouteSuspense><MarketplacePage /></RouteSuspense>} />
        <Route path="/collections/:slug" element={<RouteSuspense><CollectionPage /></RouteSuspense>} />
        <Route path="/product/:id" element={<RouteSuspense><ProductDetailPage /></RouteSuspense>} />
        <Route path="/seller/:id" element={<RouteSuspense><SellerStorePage /></RouteSuspense>} />
        <Route path="/checkout" element={<RouteSuspense><CheckoutPage /></RouteSuspense>} />
        <Route path="/order-success/:id" element={<RouteSuspense><OrderSuccessPage /></RouteSuspense>} />
        <Route path="/auth/login" element={<RouteSuspense><LoginPage /></RouteSuspense>} />
        <Route path="/auth/register" element={<RouteSuspense><RegisterPage /></RouteSuspense>} />
        <Route path="/wishlist/:userId" element={<RouteSuspense><PublicWishlistPage /></RouteSuspense>} />
        <Route path="/terms" element={<RouteSuspense><TermsPage /></RouteSuspense>} />
        <Route path="/privacy" element={<RouteSuspense><PrivacyPage /></RouteSuspense>} />
        <Route path="/refund-policy" element={<RouteSuspense><RefundPolicyPage /></RouteSuspense>} />
        <Route path="/shipping" element={<RouteSuspense><ShippingPage /></RouteSuspense>} />
        <Route path="/payment" element={<RouteSuspense><PaymentPage /></RouteSuspense>} />
        <Route path="/cookies" element={<RouteSuspense><PrivacyPage /></RouteSuspense>} />
        <Route path="/seller-agreement" element={<RouteSuspense><TermsPage /></RouteSuspense>} />
        <Route path="/prohibited-items" element={<RouteSuspense><TermsPage /></RouteSuspense>} />
        <Route path="/about" element={<RouteSuspense><AboutPage /></RouteSuspense>} />
        <Route path="/faq" element={<RouteSuspense><AboutPage /></RouteSuspense>} />
        <Route path="/contact" element={<RouteSuspense><ContactPage /></RouteSuspense>} />

        {/* Role redirect */}
        <Route path="/dashboard" element={<RoleRedirect />} />

        {/* Admin */}
        <Route path="/admin/dashboard" element={<AdminRoute><RouteSuspense><AdminDashboard /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/sellers" element={<AdminRoute><RouteSuspense><AdminSellers /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/ads" element={<AdminRoute><RouteSuspense><AdminAds /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/collections" element={<AdminRoute><RouteSuspense><AdminCollections /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><RouteSuspense><AdminAnalytics /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/disputes" element={<AdminRoute><RouteSuspense><AdminDisputes /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><RouteSuspense><AdminProducts /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><RouteSuspense><AdminOrders /></RouteSuspense></AdminRoute>} />
        <Route path="/admin/pages" element={<AdminRoute><RouteSuspense><AdminPages /></RouteSuspense></AdminRoute>} />

        {/* Seller */}
        <Route path="/seller/dashboard" element={<SellerRoute><RouteSuspense><SellerDashboard /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/products" element={<SellerRoute><RouteSuspense><SellerProducts /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/store" element={<SellerRoute><RouteSuspense><SellerStore /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/collections" element={<SellerRoute><RouteSuspense><SellerCollections /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/orders" element={<SellerRoute><RouteSuspense><SellerOrders /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/reviews" element={<SellerRoute><RouteSuspense><SellerReviews /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/analytics" element={<SellerRoute><RouteSuspense><SellerAnalytics /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/ads" element={<SellerRoute><RouteSuspense><SellerAds /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/wallet" element={<SellerRoute><RouteSuspense><SellerWallet /></RouteSuspense></SellerRoute>} />
        <Route path="/seller/chat" element={<SellerRoute><RouteSuspense><SellerChat /></RouteSuspense></SellerRoute>} />

        {/* Buyer */}
        <Route path="/buyer/dashboard" element={<BuyerRoute><RouteSuspense><BuyerDashboard /></RouteSuspense></BuyerRoute>} />
        <Route path="/buyer/profile" element={<BuyerRoute><RouteSuspense><BuyerProfile /></RouteSuspense></BuyerRoute>} />
        <Route path="/buyer/orders" element={<BuyerRoute><RouteSuspense><BuyerOrders /></RouteSuspense></BuyerRoute>} />
        <Route path="/buyer/wishlist" element={<BuyerRoute><RouteSuspense><BuyerWishlist /></RouteSuspense></BuyerRoute>} />
        <Route path="/buyer/tracking" element={<BuyerRoute><RouteSuspense><BuyerTracking /></RouteSuspense></BuyerRoute>} />
        <Route path="/buyer/chat" element={<BuyerRoute><RouteSuspense><BuyerChat /></RouteSuspense></BuyerRoute>} />
        <Route path="/buyer/reports" element={<BuyerRoute><RouteSuspense><BuyerReports /></RouteSuspense></BuyerRoute>} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </PageTransition>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <CurrencyProvider>
            <CartProvider>
              <NotificationsHub />
              <CookieConsent />
        <AppRoutes />
      </CartProvider>
    </CurrencyProvider>
  </AuthProvider>
</BrowserRouter>
</TooltipProvider>
</QueryClientProvider>
);

export default App;
