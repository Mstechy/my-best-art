import { useEffect, useRef, ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * Reusable bottom-sheet modal. Slides up from the bottom, covers ~85% of viewport.
 * Used for Specifications, Shipping, Returns, Security, and full descriptions.
 */
export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Body scroll lock + Escape key + focus management
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    const focusable = panelRef.current?.querySelector<HTMLElement>("button, a, [tabindex]");
    focusable?.focus();
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-[70] flex items-end justify-center transition-opacity duration-300",
        open ? "opacity-100" : "pointer-events-none opacity-0"
      )}
      aria-hidden={!open}
    >
      {/* Dimmed overlay */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative z-10 flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out dark:bg-[#1E1E1E]",
          open ? "translate-y-0" : "translate-y-full",
          className
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 rounded-full bg-[#E8E8E8] dark:bg-[#333333]" />
        </div>

        {/* Title bar */}
        <div className="flex items-center justify-between border-b border-[#E8E8E8] px-4 py-3 dark:border-[#222222]">
          <h3 className="text-sm font-bold text-[#111111] dark:text-[#FAF5F2]">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-[#888880] transition-colors hover:bg-[#F2F3F5] hover:text-[#111111] dark:hover:bg-[#2A2A2D] dark:hover:text-[#FAF5F2]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );
}

export default BottomSheet;