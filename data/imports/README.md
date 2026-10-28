# Your own data (tier 3 imports)

Put `.json` or `.csv` files here. The API loads them at start-up (and on
`POST /v1/admin/import/reload`). Each row joins the normal search and ranking, labelled with its
source name. Rows are **sample data by default**: set `is_sample` / `isSample` to `false` only
for real prices you collected yourself.

## CSV (shopping and grocery)

| Column                                                                                    | Example                             | Notes                                          |
| ----------------------------------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------- |
| vertical                                                                                  | shopping / grocery                  | required                                       |
| external_id                                                                               | tn-store-001                        | optional, stable id                            |
| source_name                                                                               | T Nagar Mobiles                     | shown to users                                 |
| is_sample                                                                                 | true                                | default true                                   |
| title                                                                                     | Samsung Galaxy S24 FE 5G 128GB Mint | required                                       |
| url                                                                                       | https://example.com/s24fe           | required, a real link                          |
| price_rs                                                                                  | 34490                               | required, GST-inclusive                        |
| mrp_rs, delivery_rs, handling_rs, platform_fee_rs                                         |                                     | optional                                       |
| rating, rating_count, eta_min, return_days                                                |                                     | optional                                       |
| brand, model, storage_gb, ram_gb, colour, size, category, seller, gtin, mpn, model_number |                                     | shopping                                       |
| product, quantity, pack_count, min_order_rs, free_delivery_above_rs                       | Toned Milk, 500 ml                  | grocery                                        |
| pincodes                                                                                  | 600017 600042                       | where it delivers; empty = anywhere (shopping) |
| observed_at                                                                               | 2026-10-29T09:00:00Z                | when you saw the price                         |

## JSON (any vertical)

An array of canonical offers (see `packages/core/src/schemas.ts`) **without** `id` and `provenance`, plus optional
`externalId`, `isSample`, `observedAt`, `sourceName`. See `example-property.json`.
