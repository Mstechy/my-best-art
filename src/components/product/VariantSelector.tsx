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
    // Find a variant matching the newly selected value + all other currently selected values
    const candidate = variants.find(v =>
      v.option_values[key] === value &&
      attributeKeys.every(k => {
        const current = selectedValues[k];
        return !current || k === key || v.option_values[k] === current;
      })
    );
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
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => handleSelect(key, value)}
                    className={`relative px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${isSelected ? "bg-[#111111] dark:bg-[#FAF5F2] text-white dark:text-[#111111] border-transparent" : "bg-white dark:bg-[#1E1E1E] border-[#E8E8E8] dark:border-[#222222] hover:border-[#111111] dark:hover:border-[#555555]"}`}
                  >
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