import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

// Pages
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

// Admin
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminSellers from "@/pages/admin/AdminSellers";
import AdminAds from "@/pages/admin/AdminAds";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminDisputes from "@/pages/admin/AdminDisputes";
import AdminProducts from "@/pages/admin/AdminProducts";
import AdminOrders from "@/pages/admin/AdminOrders";
import AdminPages from "@/pages/admin/AdminPages";
import AdminCollections from "@/pages/admin/AdminCollections";
import ShippingPage from "@/pages/legal/ShippingPage";
import PaymentPage from "@/pages/legal/PaymentPage";
import AboutPage from "@/pages/legal/AboutPage";

// Seller
import SellerDashboard from "@/pages/seller/SellerDashboard";
import SellerProducts from "@/pages/seller/SellerProducts";
import SellerOrders from "@/pages/seller/SellerOrders";
import SellerAds from "@/pages/seller/SellerAds";
import SellerWallet from "@/pages/seller/SellerWallet";
import SellerChat from "@/pages/seller/SellerChat";
import SellerStore from "@/pages/seller/SellerStore";
import SellerReviews from "@/pages/seller/SellerReviews";
import SellerAnalytics from "@/pages/seller/SellerAnalytics";

// Buyer
import BuyerDashboard from "@/pages/buyer/BuyerDashboard";
import BuyerOrders from "@/pages/buyer/BuyerOrders";
import BuyerTracking from "@/pages/buyer/BuyerTracking";
import BuyerChat from "@/pages/buyer/BuyerChat";
import BuyerReports from "@/pages/buyer/BuyerReports";
import BuyerWishlist from "@/pages/buyer/BuyerWishlist";
import BuyerProfile from "@/pages/buyer/BuyerProfile";

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

function AppRoutes() {
  return (
    <PageTransition>
      <Routes>
        {/* Public */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
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
        <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/sellers" element={<AdminRoute><AdminSellers /></AdminRoute>} />
        <Route path="/admin/ads" element={<AdminRoute><AdminAds /></AdminRoute>} />
        <Route path="/admin/collections" element={<AdminRoute><AdminCollections /></AdminRoute>} />
        <Route path="/admin/analytics" element={<AdminRoute><AdminAnalytics /></AdminRoute>} />
        <Route path="/admin/disputes" element={<AdminRoute><AdminDisputes /></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminProducts /></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminOrders /></AdminRoute>} />
        <Route path="/admin/pages" element={<AdminRoute><AdminPages /></AdminRoute>} />

        {/* Seller */}
        <Route path="/seller/dashboard" element={<SellerRoute><SellerDashboard /></SellerRoute>} />
        <Route path="/seller/products" element={<SellerRoute><SellerProducts /></SellerRoute>} />
        <Route path="/seller/store" element={<SellerRoute><SellerStore /></SellerRoute>} />
        <Route path="/seller/orders" element={<SellerRoute><SellerOrders /></SellerRoute>} />
        <Route path="/seller/reviews" element={<SellerRoute><SellerReviews /></SellerRoute>} />
        <Route path="/seller/analytics" element={<SellerRoute><SellerAnalytics /></SellerRoute>} />
        <Route path="/seller/ads" element={<SellerRoute><SellerAds /></SellerRoute>} />
        <Route path="/seller/wallet" element={<SellerRoute><SellerWallet /></SellerRoute>} />
        <Route path="/seller/chat" element={<SellerRoute><SellerChat /></SellerRoute>} />

        {/* Buyer */}
        <Route path="/buyer/dashboard" element={<BuyerRoute><BuyerDashboard /></BuyerRoute>} />
        <Route path="/buyer/profile" element={<BuyerRoute><BuyerProfile /></BuyerRoute>} />
        <Route path="/buyer/orders" element={<BuyerRoute><BuyerOrders /></BuyerRoute>} />
        <Route path="/buyer/wishlist" element={<BuyerRoute><BuyerWishlist /></BuyerRoute>} />
        <Route path="/buyer/tracking" element={<BuyerRoute><BuyerTracking /></BuyerRoute>} />
        <Route path="/buyer/chat" element={<BuyerRoute><BuyerChat /></BuyerRoute>} />
        <Route path="/buyer/reports" element={<BuyerRoute><BuyerReports /></BuyerRoute>} />

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
