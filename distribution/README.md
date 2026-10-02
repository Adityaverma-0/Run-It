# Sanket Distribution

A responsive wholesale FMCG distribution workspace with a restrained claymorphism interface. Uses React, Vinext, TypeScript and Neon PostgreSQL. No seed or demonstration records are included.

## Run locally

```sh
npm ci
cp .env.example .env
# Put your Neon connection string in DATABASE_URL, server-side only.
npm run db:migrate
npm run dev
```

Open the Local URL printed by the dev server. Local sign-in uses the Sites starter's loopback-only preview session; it is not persisted as a business user. Production uses verified ChatGPT identity and server-side role checks. The initial authenticated visitor to the owner-private deployment becomes the business owner, including when staff have already been added in the local preview. Keep the deployment private until the owner has signed in.

## First working day

1. Settings → configure business details and add actual team members with their sign-in emails.
2. Routes → add your routes.
3. Products → enter the catalogue, base units, packaging ratios, prices and stock minimums.
4. Inventory → receive actual warehouse stock.
5. Customers → add shops, their routes and credit limits. A zero credit limit requires payment in full.
6. Vehicles → add vehicles and assign a salesman and route.
7. Loads → choose a vehicle, add products, review and confirm. Quantities use each product's base unit.
8. Vehicles → View → Dispatch vehicle. Sales require a vehicle on route for the current business day.
9. Sales → New sale. Choose a customer, quantities, discount and payment. Prices and taxes are calculated again on the server.
10. Payments → collect outstanding credit. Collections are allocated to unpaid invoices, oldest first.
11. Reconciliation → count all stock and confirm HOLD or UNLOAD. No partial unload exists. Only owners/warehouse managers can record a shortage, with a reason.
12. On the next day, add a new load or use “Start day with held stock” to carry the retained stock forward without loading more.

## Roles and access

Owner, warehouse manager, warehouse staff, sales manager, salesman and accountant have different navigation and permitted operations. Salesmen can act only on their assigned vehicles and route customers. Authorization is enforced on the server; changing visible navigation cannot grant access. Staff must be allowed by both Site sharing and their registered active account. Adding a member does not send email. Password recovery is handled by ChatGPT or the chosen identity provider.

## Data integrity

- Tables are isolated in the `distribution` PostgreSQL schema.
- Stock/payment operations run in a single PostgreSQL function transaction, with a transaction-level advisory lock and row locks.
- Warehouse and vehicle balances cannot be negative.
- Sales cannot exceed vehicle stock or the customer's credit limit.
- Payment collection cannot exceed outstanding balance.
- Multi-product operations roll back completely on any failure.
- HOLD retains stock. UNLOAD returns every remaining product and closes with zero vehicle stock.
- Each confirmed operation is audit logged and idempotent by request UUID and payload.
- State is read in a repeatable-read snapshot.
- Currency uses PostgreSQL decimal values; business dates use Asia/Kolkata.
- History is immutable through the UI. Stock is adjusted by explicit receipt, damage, or reconciliation records.

## Offline operation

In the production build, after one authenticated online visit, the app shell and last authorized snapshot are cached on the device. Sales and payments can be saved to an IndexedDB outbox. Pending sales reserve locally available stock. Each transaction shows Pending or Failed until confirmed; sync runs on reconnection and can be retried in Sync center. UUID idempotency prevents duplicates after ambiguous network failures. The server rechecks stock, day, role and credit on sync. Permanently rejected transactions can be removed with confirmation and entered again; ambiguous failures remain retryable. Sign-out is blocked until pending transactions are resolved and clears the device cache.

Install through your browser's Add to Home Screen / Install option when supported. Offline operation requires an initial online load; a brand-new device cannot sign in while offline. Closed-day or stale-stock conflicts require review; the app never claims rejected transactions succeeded.

## Reports and exports

Daily sales, vehicle sales, salesman performance, product sales, warehouse stock, outstanding customers, payment collection, reconciliation, stock movement, low stock, damage/loss. Filters use the report's relevant dimensions. CSV exports escape spreadsheet formula prefixes. PDF export uses the browser's print/save-as-PDF dialog. Invoice printouts use recorded line-item prices and amounts. All displayed statistics derive from database records.

## Verification

```sh
npm run typecheck
npm run build
node scripts/test-db.mjs
```

The integration test creates an isolated test schema inside a transaction and rolls the entire schema and fixtures back. It never inserts fixtures into application tables. It checks overselling, warehouse limits, credit limits, discounted tax, overpayment, invoice allocation, unauthorized roles, idempotent retries, HOLD carry-forward, next-day dispatch, complete UNLOAD and stock conservation.

Database access tests and migrations require the PostgreSQL `psql` CLI. Development previews bypass service-worker caching so edits appear immediately. Runtime access uses Neon's HTTP driver and works in Cloudflare Workers without TCP sockets.

## Deployment

The private Site is identified by `.openai/hosting.json`. Set DATABASE_URL as a secret runtime environment variable. Do not place credentials in the hosting manifest, frontend variables, source control, logs or browser bundles. Build output is `dist/server/index.js` (Worker) and `dist/client` (assets). The local `.env` is ignored. Schema migrations are explicit and rerunnable; review schema changes before applying them to a populated database.

## Practical limits

The app currently serves one business and one warehouse. The state endpoint returns its authorized history in one snapshot, which suits a small distribution operation; add server-side pagination and aggregate endpoints before very large datasets. Offline synchronization has been implemented but should also be acceptance-tested on the actual field devices and networks. Access sharing, external identity recovery and installation prompts are handled by their respective platforms.
