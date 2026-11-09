# Tradibu iPhone listing contract

This is the first product vertical to complete end-to-end. The goal is not to
make a decorative phone card; it is to make one real phone listing consistent
from seller entry to buyer discovery, product detail, checkout, and operational
dashboards.

## Buyer-facing contract

### Marketplace card

Show, in this order:

1. Primary product image with a stable aspect ratio and a real fallback.
2. Discount or availability badge only when backed by product data.
3. Product title containing brand + model, with storage only when it identifies
   the specific offer.
4. Current price, followed immediately by the short comparison line.
5. Up to three real signals such as `256GB`, `5G`, or `New / sealed`; omit
   unavailable values instead of reserving empty rows.
6. Rating/review count only when reviews exist.
7. Seller name and verification only when the public seller profile resolves.
8. Destination availability and variant indicator when applicable.

The card links to the immutable product route. A buyer must not be forced to
choose storage or colour in the card; those choices belong to the detail page
unless there is exactly one purchasable SKU.

### Category and filters

The canonical product type is `mobile-phones`. It uses the existing phone
attributes: brand, model, storage, colour, battery health, operating system,
connectivity, network, SIM type, cosmetic condition, and condition.

The buyer-facing phone category should expose useful filters in this order:

1. Brand
2. Price
3. Storage
4. Network (4G/5G)
5. Condition
6. Rating
7. Destination availability

The category must not create a second competing phone taxonomy. The database
category, seller product type, URL, filter fields, and analytics item metadata
must resolve to the same phone identity.

### Product detail

The product detail page owns the complete decision:

- gallery and selected colour/SKU image;
- title, price, stock and real reviews;
- storage/colour/network/SIM selection from active variants;
- battery health and cosmetic condition for used/refurbished devices;
- seller identity, shipping destination, delivery policy and buyer protection;
- specifications and supporting documents;
- add-to-cart/buy-now validation against the selected variant.

No serial number or IMEI is displayed publicly.

## Operational connection

| Surface | Source of truth | Must remain connected |
| --- | --- | --- |
| Seller listing form | `products`, `product_variants`, `product_images`, `variants.categoryAttributes` | Required phone fields, title quality, stock and media health |
| Admin moderation | Admin product query and approval RPCs | Listing completeness, approval state, product route |
| Marketplace | `search_products_combined` RPC | Category, filters, ranking, image, seller and availability |
| Product detail | `useProductDetailData` | Same product, variants, seller, policies and documents |
| Cart/checkout | cart state and secure checkout RPC | Selected variant, price, stock, seller and delivery quote |
| Analytics | discovery and GA4 item events | Same immutable product id and actual price |

## Current findings before the next slice

- Phone specification capture already exists and is stronger than the card
  presentation.
- Product detail already renders variant-aware purchase controls and a single
  specification section.
- The marketplace card now has natural content flow, but it did not yet expose
  compact phone comparison attributes.
- The category database currently has `Electronics` and `Phones & Accessories`
  as separate top-level records while the product-type config treats phones as
  an electronics type. This hierarchy must be normalized before expanding the
  category icon rail.
- Seller and admin listing tables already share the product row and image model;
  the next dashboard pass should surface the same phone listing health rather
  than inventing a separate dashboard representation.

## Acceptance gates for this vertical

- A valid iPhone title, image, price, stock, category and required attributes can
  move from seller draft to approved listing without losing values.
- Marketplace search for `iPhone` returns only approved active products and
  category filters remain scoped to phone attributes.
- The card shows only real compact comparison signals and no blank metadata row.
- The detail page can select a real storage/colour variant and passes its SKU to
  cart/checkout.
- Seller dashboard, admin moderation, buyer marketplace, detail, cart and order
  records all reference the same product id.
- Tests cover sparse data, a complete iPhone listing, unavailable variants and
  no-image/error states before the next product vertical begins.
