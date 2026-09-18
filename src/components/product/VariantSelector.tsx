import { useMemo } from "react";
import { Check } from "lucide-react";
import type { ProductVariant } from "@/hooks/useProductDetail";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedVariantId: string | null;
  onSelect: (variantId: string) => void;
}

// Keys that are not displayable attributes
const NON_ATTRIBUTE_KEYS = new Set(["sku", "id", "product_id"]);

/**
 * Generic variant/attribute selector (AliExpress-style).
 * Detects all attribute dimensions from the variants' option_values
 * (e.g. size, color, storage) and renders a labeled row of chips per
 * dimension. Selected option gets a visible border + checkmark.
 */
export default function VariantSelector({ variants, selectedVariantId, onSelect }: VariantSelectorProps) {
  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach(v => {
      Object.keys(v.option_values || {}).forEach(k => {
        if (!NON_ATTRIBUTE_KEYS.has(k) && v.option_values[k]) keys.add(k);
      });
    });
    return [...keys];
  }, [variants]);

  const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null;

  const selectedValues = useMemo(() => {
    const values: Record<string, string> = {};
    if (selectedVariant) {
      attributeKeys.forEach(k => {
        const val = selectedVariant.option_values[k];
        if (val) values[k] = val;
      });
    }
    return values;
  }, [selectedVariant, attributeKeys]);

  if (attributeKeys.length === 0) return null;

  const handleSelect = (key: string, value: string) => {
    // Prefer the closest compatible active variant, but allow changing one
    // dimension when the previous combination no longer exists.
    const candidates = variants.filter(v => v.is_active && v.stock_quantity > 0 && v.option_values[key] === value);
    const candidate = candidates.sort((a, b) => {
      const score = (variant: ProductVariant) => attributeKeys.reduce((total, k) =>
        total + (k !== key && selectedValues[k] && variant.option_values[k] === selectedValues[k] ? 1 : 0), 0);
      return score(b) - score(a);
    })[0];
    if (candidate) onSelect(candidate.id);
  };

  return (
    <div className="space-y-4">
      {attributeKeys.map(key => {
        const values = [...new Set(variants.map(v => v.option_values[key]).filter(Boolean))];
        const selectedValue = selectedValues[key] || "";
        return (
          <div key={key}>
            <p className="text-xs font-bold mb-2 capitalize">
              {key}: <span className="font-normal text-[#888880]">{selectedValue || "Select"}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {values.map(value => {
                const isSelected = selectedValue === value;
                const isAvailable = variants.some(variant =>
                  variant.is_active &&
                  variant.stock_quantity > 0 &&
                  variant.option_values[key] === value &&
                  attributeKeys.every(otherKey => otherKey === key || !selectedValues[otherKey] || variant.option_values[otherKey] === selectedValues[otherKey])
                );
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSelect(key, value)}
                    disabled={!isAvailable}
                    aria-label={`${key}: ${value}${isAvailable ? "" : ", unavailable"}`}
                    className={`relative px-4 py-2 rounded-lg text-xs font-semibold border transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${isSelected ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] border-[#E8E8E8] dark:border-[#222222] hover:border-[#111111] dark:hover:border-[#555555]"}`}
                  >
                    {key.toLowerCase() === "color" && <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/15" style={{ backgroundColor: value.toLowerCase() }} aria-hidden="true" />}
                    {value}
                    {isSelected && (
                      <Check className="absolute -top-1 -right-1 h-3 w-3 text-white bg-[#111111] dark:bg-[#FAF5F2] dark:text-[#111111] rounded-full p-0.5" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
