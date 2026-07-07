import { Link } from "react-router-dom";
import { ShoppingBag } from "lucide-react";

const sections = [
  {
    heading: "Legal",
    links: [
      { to: "/terms", label: "Terms of Service" },
      { to: "/privacy", label: "Privacy Policy" },
      { to: "/refund-policy", label: "Refund & Returns" },
      { to: "/cookies", label: "Cookie Policy" },
      { to: "/prohibited-items", label: "Prohibited Items" },
    ],
  },
  {
    heading: "Marketplace",
    links: [
      { to: "/marketplace", label: "Browse Products" },
      { to: "/seller-agreement", label: "Seller Agreement" },
      { to: "/faq", label: "FAQ" },
      { to: "/about", label: "About Us" },
      { to: "/contact", label: "Contact" },
    ],
  },
];

export default function SiteFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border bg-card/40 mt-16">
      <div className="mx-auto max-w-7xl px-4 lg:px-8 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link to="/" className="inline-flex items-center gap-2 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <ShoppingBag className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">MarketHub</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              A secure marketplace built on escrow, verified sellers, and buyer protection.
            </p>
          </div>

          {sections.map((s) => (
            <div key={s.heading}>
              <h3 className="font-display text-sm font-semibold text-foreground mb-3">{s.heading}</h3>
              <ul className="space-y-2">
                {s.links.map((l) => (
                  <li key={l.to}>
                    <Link to={l.to} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h3 className="font-display text-sm font-semibold text-foreground mb-3">Get in touch</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a className="hover:text-foreground" href="mailto:support@markethub.com">support@markethub.com</a></li>
              <li><a className="hover:text-foreground" href="mailto:privacy@markethub.com">privacy@markethub.com</a></li>
              <li><a className="hover:text-foreground" href="mailto:legal@markethub.com">legal@markethub.com</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <p>© {year} MarketHub. All rights reserved.</p>
          <p>Built with buyer protection and escrow at the core.</p>
        </div>
      </div>
    </footer>
  );
}
