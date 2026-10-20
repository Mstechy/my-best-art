import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface CheckoutLine {
  product_id: string;
  product_variant_id?: string | null;
  quantity: number;
  price: number;
  stock_quantity: number;
}

export interface CheckoutAddress {
  name: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface ShippingQuote {
  sellerId: string;
  shipping_amount: number;
  currency: string;
  shipping_known: boolean;
  delivery_min_date: string | null;
  delivery_max_date: string | null;
  message: string | null;
}

export interface CheckoutReconciliation<T extends CheckoutLine> {
  items: T[];
  priceChanged: boolean;
  availabilityChanged: boolean;
}

type SellerGroups<T extends CheckoutLine> = Record<string, T[]>;

function toOrderLine(item: CheckoutLine) {
  return {
    product_id: item.product_id,
    product_variant_id: item.product_variant_id || null,
    quantity: item.quantity,
  };
}

/**
 * Quotes delivery through the authoritative database function. The UI may use
 * this result for display, but order creation revalidates it server-side.
 */
export async function quoteMarketplaceShipping<T extends CheckoutLine>(
  sellerGroups: SellerGroups<T>,
  destination: string,
): Promise<ShippingQuote[]> {
  const quotes = await Promise.all(
    Object.entries(sellerGroups).map(async ([sellerId, sellerItems]) => {
      const { data, error } = await (supabase as any).rpc("quote_marketplace_shipping", {
        p_seller_id: sellerId,
        p_destination: destination,
        p_items: sellerItems.map(toOrderLine),
      });
      if (error) throw error;

      const row = (Array.isArray(data) ? data[0] : data) as ShippingQuote | null;
      if (!row || !row.shipping_known) {
        throw new Error(row?.message || "Shipping fee is not configured for this seller.");
      }
      return { ...row, sellerId, shipping_amount: Number(row.shipping_amount) || 0 };
    }),
  );

  return quotes;
}

/**
 * Reconciles client cart state with live catalogue state before checkout.
 * Prices and inventory are still authoritative in the checkout RPC; this is a
 * user-facing preflight that avoids surprising submissions.
 */
export async function reconcileCheckoutItems<T extends CheckoutLine>(
  items: T[],
): Promise<CheckoutReconciliation<T>> {
  const productIds = [...new Set(items.map((item) => item.product_id))];
  const variantIds = items.flatMap((item) => item.product_variant_id ? [item.product_variant_id] : []);

  const { data: products, error: productError } = productIds.length
    ? await supabase.from("products").select("id, price, stock_quantity, status, is_approved").in("id", productIds)
    : { data: [], error: null };
  if (productError) throw productError;

  const { data: variants, error: variantError } = variantIds.length
    ? await supabase.from("product_variants").select("id, product_id, price, stock_quantity, is_active").in("id", variantIds)
    : { data: [], error: null };
  if (variantError) throw variantError;

  const productMap = new Map((products ?? []).map((product) => [product.id, product]));
  const variantMap = new Map((variants ?? []).map((variant) => [variant.id, variant]));
  let priceChanged = false;
  let availabilityChanged = false;

  const nextItems = items.map((item) => {
    const product = productMap.get(item.product_id);
    const variant = item.product_variant_id ? variantMap.get(item.product_variant_id) : null;
    const available = Boolean(
      product && product.status === "active" && product.is_approved &&
      (!item.product_variant_id || (variant && variant.product_id === product.id && variant.is_active)),
    );
    const livePrice = available ? Number(variant?.price ?? product.price) : item.price;
    const liveStock = available ? Number(variant?.stock_quantity ?? product.stock_quantity) : 0;

    if (livePrice !== item.price) priceChanged = true;
    if (!available || liveStock < item.quantity) availabilityChanged = true;

    return { ...item, price: livePrice, stock_quantity: liveStock };
  });

  return { items: nextItems, priceChanged, availabilityChanged };
}

/** Creates one atomic marketplace transaction across all seller groups. */
export async function createMarketplaceOrders<T extends CheckoutLine>(
  sellerGroups: SellerGroups<T>,
  address: CheckoutAddress,
  idempotencyKey: string,
): Promise<string[]> {
  const { data, error } = await supabase.rpc("place_marketplace_orders", {
    p_orders: Object.entries(sellerGroups).map(([sellerId, sellerItems]) => ({
      seller_id: sellerId,
      items: sellerItems.map(toOrderLine),
    })),
    p_shipping_address: address as unknown as Json,
    p_idempotency_key: idempotencyKey,
  });
  if (error) throw error;
  if (!data?.length) throw new Error("No marketplace orders were created.");
  return data;
}

export interface PaystackPayment {
  authorization_url: string;
  reference: string;
}

/** Initializes payment only after the server has created payable orders. */
export async function initializeMarketplacePayment(
  orderIds: string[],
  email: string | undefined,
  accessToken: string,
  publishableKey: string,
): Promise<PaystackPayment> {
  supabase.functions.setAuth(accessToken);
  const { data, error } = await supabase.functions.invoke("paystack", {
    body: { action: "initialize", orderIds, email },
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (error || !data?.authorization_url) {
    let message = error?.message || "Could not start secure payment.";
    const context = (error as { context?: Response } | null)?.context;
    if (context?.json) {
      try {
        const payload = await context.json() as { error?: string };
        if (payload.error) message = payload.error;
      } catch {
        // Keep the safe fallback when the function response is not JSON.
      }
    }
    throw new Error(message);
  }

  return data as PaystackPayment;
}
