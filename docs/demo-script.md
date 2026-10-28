# Demo script (10 minutes)

Start: `docker compose up --build` → web http://localhost:3100, API docs http://localhost:4100/docs,
mail http://localhost:8025.

1. **Home (1 min).** Point out the sample-data banner and the four example searches. Switch to Tamil and back.
2. **US-1 phone (2 min).** "S24 FE 128GB in Velachery". Show: only 128 GB results; total cost line items; "checked
   N min ago"; Sample badge. Click *Cheapest* vs *Fastest* (Croma wins on speed). Open "Why is this #1?". Scroll to the
   last result: ₹19,999 listing flagged "price looks too low" and its injected text hidden.
3. **US-2 food (1 min).** Veg biryani for 2 in Adyar ≤ ₹300 in 40 min. The total includes delivery, packaging,
   platform fee and 5% GST, minus a verified coupon (₹276.45).
4. **US-3 grocery (1 min).** Weekly list in T Nagar. Show the split, per-app fees, "cheapest single app" comparison
   and "Method: exhaustive".
5. **US-4 rentals (1 min).** 2 BHK near OMR. Duplicates merged ("Also listed on"), scam listing flagged, no phone numbers.
6. **Detail + alert (1.5 min).** Open an item → 90-day chart (sample history), MRP check. Create an alert, open
   Mailpit, click the link, then search again and show the "Price alert" email. Saved page → download / delete my data.
7. **Assistant (1.5 min).** Ask "Cheapest veg biryani for 2 under Rs 300 in Adyar" → "What I checked" panel. Ask
   "biryani in Bengaluru" → Chennai only. Ask "best price for iPhone 16" → one clarifying question.
8. **Transparency (1 min).** Sources page: tiers, compliance notes, disabled official APIs, health. About page.

Backup commands: `npm run ci`, `npm run eval`, `npm run e2e`, `npm run eval:match -w @cuc/core`.
