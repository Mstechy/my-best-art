-- Replace a listing's SKU rows atomically.
--
-- The seller editor used to delete all variants and then insert the new set in
-- separate browser requests. If the second request failed, the product kept a
-- partial or empty SKU matrix. Keeping the replacement inside one transaction
-- makes the database the owner of that invariant.

CREATE OR REPLACE FUNCTION public.replace_product_variants(
  p_product_id uuid,
  p_variants jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_option_values jsonb;
  v_sku text;
  v_price numeric(12,2);
  v_stock integer;
  v_image_url text;
  v_sort_order integer := 0;
  v_is_admin boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  v_is_admin := public.has_role(auth.uid(), 'admin'::text);
  IF NOT v_is_admin AND NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
      AND seller_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only manage variants for your own product';
  END IF;

  IF p_variants IS NULL OR jsonb_typeof(p_variants) <> 'array' THEN
    RAISE EXCEPTION 'Variant payload must be an array';
  END IF;
  IF jsonb_array_length(p_variants) > 100 THEN
    RAISE EXCEPTION 'A product can have at most 100 variants';
  END IF;

  DELETE FROM public.product_variants
  WHERE product_id = p_product_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_variants) LOOP
    v_option_values := coalesce(v_item -> 'option_values', '{}'::jsonb);
    v_sku := nullif(trim(v_item ->> 'sku'), '');
    v_price := nullif(v_item ->> 'price', '')::numeric;
    v_stock := coalesce((v_item ->> 'stock_quantity')::integer, 0);
    v_image_url := nullif(trim(v_item ->> 'image_url'), '');

    IF jsonb_typeof(v_option_values) <> 'object' OR v_option_values = '{}'::jsonb THEN
      RAISE EXCEPTION 'Every variant needs at least one option';
    END IF;
    IF v_price IS NULL OR v_price <= 0 THEN
      RAISE EXCEPTION 'Every variant needs a price above zero';
    END IF;
    IF v_stock IS NULL OR v_stock < 0 THEN
      RAISE EXCEPTION 'Variant stock must be zero or greater';
    END IF;

    INSERT INTO public.product_variants (
      product_id, option_values, sku, price, stock_quantity, image_url, sort_order
    ) VALUES (
      p_product_id, v_option_values, v_sku, v_price, v_stock, v_image_url, v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  END LOOP;
END;
$$;

ALTER FUNCTION public.replace_product_variants(uuid, jsonb) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.replace_product_variants(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.replace_product_variants(uuid, jsonb) TO authenticated;
