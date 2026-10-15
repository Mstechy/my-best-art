CREATE OR REPLACE FUNCTION public.seller_import_product_batch(p_products jsonb)
RETURNS TABLE(row_number integer, product_id uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_item jsonb;
  v_product_id uuid;
  v_existing public.products%ROWTYPE;
  v_existing_images jsonb;
  v_sku text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_seller_capable(auth.uid()) THEN
    RAISE EXCEPTION 'Seller access required';
  END IF;

  IF jsonb_typeof(p_products) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Import products must be provided as a JSON array';
  END IF;
  IF jsonb_array_length(p_products) < 1 OR jsonb_array_length(p_products) > 20 THEN
    RAISE EXCEPTION 'Import batches must contain between 1 and 20 products';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_products)
  LOOP
    v_sku := nullif(btrim(v_item->>'sku'), '');
    IF v_sku IS NULL THEN
      RAISE EXCEPTION 'Every imported product needs a SKU for safe retries';
    END IF;
    IF length(v_sku) > 100
      OR coalesce(v_item->>'condition', 'new') NOT IN ('new', 'used', 'refurbished')
      OR nullif(v_item->>'category_id', '') IS NULL THEN
      RAISE EXCEPTION 'Invalid SKU, condition, or category in CSV row %', v_item->>'row_number';
    END IF;
    IF nullif(btrim(v_item->>'title'), '') IS NULL
      OR length(v_item->>'title') > 200
      OR length(coalesce(v_item->>'description', '')) < 80
      OR length(v_item->>'description') > 5000
      OR coalesce((v_item->>'price')::numeric, 0) <= 0
      OR nullif(v_item->>'stock_quantity', '') IS NULL
      OR coalesce((v_item->>'stock_quantity')::integer, -1) < 0
      OR upper(coalesce(nullif(v_item->>'currency', ''), 'NGN')) NOT IN ('NGN', 'USD', 'GBP', 'EUR', 'CAD', 'AUD', 'ZAR', 'KES', 'GHS', 'INR', 'JPY', 'BRL', 'MXN')
      OR (nullif(v_item->>'compare_at_price', '') IS NOT NULL
        AND (v_item->>'compare_at_price')::numeric <= (v_item->>'price')::numeric)
      OR jsonb_typeof(v_item->'variants') IS DISTINCT FROM 'object'
      OR jsonb_typeof(v_item->'image_urls') IS DISTINCT FROM 'array'
      OR jsonb_array_length(v_item->'image_urls') < 1
      OR jsonb_array_length(v_item->'image_urls') > 12 THEN
      RAISE EXCEPTION 'Invalid product data in CSV row %', v_item->>'row_number';
    END IF;
    IF EXISTS (
      SELECT 1
      FROM jsonb_array_elements_text(v_item->'image_urls') AS image(url)
      WHERE image.url !~ '^https://[^[:space:]]+$'
    ) THEN
      RAISE EXCEPTION 'Every image URL must use HTTPS (CSV row %)', v_item->>'row_number';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtext(auth.uid()::text), hashtext(v_sku));
    SELECT p.* INTO v_existing
    FROM public.products p
    WHERE p.seller_id = auth.uid() AND p.sku = v_sku
    LIMIT 1;

    IF FOUND THEN
      SELECT coalesce(jsonb_agg(pi.image_url ORDER BY pi.sort_order), '[]'::jsonb)
      INTO v_existing_images
      FROM public.product_images pi
      WHERE pi.product_id = v_existing.id;

      IF v_existing.status <> 'active'
        OR v_existing.title IS DISTINCT FROM v_item->>'title'
        OR v_existing.description IS DISTINCT FROM v_item->>'description'
        OR v_existing.price IS DISTINCT FROM (v_item->>'price')::numeric
        OR v_existing.compare_at_price IS DISTINCT FROM nullif(v_item->>'compare_at_price', '')::numeric
        OR v_existing.currency IS DISTINCT FROM upper(coalesce(nullif(v_item->>'currency', ''), 'NGN'))
        OR v_existing.category_id IS DISTINCT FROM (v_item->>'category_id')::uuid
        OR v_existing.stock_quantity IS DISTINCT FROM (v_item->>'stock_quantity')::integer
        OR v_existing.brand IS DISTINCT FROM nullif(v_item->>'brand', '')
        OR v_existing.gtin IS DISTINCT FROM nullif(v_item->>'gtin', '')
        OR v_existing.mpn IS DISTINCT FROM nullif(v_item->>'mpn', '')
        OR v_existing.condition IS DISTINCT FROM v_item->>'condition'
        OR v_existing.color IS DISTINCT FROM nullif(v_item->>'color', '')
        OR v_existing.material IS DISTINCT FROM nullif(v_item->>'material', '')
        OR v_existing.dimensions IS DISTINCT FROM nullif(v_item->>'dimensions', '')
        OR v_existing.weight IS DISTINCT FROM nullif(v_item->>'weight', '')
        OR v_existing.seo_slug IS DISTINCT FROM nullif(v_item->>'seo_slug', '')
        OR v_existing.meta_description IS DISTINCT FROM nullif(v_item->>'meta_description', '')
        OR v_existing.variants IS DISTINCT FROM v_item->'variants'
        OR v_existing_images IS DISTINCT FROM v_item->'image_urls' THEN
        RAISE EXCEPTION 'SKU "%" already belongs to a different product (CSV row %)', v_sku, v_item->>'row_number';
      END IF;

      row_number := (v_item->>'row_number')::integer;
      product_id := v_existing.id;
      RETURN NEXT;
      CONTINUE;
    END IF;

    INSERT INTO public.products (
      seller_id, title, description, price, compare_at_price, currency, category_id,
      stock_quantity, sku, brand, gtin, mpn, condition, color, material, dimensions,
      weight, status, is_approved, seo_slug, meta_description, low_stock_threshold,
      key_features, tags, ships_to, show_sold_count, variants
    ) VALUES (
      auth.uid(), btrim(v_item->>'title'), v_item->>'description',
      (v_item->>'price')::numeric, nullif(v_item->>'compare_at_price', '')::numeric,
      upper(coalesce(nullif(v_item->>'currency', ''), 'NGN')),
      (v_item->>'category_id')::uuid, (v_item->>'stock_quantity')::integer,
      v_sku, nullif(v_item->>'brand', ''), nullif(v_item->>'gtin', ''),
      nullif(v_item->>'mpn', ''), coalesce(nullif(v_item->>'condition', ''), 'new'),
      nullif(v_item->>'color', ''), nullif(v_item->>'material', ''),
      nullif(v_item->>'dimensions', ''), nullif(v_item->>'weight', ''),
      'active'::public.product_status, false, nullif(v_item->>'seo_slug', ''),
      nullif(v_item->>'meta_description', ''), 5, NULL, NULL, '{}'::text[], true,
      v_item->'variants'
    )
    RETURNING id INTO v_product_id;

    INSERT INTO public.product_images (product_id, image_url, is_primary, sort_order)
    SELECT
      v_product_id,
      image.url,
      image.ordinality = 1,
      (image.ordinality - 1)::integer
    FROM jsonb_array_elements_text(v_item->'image_urls') WITH ORDINALITY AS image(url, ordinality);

    row_number := (v_item->>'row_number')::integer;
    product_id := v_product_id;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.seller_import_product_batch(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seller_import_product_batch(jsonb) TO authenticated;
