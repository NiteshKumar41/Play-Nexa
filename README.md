# Play Nexa

Play Nexa is a React application built with Vite.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local` using your Supabase project URL and anon/public key.

Only the Supabase anon/public key belongs in this browser app. Never expose a service-role key in Vite environment variables or client code.

## Supabase database

Apply the SQL files in `supabase/migrations/` in timestamp order using the Supabase SQL Editor. The migrations create the initial tables, row-level security policies, and auth/profile triggers; a new auth user receives a profile and wallet automatically. The profile migration keeps `user_type`, `active`, and `is_blocked` read-only to normal authenticated clients. Wallet balance changes and match creation/joining are performed by atomic PostgreSQL functions; clients have no direct wallet balance or transaction write access.

Timestamps are stored as `timestamptz`. Future business-date calculations should explicitly use the `Asia/Kolkata` time zone.

## Authentication

Enable phone authentication and configure an SMS provider in the Supabase project. Sign-up and login use Supabase Auth's native phone/password flow; the six-digit passcode is sent only to Supabase Auth and is never written to `public.users`. Phone confirmation behavior depends on the Supabase project's Auth settings. Protected app routes require a valid session and an active, unblocked profile; admin routes additionally require `user_type = 'admin'`.

Forgot-passcode recovery remains a demo-only screen and is not connected to Supabase Auth.

## Payment gateway foundation

Wallet top-ups create payment orders through `create-payment-order`. Only a signed server-side webhook processed by `payment-webhook` can credit the wallet; browser checkout status is never trusted. The database function locks the payment order and wallet, validates provider order/payment IDs and amount/currency, and uses the order ID as the unique wallet-transaction idempotency key.

No real payment provider is configured. The mock provider is available only when Edge Function secrets explicitly set `PAYMENT_PROVIDER=mock` and `PAYMENT_ENVIRONMENT=development`. It is a clearly labeled simulation and does not collect real money. Its completion path creates a server-signed mock event and passes it through the same signature-verification and database settlement path as a webhook.

Deploy the Edge Functions in `supabase/functions/` and configure secrets with the Supabase CLI or Dashboard. Required secrets are `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_PROVIDER`, `PAYMENT_ENVIRONMENT`, `PAYMENT_WEBHOOK_SECRET`, and `APP_ORIGIN`. Keep all service-role and payment secrets in Edge Function secrets—never in `VITE_*` variables or React. The webhook function disables JWT verification in `supabase/config.toml` and authenticates provider events by signature; the create-order and mock-checkout functions require a user JWT.

For local development, set `PAYMENT_PROVIDER=mock` and `PAYMENT_ENVIRONMENT=development`, configure a randomly generated `PAYMENT_WEBHOOK_SECRET` in the Edge Function environment, start Supabase and its functions, apply all migrations, then use Wallet → Add money → Continue to checkout. The success/failure buttons are mock-only and call the authenticated `complete-mock-payment` function, which creates and signs a server-side simulated webhook before using the normal payment webhook settlement path. Never enable this mock mode in production.

## Deposits

Wallet → Add money offers the verified gateway flow and a manual UPI flow. The gateway credits the wallet only after trusted server-side verification and creates an `ADD_MONEY` transaction. The development mock remains a simulation and does not collect money.

Manual UPI shows the single active `payment_methods` row with `provider = 'manual_upi'`, then stores the player's screenshot in the private `deposit_proofs` bucket and creates a `PENDING` row in `deposits`. This does not call any wallet-credit function and does not change the wallet balance. Active administrators can review the signed proof and approve/reject the request in Admin → Deposits. Approval locks the wallet, credits it, writes the `ADD_MONEY` transaction, and updates the deposit in one transaction. The database permits at most one active payment method across all providers.

Provision or change payment methods through Admin → Payment methods or a trusted server-side process, never from the player client. Upload an optional UPI QR image to `deposit_proofs` at a path outside any player's `<auth-user-id>/` folder, then associate that object path with the manual UPI method. The app grants authenticated users read access only to the QR attached to the active manual method; proof uploads remain confined to each user's own folder.

## Admin console

Apply `20261002011000_admin_console.sql` after earlier migrations. The summary uses server-side, all-time totals from a database function: successful `ADD_MONEY` and `WITHDRAW` transactions, `COMPLETED` plus `SETTLED` matches, settled-match platform fees, pending deposits/withdrawals, and disputed matches. It intentionally has no date selector. Deposit, withdrawal, game, payment-method, user, settlement, and support data use authenticated Supabase queries protected by RLS. Admin mutations use admin-checking PostgreSQL functions (or existing withdrawal/match/support functions), so hiding admin controls in React is not the security boundary. Administrators can approve/reject manual deposits, mark payouts successful with UTR and transaction ID or reject/refund them, manage game visibility and entry limits, configure payment methods, change player activation/block/role, settle matches, and manage support tickets.

## Withdrawals

Players submit an amount and UPI ID from Wallet → Withdraw. `create_withdrawal()` authenticates the caller, checks the active/unblocked profile, locks the wallet, verifies funds, deducts the amount, and records a `WITHDRAW` transaction with `INITIATED` status. The browser cannot update wallet balances or transaction status directly. Payouts are admin-managed: `approve_withdrawal()` requires the UTR and payout transaction ID and marks the existing withdrawal `SUCCESS`; `reject_withdrawal()` atomically creates a refund transaction and marks the original withdrawal `FAILED`. Both admin operations enforce an active, unblocked admin profile and are idempotent across retries.

## Match results and disputes

After a match is underway, either participant can submit a winner claim with a screenshot or submit a dispute reason and screenshot. Private evidence is stored in the `game_winners` and `game_disputes` Storage buckets. A winner claim marks the match `completed` with claim status `PENDING`; it does not pay the winner. A dispute marks the match `disputed`.

The Admin → Settlements page reads pending match evidence from Supabase. `declare_match_winner()` credits the selected participant's `winner_amount`, records `GAME_WIN`, and marks the match `settled`. `refund_match_players()` locks both wallets in stable user-ID order, returns both entry fees, records `GAME_REFUND` transactions, and marks the match `cancelled`. `reject_match_winner_claim()` rejects a pending claim without transferring funds. These operations require an active, unblocked admin and execute atomically; direct client updates to match or wallet records are not allowed.

## Supabase Storage and support tickets

The `deposit_proofs`, `game_winners`, and `support_images` buckets are private. The UI requests short-lived signed URLs to display user-uploaded evidence; authorization policies limit uploads and reads to the file owner, relevant match participants, or active administrators as appropriate. `app_assets` and `games` are public-read buckets for non-sensitive application/game artwork; only active admins can upload, update, or delete those assets.

Players can create tickets with an optional image, view their own ticket status and any staff resolution, and access their image through a signed URL. Admins can view all tickets, change status among `OPEN`, `IN_PROGRESS`, `RESOLVED`, and `CLOSED`, attach a resolution, and close tickets. Resolving or closing a ticket requires a resolution. Creation and status changes use database functions; authenticated clients cannot directly change ticket ownership, status, or resolution.

## Scripts

- `npm run dev` — start the Vite development server.
- `npm run build` — create the production build.
- `npm run lint` — run ESLint.
- `npm run preview` — preview the production build locally.

Game catalog, match creation/joining, match details, lobby/match Realtime updates, room-code sharing, pre-room-code leave/cancel refunds, winner claims, disputes, admin match settlement, support tickets, and private evidence uploads use Supabase. Payment orders and a development-only mock checkout are wired through Edge Functions; a real payment gateway remains unimplemented.
