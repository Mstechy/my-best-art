import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "@/lib/utils";

type ContainerProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
};

/**
 * Keeps primary page content aligned at every breakpoint.
 * Use this instead of repeating page-level max-width and horizontal padding classes.
 */
export function Container({ children, className, ...props }: ContainerProps) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4 sm:px-6 lg:px-8", className)} {...props}>
      {children}
    </div>
  );
}
