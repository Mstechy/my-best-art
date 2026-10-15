# Google Search Console dashboard setup

The admin dashboard reads Search Console performance using Google's OAuth 2.0 authorization-code flow and the read-only `webmasters.readonly` scope. It does not use a service account or the Merchant Center API. Refresh tokens are encrypted before storage; the encryption key must remain in Supabase Edge Function secrets.

## One-time deployment

1. Apply the database migrations, including `20261015000000_google_merchant_feed.sql` and `20261015010000_google_search_console.sql`.
2. Deploy both Supabase Edge Functions: `google-feed` and `google-search-console`.
3. In Google Cloud Console, enable the Search Console API and create a Web application OAuth client. Configure this exact authorized redirect URI:

   `https://bnkyddmmhaaefzfvzpqs.supabase.co/functions/v1/google-search-console`

4. In Supabase Edge Function secrets, set:

   - `GOOGLE_OAUTH_CLIENT_ID`
   - `GOOGLE_OAUTH_CLIENT_SECRET`
   - `GOOGLE_OAUTH_REDIRECT_URI` to the exact redirect URI above
   - `GOOGLE_TOKEN_ENCRYPTION_KEY` to a new randomly generated secret; do not reuse it elsewhere
   - `GOOGLE_SEARCH_CONSOLE_APP_URL` to `https://www.tradibu.com` (optional; this is the default)
   - `FEED_SECRET` for scheduled feed generation

5. In Supabase Vault, create a secret named `google_feed_secret` whose value exactly matches `FEED_SECRET`. The scheduled job does not run until both copies are configured.
6. Deploy the Vercel configuration so `/feeds/google-products.xml` rewrites to the public generated object in Supabase Storage.
7. In Google Search Console, verify the site property and grant access to the Google account that will connect. In Tradibu's admin area, open **Google Merchant**, confirm the property identifier (`sc-domain:tradibu.com` for a Domain property or the exact URL-prefix property), then select **Connect Google account**.
8. In Google Merchant Center, add `https://www.tradibu.com/feeds/google-products.xml` as a scheduled fetch. The feed is refreshed after product changes and every three hours; Google controls its own fetch cadence.

## Geography and reporting limits

The Search Console API provides clicks, impressions, CTR, and average position by country, page, or date. It does not provide state/province or city dimensions. It can also omit low-volume rows; the report shows the rows Google returns. Search Console performance is organic Google Search data, not Merchant Center Shopping/free-listing campaign reporting.
