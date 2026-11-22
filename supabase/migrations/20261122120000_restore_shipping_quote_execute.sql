-- Keep shipping quotes callable only by signed-in buyers.
-- The function itself validates auth.uid() and runs as SECURITY DEFINER. This
-- grant is repeated here because a remote environment can have the function
-- definition while missing the execute grant after a partial migration.
REVOKE ALL ON FUNCTION public.quote_marketplace_shipping(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.quote_marketplace_shipping(uuid, jsonb, text) TO authenticated;

-- Make the function/grant visible to PostgREST without restarting the API.
NOTIFY pgrst, 'reload schema';
