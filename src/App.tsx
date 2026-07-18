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

// Public pages (loaded immediately)
import LandingPage from "@/pages/LandingPage";
import MarketplacePage from "@/pages/MarketplacePage";
import ProductDetailPage from "@/pages/ProductDetailPage";
import SellerStorePage from "@/pages/SellerStorePage";
import CheckoutPage from "@/pages/CheckoutPage";
import OrderSuccessPage from "@/pages/OrderSuccessPage";
import LoginPage from "@/pages/auth/LoginPage";
import RegisterPage from "@/pages/auth/RegisterPage";
import NotFound from "@/pages/NotFound";
import PublicWishlistPage from "@/pages/PublicWishlistPage";
import TermsPage from "@/pages/legal/TermsPage";
import PrivacyPage from "@/pages/legal/PrivacyPage";
import RefundPolicyPage from "@/pages/legal/RefundPolicyPage";
import ContactPage from "@/pages/legal/ContactPage";
import CollectionPage from "@/pages/CollectionPage";
import CategoriesPage from "@/pages/CategoriesPage";

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
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:slug" element={<MarketplacePage />} />
        <Route path="/collections/:slug" element={<CollectionPage />} />
        <Route path="/product/:id" element={<ProductDetailPage />} />
        <Route path="/seller/:id" element={<SellerStorePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/order-success/:id" element={<OrderSuccessPage />} />
        <Route path="/auth/login" element={<LoginPage />} />
        <Route path="/auth/register" element={<RegisterPage />} />
        <Route path="/wishlist/:userId" element={<PublicWishlistPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/refund-policy" element={<RefundPolicyPage />} />
        <Route path="/shipping" element={<ShippingPage />} />
        <Route path="/payment" element={<PaymentPage />} />
        <Route path="/cookies" element={<PrivacyPage />} />
        <Route path="/seller-agreement" element={<TermsPage />} />
        <Route path="/prohibited-items" element={<TermsPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/faq" element={<AboutPage />} />
        <Route path="/contact" element={<ContactPage />} />

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
