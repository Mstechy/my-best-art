import { useState } from "react";
import { Button } from "./ui/button";
import { Check, Link2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface CopyLinkButtonProps {
  url?: string;
  label?: string;
  className?: string;
  variant?: "outline" | "ghost" | "default" | "secondary";
  size?: "sm" | "default" | "icon";
}

export default function CopyLinkButton({
  url,
  label = "Copy Link",
  className,
  variant = "outline",
  size = "sm",
}: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const target = url ?? (typeof window !== "undefined" ? window.location.href : "");
    if (!target) return;
    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link");
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn("gap-2 transition-all min-h-[44px] sm:min-h-0", className)}
      aria-label={copied ? "Link copied" : label}
    >
      <span className="relative inline-flex h-4 w-4 items-center justify-center">
        <Link2
          className={cn(
            "h-4 w-4 absolute transition-all duration-200",
            copied ? "opacity-0 scale-50 rotate-90" : "opacity-100 scale-100 rotate-0"
          )}
        />
        <Check
          className={cn(
            "h-4 w-4 absolute text-accent transition-all duration-200",
            copied ? "opacity-100 scale-100 rotate-0" : "opacity-0 scale-50 -rotate-90"
          )}
        />
      </span>
      {size !== "icon" && <span>{copied ? "Copied!" : label}</span>}
    </Button>
  );
}
