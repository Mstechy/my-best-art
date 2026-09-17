import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",

        /* ── MarketHub brand variants ─────────────────────────────────────
           NOTE ON HOVER: `bg-brand` resolves to `var(--brand)`, an opaque raw
           value, so `hover:bg-brand/90` would emit nothing. Brand hovers
           therefore step to the neighbouring SOLID token (brand → brand-dark).
           Same rule everywhere: raw-var tokens cannot take an alpha modifier.
           ────────────────────────────────────────────────────────────── */
        // Primary commerce CTA ("Buy Now"). Ink-on-orange per the design's own
        // .pill rule — white on #ff7a1a is only 2.6:1 and fails WCAG AA.
        brand: "bg-brand text-ink hover:bg-brand-dark",
        // Secondary CTA ("Add to Cart") — outlined, fills with brand tint.
        brandOutline:
          "border-[1.5px] border-foreground bg-panel text-foreground hover:border-brand hover:bg-brand-tint hover:text-brand-dark",
        // Neutral outlined action (Message / Visit Store).
        outlineStrong:
          "border border-line-strong bg-panel text-foreground hover:bg-accent hover:text-accent-foreground",
        // Light button placed ON a dark surface (hero card, category rail).
        // Pinned to a white background, so dark ink text is correct in BOTH themes.
        onInk: "bg-white text-ink hover:bg-brand-tint",
        // Sale / urgency action.
        deal: "bg-deal text-white hover:bg-destructive",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        /* Pill family from the design (radius 999px). */
        pill: "h-11 rounded-full px-6 text-sm font-bold",
        pillSm: "h-9 rounded-full px-4 text-[13px] font-bold",
        pillLg: "h-12 rounded-full px-7 text-sm font-bold",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
