# Visual product search setup

This function analyses the uploaded image on the server and returns a catalogue query. It never exposes the AI key to browser users.

1. In Supabase Edge Function secrets, create `OPENAI_API_KEY` with your server-side OpenAI API key.
2. Deploy `visual-product-search` alongside the existing Edge Functions.
3. Upload a JPG, PNG, or WebP up to 5 MB through the camera icon in the marketplace search box.

The current implementation is a hybrid visual search:

- the browser creates a lightweight physical-image fingerprint for exact or near-duplicate catalogue photos;
- the server-side vision function extracts appearance terms from the pixels (colour, material, shape, product type, and visible brand/model) when a different angle or background needs broader recall;
- the marketplace keeps direct fingerprint matches first, then fills remaining slots with catalogue search matches from those generated terms.

The next discovery step is catalogue image embeddings, which compares an uploaded photo directly with indexed product images for stronger same-product ranking. Until that exists, the endpoint is protected by an allowlisted origin, a bounded payload, a request timeout, and a per-edge-instance rate limit. Set `VISUAL_SEARCH_ALLOWED_ORIGINS` in Supabase if the production domain changes.
