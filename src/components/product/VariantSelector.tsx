import { useMemo } from "react";
import { Check } from "lucide-react";
import type { ProductVariant } from "@/hooks/useProductDetail";
import { selectVariantOptions } from "@/lib/variantSelection";
import { formatVariantAttributeLabel, getVariantAttributeOrder, type ProductSurface } from "@/lib/productDetailPresentation";
import ProductImage from "@/components/product/ProductImage";

interface VariantSelectorProps {
  variants: ProductVariant[];
  selectedOptions: Record<string, string>;
  onChange: (options: Record<string, string>) => void;
  surface?: ProductSurface;
}

const NON_ATTRIBUTE_KEYS = new Set(["sku", "id", "product_id"]);

export default function VariantSelector({
  variants,
  selectedOptions,
  onChange,
  // Preserve the historical ordering for callers that do not yet provide an
  // explicit category surface. Product detail pages pass their real surface.
  surface = "phone",
}: VariantSelectorProps) {
  const attributeOrder = getVariantAttributeOrder(surface);
  const attributeKeys = useMemo(() => {
    const keys = new Set<string>();
    variants.forEach((variant) => {
      Object.keys(variant.option_values || {}).forEach((key) => {
        if (!NON_ATTRIBUTE_KEYS.has(key) && variant.option_values[key]) keys.add(key);
      });
    });
    return [...keys].sort((a, b) => {
      const aIndex = attributeOrder.indexOf(a);
      const bIndex = attributeOrder.indexOf(b);
      return (aIndex < 0 ? attributeOrder.length : aIndex) - (bIndex < 0 ? attributeOrder.length : bIndex);
    });
  }, [attributeOrder, variants]);

  if (attributeKeys.length === 0) return null;

  const isOptionAvailable = (key: string, value: string) => {
    const availableVariants = variants.filter((variant) => variant.is_active && variant.stock_quantity > 0);
    const matchesCandidate = (variant: ProductVariant) => variant.option_values[key] === value;

    // A value must remain clickable when it exists on any real in-stock SKU.
    // A strict intersection with the currently selected dimensions would make
    // valid dependent choices look disabled (for example, 256GB only exists
    // with Yellow, while Black is currently selected). `selectVariantOptions`
    // reconciles those dependent dimensions to the real SKU after the click.
    const hasCompatibleVariant = availableVariants.some((variant) =>
      matchesCandidate(variant) &&
      Object.entries(selectedOptions).every(([selectedKey, selectedValue]) =>
        selectedKey === key || variant.option_values[selectedKey] === selectedValue,
      ),
    );

    return hasCompatibleVariant || availableVariants.some(matchesCandidate);
  };

  const selectableKeys = attributeKeys.filter((key) => {
    const values = new Set(variants
      .filter((variant) => variant.is_active && variant.stock_quantity > 0)
      .map((variant) => variant.option_values[key])
      .filter(Boolean));
    return values.size > 1;
  });

  if (selectableKeys.length === 0) {
    return (
      <p className="rounded-xl bg-[#F2F3F5] px-3 py-2.5 text-xs font-medium text-[#666666] dark:bg-[#222222] dark:text-[#A0A0A0]">
        This product has one available configuration.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {selectableKeys.map((key) => {
        const values = [...new Set(variants.map((variant) => variant.option_values[key]).filter(Boolean))];
        const selectedValue = selectedOptions[key] || "";

        return (
          <fieldset key={key}>
            <legend className="mb-2 text-xs font-bold">
              {formatVariantAttributeLabel(key)}: <span className="font-normal text-[#6E6C64]">{selectedValue || "Select"}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {values.map((value) => {
                const isSelected = selectedValue === value;
                const isAvailable = isOptionAvailable(key, value);
                const optionImage = variants.find((variant) =>
                  variant.is_active &&
                  variant.stock_quantity > 0 &&
                  variant.option_values[key] === value &&
                  Boolean(variant.image_url?.trim()),
                )?.image_url;
                const isImageOption = (key.toLowerCase() === "color" || key.toLowerCase() === "colour") && Boolean(optionImage);

                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onChange(selectVariantOptions(variants, selectedOptions, key, value))}
                    disabled={!isAvailable}
                    aria-pressed={isSelected}
                    aria-label={`${formatVariantAttributeLabel(key)}: ${value}${isAvailable ? ", available" : ", unavailable"}`}
                    className={`relative min-h-11 rounded-lg border px-4 py-2 text-xs font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through ${isSelected ? "border-transparent bg-[#111111] text-white dark:bg-[#FAF5F2] dark:text-[#111111]" : "border-[#E8E8E8] bg-white hover:border-[#111111] dark:border-[#222222] dark:bg-[#1E1E1E] dark:hover:border-[#555555]"}`}
                  >
                    {isImageOption ? (
                      <ProductImage variant="thumb" src={optionImage} alt="" className="mr-1.5 inline-block h-8 w-8 rounded-md object-cover align-middle" loading="lazy" />
                    ) : (
                      (key.toLowerCase() === "color" || key.toLowerCase() === "colour") && <span className="mr-1.5 inline-block h-3 w-3 rounded-full border border-black/15" style={{ backgroundColor: value.toLowerCase() }} aria-hidden="true" />
                    )}
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
