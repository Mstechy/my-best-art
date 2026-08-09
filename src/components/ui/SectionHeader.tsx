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

/** A consistent heading and optional action for marketplace content sections. */
export function SectionHeader({ title, subtitle, action, href, linkLabel, className }: SectionHeaderProps) {
  return (
    <div className={cn("mb-4 flex items-center justify-between gap-4 border-b border-border pb-2", className)}>
      <div>
        {subtitle && <p className="mb-1 text-xs font-bold uppercase tracking-[.18em] text-muted-foreground">{subtitle}</p>}
        <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
      </div>
      {action ?? (href && linkLabel ? (
        <Link to={href} className="shrink-0 text-sm font-medium text-primary transition-colors hover:text-primary/80">
          {linkLabel}
        </Link>
      ) : null)}
    </div>
  );
}
