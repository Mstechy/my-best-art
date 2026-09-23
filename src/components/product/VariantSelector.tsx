import { useMemo } from "react";
import { Check } from "lucide-react";
import type { ProductVariant } from "@/hooks/useProductDetail";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (options: Record<string, string>) => void;
}

const NON_ATTRIBUTE_KEYS = new Set(["sku", "id", "product_id"]);

export default function VariantSelector({ variants, selectedOptions, onChange }: VariantSelectorProps) {
  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((variant) => {
      Object.keys(variant.option_values || {}).forEach((key) => {
        if (!NON_ATTRIBUTE_KEYS.has(key) && variant.option_values[key]) keys.add(key);
      });
    });
    return [...keys];
  }, [variants]);

  if (attributeKeys.length === 0) return null;

  const isOptionAvailable = (key: string, value: string) => {
    const nextOptions = { ...selectedOptions, [key]: value };
    return variants.some((variant) =>
      variant.is_active &&
      variant.stock_quantity > 0 &&
      Object.entries(nextOptions).every(([optionKey, optionValue]) => variant.option_values[optionKey] === optionValue),
    );
  };

  return (
    <div className="space-y-4">
      {attributeKeys.map((key) => {
        const values = [...new Set(variants.map((variant) => variant.option_values[key]).filter(Boolean))];
        const selectedValue = selectedOptions[key] || "";

        return (
          <div key={key}>
            <p className="mb-2 text-xs font-bold capitalize">
              {key}: <span className="font-normal text-[#888880]">{selectedValue || "Select"}</span>
            </p>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const isSelected = selectedValue === value;
                const isAvailable = isOptionAvailable(key, value);

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange({ ...selectedOptions, [key]: value })}
                    disabled={!isAvailable}
                    aria-label={`${key}: ${value}${isAvailable ? "" : ", unavailable"}`}
                    className={`relative rounded-lg border px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${isSelected ? "border-transparent bg-[#111111] text-white dark:bg-[#FAF5F2] dark:text-[#111111]" : "border-[#E8E8E8] bg-white hover:border-[#111111] dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:border-[#555555]"}`}
                  >
                    {key.toLowerCase() === "color" && <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/15" style={{ backgroundColor: value.toLowerCase() }} aria-hidden="true" />}
                    {value}
                    {isSelected && <Check className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#111111] p-0.5 text-white dark:bg-[#FAF5F2] dark:text-[#111111]" />}
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
