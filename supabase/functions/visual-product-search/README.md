# Visual product search setup

This function analyses the uploaded image on the server and returns a catalogue query. It never exposes the AI key to browser users.

1. In Supabase Edge Function secrets, create `OPENAI_API_KEY` with your server-side OpenAI API key.
2. Deploy `visual-product-search` alongside the existing Edge Functions.
3. Upload a JPG, PNG, or WebP up to 5 MB through the camera icon in the marketplace search box.

The current implementation is image-to-catalogue-query search. The next planned discovery step is catalogue image embeddings, which compares an uploaded photo directly with every indexed product image for same/similar-product ranking.
