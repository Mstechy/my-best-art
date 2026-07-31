import { Link } from "react-router-dom";
import { Mail } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function SiteFooter() {
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-[#E8E8E8] dark:border-[#222222] bg-[#F2F3F5] dark:bg-[#111111] text-[#111111] dark:text-[#FAF5F2] w-full pt-12 pb-6">
      <div className="mx-auto max-w-7xl px-4 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">{t("footer.shop")}</h4>
            <ul className="space-y-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
              <li><Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.allProducts")}</Link></li>
              <li><Link to="/categories" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.categories")}</Link></li>
              <li><Link to="/marketplace?sort=best_sellers" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.topSellers")}</Link></li>
              <li><Link to="/marketplace?promo=summer20" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.dealsDiscounts")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">{t("footer.sell")}</h4>
            <ul className="space-y-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
              <li><Link to="/auth/register" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.becomeVendor")}</Link></li>
              <li><Link to="/auth/login" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.merchantDashboard")}</Link></li>
              <li><Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.sellerGuidelines")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">{t("footer.support")}</h4>
            <ul className="space-y-2 text-xs text-[#888880] dark:text-[#A0A0A0]">
              <li><Link to="/auth/login" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.buyerCenter")}</Link></li>
              <li><Link to="/marketplace" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.shippingDelivery")}</Link></li>
              <li><Link to="/terms" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.paymentEscrow")}</Link></li>
              <li><Link to="/contact" className="hover:text-[#111111] dark:hover:text-[#F6C75D] transition-colors">{t("footer.contactSupport")}</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-sans text-xs font-bold uppercase tracking-wider text-[#111111] dark:text-[#FAF5F2] mb-4">{t("footer.marketHub")}</h4>
            <p className="text-xs text-[#888880] dark:text-[#A0A0A0] leading-relaxed">
              {t("footer.description")}
            </p>
          </div>
        </div>
        <div className="border-t border-[#E8E8E8] dark:border-[#222222] mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#888880] dark:text-[#A0A0A0]">
          <p>&copy; {year} MarketHub. {t("footer.rights")}</p>
          <div className="flex items-center gap-1">
            <Mail className="h-3.5 w-3.5" /> support@markethub.com
          </div>
        </div>
      </div>
    </footer>
  );
}
