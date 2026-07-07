import { cn } from "@/lib/utils";

interface GradientOrbProps {
  className?: string;
  color?: "primary" | "seller" | "buyer" | "accent";
  size?: "sm" | "md" | "lg" | "xl";
}

const colorMap = {
  primary: "from-primary/30 to-primary/5",
  seller: "from-seller/30 to-seller/5",
  buyer: "from-buyer/30 to-buyer/5",
  accent: "from-accent/30 to-accent/5",
};

const sizeMap = {
  sm: "h-32 w-32",
  md: "h-64 w-64",
  lg: "h-96 w-96",
  xl: "h-[32rem] w-[32rem]",
};

export default function GradientOrb({
  className,
  color = "primary",
  size = "lg",
}: GradientOrbProps) {
  return (
    <div
      className={cn(
        "absolute rounded-full bg-gradient-to-br blur-3xl animate-float pointer-events-none",
        colorMap[color],
        sizeMap[size],
        className
      )}
      aria-hidden
    />
  );
}
