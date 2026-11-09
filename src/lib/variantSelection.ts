export type VariantSelectionRecord = {
  option_values: Record<string, string>;
  is_active: boolean;
  stock_quantity: number;
};

/**
 * Select an option while keeping the result on a real in-stock SKU whenever
 * possible. If a colour exists only in another storage size, the dependent
 * option is reconciled instead of leaving the shopper in a dead combination.
 */
export function selectVariantOptions(
  variants: readonly VariantSelectionRecord[],
  selectedOptions: Record<string, string>,
  key: string,
  value: string,
): Record<string, string> {
  const nextOptions = { ...selectedOptions, [key]: value };
  const available = variants.filter((variant) => variant.is_active && variant.stock_quantity > 0);
  const compatible = available.find((variant) =>
    Object.entries(nextOptions).every(([optionKey, optionValue]) => variant.option_values[optionKey] === optionValue),
  );
  if (compatible) return nextOptions;

  const firstMatchingSku = available.find((variant) => variant.option_values[key] === value);
  if (!firstMatchingSku) return nextOptions;

  return Object.fromEntries(
    Object.entries(firstMatchingSku.option_values).filter(([optionKey, optionValue]) => Boolean(optionValue)),
  );
}
