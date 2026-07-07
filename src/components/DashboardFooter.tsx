import { Link } from "react-router-dom";

export default function DashboardFooter() {
  return (
    <footer className="mt-8 border-t border-border/60 py-4 px-4 lg:px-6 text-xs text-muted-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <Link to="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
          <Link to="/refund-policy" className="hover:text-foreground transition-colors">Refund Policy</Link>
          <Link to="/contact" className="hover:text-foreground transition-colors">Help</Link>
        </div>
        <span>© 2026 MarketHub</span>
      </div>
    </footer>
  );
}
