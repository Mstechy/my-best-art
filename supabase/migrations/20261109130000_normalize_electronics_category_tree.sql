-- Data migration only: keep the existing category ids and URLs, but make the
-- canonical phone department a child of Electronics for buyer navigation.
-- This is idempotent and intentionally does not move any products between
-- category ids. A forward migration can restore the previous root relationship
-- with: UPDATE public.categories SET parent_id = NULL WHERE slug = 'phones-accessories';

UPDATE public.categories AS child
SET parent_id = parent.id
FROM public.categories AS parent
WHERE child.slug = 'phones-accessories'
  AND parent.slug = 'electronics'
  AND child.id <> parent.id
  AND child.parent_id IS DISTINCT FROM parent.id;
