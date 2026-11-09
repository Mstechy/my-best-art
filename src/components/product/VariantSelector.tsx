import { useMemo } from "react";
import { Check } from "lucide-react";
import type { ProductVariant } from "@/hooks/useProductDetail";
import { selectVariantOptions } from "@/lib/variantSelection";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (options: Record<string, string>) => void;
}

const NON_ATTRIBUTE_KEYS = new Set(["sku", "id", "product_id"]);
const ATTRIBUTE_ORDER = ["storage", "color", "colour", "size", "ram", "capacity", "condition"];

const formatAttributeLabel = (key: string) => {
  const labels: Record<string, string> = {
    color: "Colour",
    colour: "Colour",
    storage: "Storage",
    ram: "RAM",
    size: "Size",
    capacity: "Capacity",
    condition: "Condition",
  };
  return labels[key.toLowerCase()] ?? key.replace(/([A-Z])/g, " $1").replace(/^./, (value) => value.toUpperCase());
};

export default function VariantSelector({ variants, selectedOptions, onChange }: VariantSelectorProps) {
  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((variant) => {
      Object.keys(variant.option_values || {}).forEach((key) => {
        if (!NON_ATTRIBUTE_KEYS.has(key) && variant.option_values[key]) keys.add(key);
      });
    });
    return [...keys].sort((a, b) => {
      const aIndex = ATTRIBUTE_ORDER.indexOf(a.toLowerCase());
      const bIndex = ATTRIBUTE_ORDER.indexOf(b.toLowerCase());
      return (aIndex < 0 ? ATTRIBUTE_ORDER.length : aIndex) - (bIndex < 0 ? ATTRIBUTE_ORDER.length : bIndex);
    });
  }, [variants]);

  if (attributeKeys.length === 0) return null;

  const isOptionAvailable = (key: string, value: string) => variants.some((variant) =>
    variant.is_active && variant.stock_quantity > 0 && variant.option_values[key] === value,
  );

  return (
    <div className="space-y-4">
      {attributeKeys.map((key) => {
        const values = [...new Set(variants.map((variant) => variant.option_values[key]).filter(Boolean))];
        const selectedValue = selectedOptions[key] || "";

        return (
          <fieldset key={key}>
            <legend className="mb-2 text-xs font-bold">
              {formatAttributeLabel(key)}: <span className="font-normal text-[#6E6C64]">{selectedValue || "Select"}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const isSelected = selectedValue === value;
                const isAvailable = isOptionAvailable(key, value);

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange(selectVariantOptions(variants, selectedOptions, key, value))}
                    disabled={!isAvailable}
                    aria-pressed={isSelected}
                    aria-label={`${formatAttributeLabel(key)}: ${value}${isAvailable ? ", available" : ", unavailable"}`}
                    className={`relative min-h-11 rounded-lg border px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${isSelected ? "border-transparent bg-[#111111] text-white dark:bg-[#FAF5F2] dark:text-[#111111]" : "border-[#E8E8E8] bg-white hover:border-[#111111] dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:border-[#555555]"}`}
                  >
                    {key.toLowerCase() === "color" && <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/15" style={{ backgroundColor: value.toLowerCase() }} aria-hidden="true" />}
                    {value}
                    {isSelected && <Check className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[#111111] p-0.5 text-white dark:bg-[#FAF5F2] dark:text-[#111111]" />}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
