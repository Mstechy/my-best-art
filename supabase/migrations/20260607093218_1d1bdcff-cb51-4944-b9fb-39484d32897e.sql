
-- 1. Block self-purchase
CREATE OR REPLACE FUNCTION public.orders_block_self_purchase()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.buyer_id = NEW.seller_id THEN
    RAISE EXCEPTION 'You cannot purchase your own products';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_block_self_purchase ON public.orders;
CREATE TRIGGER trg_orders_block_self_purchase
BEFORE INSERT OR UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.orders_block_self_purchase();

-- 2. Title-case product names
CREATE OR REPLACE FUNCTION public.products_titlecase_name()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parts text[];
  out_parts text[] := '{}';
  w text;
  i int;
BEGIN
  IF NEW.title IS NULL OR length(trim(NEW.title)) = 0 THEN
    RETURN NEW;
  END IF;
  NEW.title := regexp_replace(trim(NEW.title), '\s+', ' ', 'g');
  parts := string_to_array(NEW.title, ' ');
  FOR i IN 1..array_length(parts, 1) LOOP
    w := parts[i];
    IF length(w) > 0 THEN
      out_parts := out_parts || (upper(substr(w,1,1)) || lower(substr(w,2)));
    END IF;
  END LOOP;
  NEW.title := array_to_string(out_parts, ' ');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_products_titlecase ON public.products;
CREATE TRIGGER trg_products_titlecase
BEFORE INSERT OR UPDATE OF title ON public.products
FOR EACH ROW EXECUTE FUNCTION public.products_titlecase_name();

-- Normalize existing product names
UPDATE public.products SET title = title WHERE title IS NOT NULL;

-- 3. Dispute reason validation (gibberish guard)
CREATE OR REPLACE FUNCTION public.disputes_validate_reason()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.reason IS NULL OR length(trim(NEW.reason)) < 5 THEN
    RAISE EXCEPTION 'Dispute reason must be at least 5 characters';
  END IF;
  -- must contain at least one vowel
  IF NEW.reason !~* '[aeiou]' THEN
    RAISE EXCEPTION 'Dispute reason appears invalid';
  END IF;
  -- reject 4+ identical characters in a row
  IF NEW.reason ~ '(.)\1{3,}' THEN
    RAISE EXCEPTION 'Dispute reason appears invalid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_disputes_validate_reason ON public.disputes;
CREATE TRIGGER trg_disputes_validate_reason
BEFORE INSERT OR UPDATE ON public.disputes
FOR EACH ROW EXECUTE FUNCTION public.disputes_validate_reason();

-- 4. Ad tracking RPCs
CREATE OR REPLACE FUNCTION public.track_ad_impression(_ad_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ads SET impressions = COALESCE(impressions, 0) + 1
  WHERE id = _ad_id AND status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.track_ad_click(_ad_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ads SET clicks = COALESCE(clicks, 0) + 1
  WHERE id = _ad_id AND status = 'active';
$$;

GRANT EXECUTE ON FUNCTION public.track_ad_impression(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_ad_click(uuid) TO anon, authenticated;

-- 5. Unify revenue: admin counts only delivered orders to match seller view
CREATE OR REPLACE FUNCTION public.admin_platform_counts()
 RETURNS TABLE(sellers integer, buyers integer, total_users integer, products integer, orders integer, disputes integer, revenue numeric, pending_products integer, pending_sellers integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    (SELECT count(DISTINCT p.user_id)::integer FROM public.profiles p WHERE public.is_seller_capable(p.user_id)) AS sellers,
    (SELECT count(DISTINCT p.user_id)::integer FROM public.profiles p WHERE public.has_role(p.user_id, 'buyer'::text) AND NOT public.is_seller_capable(p.user_id)) AS buyers,
    (SELECT count(*)::integer FROM public.profiles) AS total_users,
    (SELECT count(*)::integer FROM public.products) AS products,
    (SELECT count(*)::integer FROM public.orders) AS orders,
    (SELECT count(*)::integer FROM public.disputes WHERE status = 'open'::dispute_status) AS disputes,
    (SELECT COALESCE(sum(total_amount), 0) FROM public.orders WHERE status = 'delivered'::order_status) AS revenue,
    (SELECT count(*)::integer FROM public.products WHERE status = 'active'::product_status AND is_approved = false) AS pending_products,
    (SELECT count(*)::integer FROM public.profiles p WHERE public.has_role(p.user_id, 'seller'::text) AND p.is_approved = false AND p.is_banned = false) AS pending_sellers
  WHERE public.has_role(auth.uid(), 'admin'::text);
$$;
