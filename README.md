# RandWise

RandWise helps young founders and small businesses build everyday trading and money-management records.

## Run locally

Install dependencies and start the development server:

```powershell
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Create a `.env.local` file in the project root with the Supabase project URL and public anon/publishable key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-or-publishable-key
```

Restart the development server after changing environment variables. Never put a Supabase service-role or secret key in a `NEXT_PUBLIC_` variable.

## Supabase setup

In the Supabase Dashboard, open **SQL Editor** and run these files in filename order:

1. [`supabase/migrations/20261012000000_stock_receipts.sql`](./supabase/migrations/20261012000000_stock_receipts.sql)
2. [`supabase/migrations/20261012010000_challenge_support.sql`](./supabase/migrations/20261012010000_challenge_support.sql)
3. [`supabase/migrations/20261012020000_business_auth.sql`](./supabase/migrations/20261012020000_business_auth.sql)
4. [`supabase/migrations/20261012030000_public_product_finder.sql`](./supabase/migrations/20261012030000_public_product_finder.sql)
5. [`supabase/migrations/20261012040000_product_photos.sql`](./supabase/migrations/20261012040000_product_photos.sql)
6. [`supabase/migrations/20261012050000_rent_reminders.sql`](./supabase/migrations/20261012050000_rent_reminders.sql)

The migrations assume the existing `products` table has UUID `id`, `name`, `qty`, `cost_price`, and `sell_price` columns; `sales` has `id`, `product_id`, `qty`, `total`, and `created_at`; and `invoices` has `id`, `invoice_no`, `customer_name`, `total`, `status`, and `created_at`.

The authentication migration adds email/password sign-up and sign-in, creates one business space per user, and applies row-level security to business records. Existing records are **not automatically assigned** to a new user; unassigned legacy rows remain inaccessible until an administrator securely assigns them. IT provider listings remain publicly readable, but business requests and financial/stock records require authentication.

The product finder migration adds a separate, public customer directory at `/discover`; it is not part of the small-business dashboard. Businesses set their public store name and area in Inventory, then choose which products to share. Public search shows only opted-in products with stock and never returns exact stock quantities. Sales and stock receipts update those same inventory records; customer listings refresh every 30 seconds. Customers browse without signing in, while business management remains behind sign-in.

Business owners can upload optional product photos (JPG, PNG, or WebP, up to 5 MB) to Supabase Storage. Public customer listings show that photo when available and use an original RandWise vector illustration as a fallback. Photos are only served for products explicitly shared in the public directory. The business dashboard includes a seven-day sales-versus-expenses chart and comparison based on recorded entries. It is an operational snapshot, not accounting advice or an audited report.

### Judge demo setup

1. Apply all six migrations to the Supabase project used by the deployment.
2. In **Authentication → URL Configuration**, set the deployed app URL and add it to the allowed redirect URLs. For a frictionless judging demo, disable email confirmation only if appropriate for your Supabase project; otherwise confirm the account from the signup email.
3. Deploy the app (for example, by importing the repository into Vercel) and configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` as deployment environment variables. Redeploy after setting them. Never use a service-role key in the browser.
4. Open the public URL in a private/incognito window, create a dedicated judge account and business, then add sample products, receive a supplier invoice, record a sale, and create an invoice. Use fictional data only.
5. Confirm signing out blocks the app and signing back in restores the same data. To validate tenant isolation before sharing, create a second account and confirm it cannot see or change the first account's records.

The app repository does not contain deployment credentials and does not create or publish a public URL. A judge-access URL and credentials are ready only after the Supabase project is configured and the app is deployed. Share demo credentials through the submission channel, not source code or this repository.

## Challenge-related features

- **Bookkeeping and cash flow:** Dashboard totals and pages for sales, expenses, budgets, and customer invoices.
- **Rent reminders:** Business owners can record premises rent due dates and amounts, see upcoming or overdue reminders on the dashboard, and mark payments as paid. These are in-app reminders, not automatic email, SMS, or push notifications; they do not automatically create expense records.
- **Procurement and stock control:** Record supplier invoices and item lines; received quantities are added to stock. A sale and its stock deduction are recorded in one database transaction.
- **Customer product discovery:** Customers can search public, in-stock products by name and area on `/discover`, a separate customer-facing directory. Business owners only see controls in Inventory to manage which items are shared; private bookkeeping and inventory management remain the core signed-in experience.
- **Digital-payment readiness:** Record invoice payment status and method (cash, EFT, mobile money, or other). RandWise does not connect to a payment gateway or verify that funds arrived.
- **Funding readiness:** Review an informational record-keeping checklist and export a summary of RandWise data. The summary is not a credit score, audited accounts, eligibility decision, or funding approval.
- **Starting/formalising a business:** Follow a browser-saved checklist linking to official resources. Always verify current requirements, fees, and eligibility with the relevant authority.
- **Market links:** RandWise Connect lists local IT support providers; this is a service directory, not a buyer or procurement marketplace.
- **Activity oversight:** Review recent sales and stock invoices. This activity view supports visibility but is not a tamper-proof audit log or a guarantee against fraud.

Payments are payment-status records, not payment processing or verification. Funding exports summarize user-entered records; they are not audited financial statements or funding decisions. The activity screen is not tamper-proof. Authenticated sign-up and per-business RLS are implemented in the app and migration, but production use still requires applying the migration and verifying it against the actual Supabase schema and a second account.
