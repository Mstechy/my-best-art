import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  href?: string;
  linkLabel?: ReactNode;
  className?: string;
};

/**
 * A consistent heading and optional action for marketplace content sections.
 *
 * Matches the approved design's `.section-head`:
 *   flex items-baseline · justify-between · border-b --line · pb 12px
 *   h2 19px / weight 800 · "View all" 13px / 700 / --brand-dark
 *
 * Note: the title uses `text-foreground` (an HSL triplet) rather than
 * `text-ink`. Raw-var tokens like `--ink` are re-declared in dark mode, so
 * `text-ink` would stay DARK on a dark page. `foreground` inverts correctly.
 */
export function SectionHeader({ title, subtitle, action, href, linkLabel, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-3.5 flex items-baseline justify-between gap-4 border-b border-line pb-3", className)}>
      <div className="min-w-0">
        {subtitle && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[.18em] text-quiet">{subtitle}</p>
        )}
        <h2 className="text-[19px] font-extrabold tracking-tight text-foreground">{title}</h2>
      </div>
      {action ?? (href && linkLabel ? (
        <Link
          to={href}
          className="shrink-0 text-[13px] font-bold text-brand-dark transition-colors hover:text-brand"
        >
          {linkLabel}
        </Link>
      ) : null)}
    </div>
  );
}
