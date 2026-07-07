
CREATE TABLE IF NOT EXISTS public.store_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, seller_id)
);
GRANT SELECT ON public.store_follows TO anon;
GRANT SELECT, INSERT, DELETE ON public.store_follows TO authenticated;
GRANT ALL ON public.store_follows TO service_role;
ALTER TABLE public.store_follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read follows" ON public.store_follows FOR SELECT USING (true);
CREATE POLICY "follow own" ON public.store_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "unfollow own" ON public.store_follows FOR DELETE TO authenticated USING (auth.uid() = follower_id);

CREATE TABLE IF NOT EXISTS public.product_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  asker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_questions TO anon;
GRANT SELECT, INSERT ON public.product_questions TO authenticated;
GRANT ALL ON public.product_questions TO service_role;
ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read questions" ON public.product_questions FOR SELECT USING (true);
CREATE POLICY "ask own" ON public.product_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = asker_id AND length(trim(question)) >= 5);

CREATE TABLE IF NOT EXISTS public.product_question_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.product_questions(id) ON DELETE CASCADE,
  answerer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_question_answers TO anon;
GRANT SELECT, INSERT ON public.product_question_answers TO authenticated;
GRANT ALL ON public.product_question_answers TO service_role;
ALTER TABLE public.product_question_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read answers" ON public.product_question_answers FOR SELECT USING (true);
CREATE POLICY "seller or admin answers" ON public.product_question_answers FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = answerer_id AND (
    public.has_role(auth.uid(), 'admin'::text)
    OR EXISTS (
      SELECT 1 FROM public.product_questions q
      JOIN public.products p ON p.id = q.product_id
      WHERE q.id = question_id AND p.seller_id = auth.uid()
    )
  )
);

CREATE TABLE IF NOT EXISTS public.review_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  url text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.review_photos TO anon;
GRANT SELECT, INSERT, DELETE ON public.review_photos TO authenticated;
GRANT ALL ON public.review_photos TO service_role;
ALTER TABLE public.review_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read review photos" ON public.review_photos FOR SELECT USING (true);
CREATE POLICY "own review photo insert" ON public.review_photos FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.buyer_id = auth.uid())
);
CREATE POLICY "own review photo delete" ON public.review_photos FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.reviews r WHERE r.id = review_id AND r.buyer_id = auth.uid())
);

CREATE TABLE IF NOT EXISTS public.review_pins (
  review_id uuid PRIMARY KEY REFERENCES public.reviews(id) ON DELETE CASCADE,
  pinned_by uuid NOT NULL REFERENCES auth.users(id),
  pinned_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.review_pins TO anon;
GRANT SELECT ON public.review_pins TO authenticated;
GRANT ALL ON public.review_pins TO service_role;
ALTER TABLE public.review_pins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read pins" ON public.review_pins FOR SELECT USING (true);
CREATE POLICY "admin pins" ON public.review_pins FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::text))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::text));

CREATE TABLE IF NOT EXISTS public.product_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.product_documents TO anon;
GRANT SELECT, INSERT, DELETE ON public.product_documents TO authenticated;
GRANT ALL ON public.product_documents TO service_role;
ALTER TABLE public.product_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read docs" ON public.product_documents FOR SELECT USING (true);
CREATE POLICY "seller writes docs" ON public.product_documents FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
);
CREATE POLICY "seller deletes docs" ON public.product_documents FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = auth.uid())
);

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_sold_count boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS warranty_period text,
  ADD COLUMN IF NOT EXISTS key_features text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS subrating_description int,
  ADD COLUMN IF NOT EXISTS subrating_communication int,
  ADD COLUMN IF NOT EXISTS subrating_shipping int;

CREATE OR REPLACE FUNCTION public.product_sold_count(_product_id uuid)
RETURNS integer LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(sum(oi.quantity), 0)::integer
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.product_id = _product_id AND o.status = 'delivered'::order_status;
$$;

CREATE OR REPLACE FUNCTION public.store_credibility(_seller_id uuid)
RETURNS TABLE(avg_rating numeric, avg_description numeric, avg_communication numeric, avg_shipping numeric, positive int, neutral int, negative int, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(round(avg(r.rating)::numeric, 2), 0),
    COALESCE(round(avg(r.subrating_description)::numeric, 2), 0),
    COALESCE(round(avg(r.subrating_communication)::numeric, 2), 0),
    COALESCE(round(avg(r.subrating_shipping)::numeric, 2), 0),
    COALESCE(sum(CASE WHEN r.rating >= 5 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(sum(CASE WHEN r.rating BETWEEN 3 AND 4 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(sum(CASE WHEN r.rating <= 2 THEN 1 ELSE 0 END), 0)::int,
    COALESCE(count(*), 0)::int
  FROM public.reviews r
  JOIN public.products p ON p.id = r.product_id
  WHERE p.seller_id = _seller_id AND r.is_approved = true;
$$;

CREATE OR REPLACE FUNCTION public.product_review_keywords(_product_id uuid)
RETURNS TABLE(keyword text, count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH words AS (
    SELECT lower(regexp_split_to_table(coalesce(r.comment,''), '\s+')) AS w
    FROM public.reviews r
    WHERE r.product_id = _product_id AND r.is_approved = true
  ),
  filtered AS (
    SELECT regexp_replace(w, '[^a-z]', '', 'g') AS word FROM words
  )
  SELECT word AS keyword, count(*)::int AS count
  FROM filtered
  WHERE length(word) >= 4
    AND word NOT IN ('this','that','with','from','have','were','they','them','your','just','been','when','what','then','than','into','also','very','more','some','only','like','item','been','their','there','which','while','because','still','would','could','about','after','before','other')
  GROUP BY word
  ORDER BY count DESC
  LIMIT 4;
$$;

CREATE OR REPLACE FUNCTION public.notify_followers_new_product()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record;
BEGIN
  IF NEW.status <> 'active'::product_status THEN RETURN NEW; END IF;
  FOR f IN SELECT follower_id FROM public.store_follows WHERE seller_id = NEW.seller_id LOOP
    INSERT INTO public.notifications (user_id, type, title, body, link)
    VALUES (f.follower_id, 'store_new_product', 'New product from a store you follow',
      NEW.title, '/product/' || NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_followers_new_product ON public.products;
CREATE TRIGGER trg_notify_followers_new_product
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_followers_new_product();
