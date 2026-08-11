import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

/**
 * Shared breadcrumb trail: "Home / Marketplace / Electronics / [Product Name]"
 * Small muted text, current item darker/bolder.
 */
export function Breadcrumb({ items, className }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[13px] text-[#888880] dark:text-[#A0A0A0]", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <span key={`${item.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-[#C8C8C0] dark:text-[#444444]" />}
            {item.href && !isLast ? (
              <Link to={item.href} className="transition-colors hover:text-[#111111] dark:hover:text-[#FAF5F2]">
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast && "font-semibold text-[#111111] dark:text-[#FAF5F2]")}>{item.label}</span>
            )}
          </span>
        );
      })}
    </nav>
  );
}

export default Breadcrumb;