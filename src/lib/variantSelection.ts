export type VariantSelectionRecord = {
  option_values: Record<string, string>;
  is_active: boolean;
  stock_quantity: number;
};

const NON_ATTRIBUTE_KEYS = new Set(["sku", "id", "product_id"]);

const getAttributeKeys = (variants: readonly VariantSelectionRecord[]) => {
  const keys = new Set<string>();
  variants.forEach((variant) => {
    Object.entries(variant.option_values || {}).forEach(([key, value]) => {
      if (!NON_ATTRIBUTE_KEYS.has(key) && value) keys.add(key);
    });
  });
  return [...keys];
};

const getAvailableVariants = (variants: readonly VariantSelectionRecord[]) =>
  variants.filter((variant) => variant.is_active && variant.stock_quantity > 0);

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
  const available = getAvailableVariants(variants);
  const requested = { ...selectedOptions, [key]: value };
  const matchesRequested = (variant: VariantSelectionRecord) =>
    Object.entries(requested).every(([optionKey, optionValue]) => variant.option_values[optionKey] === optionValue);

  // Preserve all existing selections when they describe a real SKU.
  let compatible = available.filter(matchesRequested);

  // If a newly selected value makes the previous combination impossible, keep
  // the user's new choice and reconcile only the dependent dimensions against
  // the first real matching SKU. This avoids silently changing the dimension
  // the shopper just chose.
  if (compatible.length === 0) {
    const matchingChoice = available.find((variant) => variant.option_values[key] === value);
    if (!matchingChoice) return requested;

    const reconciled = Object.fromEntries(
      Object.entries(matchingChoice.option_values).filter(([optionKey, optionValue]) =>
        Boolean(optionValue) && (optionKey === key || selectedOptions[optionKey] === optionValue),
      ),
    );
    reconciled[key] = value;
    compatible = available.filter((variant) =>
      Object.entries(reconciled).every(([optionKey, optionValue]) => variant.option_values[optionKey] === optionValue),
    );

    if (compatible.length === 0) return reconciled;
    return resolveUniqueOptions(compatible, reconciled);
  }

  return resolveUniqueOptions(compatible, requested);
}

/**
 * Complete dimensions that have only one valid value after the shopper makes
 * a choice. For example, if 128GB exists only in Blue, choosing 128GB should
 * resolve the Blue SKU and update its image/price without showing a redundant
 * colour decision. Dimensions with multiple valid values remain unselected.
 */
export function resolveUniqueOptions(
  compatibleVariants: readonly VariantSelectionRecord[],
  selectedOptions: Record<string, string>,
): Record<string, string> {
  const resolved = { ...selectedOptions };
  const keys = getAttributeKeys(compatibleVariants);

  keys.forEach((key) => {
    if (resolved[key]) return;
    const values = [...new Set(compatibleVariants.map((variant) => variant.option_values[key]).filter(Boolean))];
    if (values.length === 1) resolved[key] = values[0];
  });

  return resolved;
}
