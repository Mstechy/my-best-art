import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type BrandCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/** Shared, token-based card surface for marketplace UI. */
export function BrandCard({ children, className, ...props }: BrandCardProps) {
  return (
    <div
      className={cn("rounded-xl border border-border bg-card text-card-foreground shadow-sm", className)}
      {...props}
    >
      {children}
    </div>
  );
}
