# Frontend / Backend Integration

## API URL

Set `VITE_API_BASE_URL` to the backend origin, without `/api/v1`:

```env
VITE_API_BASE_URL=http://localhost:5000
```

`src/config/api.js` adds the `/api/v1` prefix for REST endpoints. The health check is the root `GET /health` endpoint.

## Authentication API (verified from the backend)

| Method and path | Purpose | Backend behavior |
| --- | --- | --- |
| `POST /api/v1/auth/signup` | Create a player account | Accepts `fullName`, `phone`, `password`; optional `email`, `dob` (`YYYY-MM-DD`), `gender`, and `upiId`. Responds 201 with `{ success, message, data: { user, token } }`. |
| `POST /api/v1/auth/login` | Sign in | Accepts `{ phone, password }`. Responds with `{ success, message, data: { user, token } }`. |
| `GET /api/v1/auth/me` | Restore/verify current user | Requires a bearer token. Responds with `{ success, data: { user } }`. |

The auth router has no logout or password/passcode reset endpoint. Logout therefore clears the browser token locally. The existing forgot-passcode screen continues to explain that recovery is unavailable and does not pretend to send a reset request.

The backend permits `localhost:5173` and `localhost:3000` during development. Set backend `CLIENT_URL` (or `FRONTEND_URL`) to the actual frontend origin when using another host or port. Production must use the deployed frontend origin.

Backend signup requires a valid Indian mobile number beginning with 6–9 and a six-digit `password`. The phone number is unique. Email is optional and validated for format, but the current schema does not make email unique.

The existing UI calls the passcode field `passcode`; `authService` sends it as the backend-required `password` field. It does not send unsupported fields. Signup only creates a session when a token is returned; the inspected backend returns both a user and token, so the current flow signs the player in after signup.

## HTTP client

Use `apiClient` from `src/services/apiClient.js` inside feature services. It supports GET, POST, PUT, PATCH, DELETE, JSON request bodies, and `FormData`. A successful response is normalized to `{ success, message, data }`. HTTP failures throw `ApiError` with `message`, `status`, and `data`.

The client adds `Authorization: Bearer <token>` when `playnexa.auth-token` exists. The token key is defined once in `src/services/tokenStorage.js`. Passwords and passcodes are not written to storage. Authenticated user details live in React AuthContext state, not localStorage.

HTTP status errors use the backend message when provided, otherwise a safe status-specific message is used. A 401 from an authenticated request clears the token and emits an auth-expired event. `AuthProvider` clears its current session/profile; protected routes then redirect to login. A login 401 is kept on the login form and does not clear an unrelated saved session.

## Services and current integration state

Feature service files own API requests. Auth, games, matches, match results, wallet reads, and wallet transaction history use the shared HTTP transport. Wallet mutations (deposits, withdrawals, match activity), other admin operations, and support still use mock data and remain for later feature checkpoints. See [BACKEND_INTEGRATION_AUDIT.md](./BACKEND_INTEGRATION_AUDIT.md) for the file-by-file inventory.

## Match lobby and workflow API (verified from the Node.js backend)

All match routes are mounted at `/api/v1/matches` and protected by the backend auth middleware. The frontend's game route uses the numeric `gameCode`, resolves it through the public games catalog, then queries matches with that game's MongoDB `id` because the match-list endpoint accepts `gameId`, not `gameCode`.

| Method and path | Purpose | Request and response |
| --- | --- | --- |
| `GET /api/v1/matches?gameId=<Game._id>&page=1&limit=10` | Load the open lobby | Requires JWT. `gameId` is the MongoDB Game ID; page defaults to 1 and limit to 10 (maximum 100). Returns `{ matches, pagination }`. Only `ACTIVE` matches with no Player 2 are listed. Each item contains `id`, `gameId`, `gameCode`, `player1`, `player1Name`, `player1Amount`, `status`, `prizePool`, and `createdAt`. |
| `GET /api/v1/matches/:matchId` | Load match details | Requires JWT. Returns `{ match }` with backend fields such as `gameId`, `gameCode`, `player1`, `player1Amount`, `player2`, `player2Amount`, `status`, `roomCode`, `prizePool`, `platformFee`, `winnerAmount`, `createdAt`, and `joinedAt`. Room code and evidence details are included only for a participant or admin. |
| `POST /api/v1/matches` | Create a match | Requires JWT. Body is `{ gameId, entryFee }`; returns `201 { match }`. The backend validates the active/open game, debits the creator's wallet, and creates an `ACTIVE` match. |
| `POST /api/v1/matches/:matchId/join` | Join a match | Requires JWT; no request body. The backend validates availability and debits the joining player's wallet. |
| `POST /api/v1/matches/:matchId/leave` | Leave a joined match | Requires JWT; no request body. Only Player 2 can leave, and only before a room code is assigned; the backend refunds their entry and reopens the match. |
| `POST /api/v1/matches/:matchId/cancel` | Cancel a waiting match | Requires JWT; no request body. Only the creator can cancel before another player joins; the backend refunds the creator's entry. |
| `PATCH /api/v1/matches/:matchId/room-code` | Set the room code | Requires JWT. Body is `{ roomCode }`. Only the creator can set a non-empty code after Player 2 joins. |

The Mongo `GameMatch` model stores `gameId`, `gameCode`, `roomCode`, `player1`, `player1Amount`, `player2`, `player2Amount`, `status`, financial fields, `createdBy`, `createdName`, `createdAt`, `joinedAt`, and lifecycle/result fields. The HTTP serializer returns participant IDs and names but does not expose `createdBy` or `createdName`; the frontend identifies the creator with serialized `player1`. The list response is intentionally a smaller subset of the detail model.

`src/services/matchService.js` uses these routes and maps the backend's camelCase response into the unchanged player-page view model. `src/types/match.types.js` documents the actual list/detail payloads and this UI projection with JSDoc because this Vite frontend is JavaScript (it has no TypeScript compiler). Match creation, joining, leaving, cancellation, and room-code validation/refunds remain backend responsibilities; lobby cards use live API data, not mock match fixtures.

## Result claims, screenshots, and disputes (Checkpoint 7)

These endpoints are mounted under `/api/v1/matches` and require a bearer JWT. The frontend uses the authenticated user's existing token through `apiClient`; multipart bodies are sent as `FormData` without setting `Content-Type` so the browser supplies its boundary.

| Method and path | Request | Result |
| --- | --- | --- |
| `POST /api/v1/matches/:matchId/result` | `multipart/form-data`: required `winnerClaim=true`, `screenshot`; optional `remarks` (up to 1,000 characters) | Submits a winner claim. Returns a small match result with status and pending claim state. |
| `POST /api/v1/matches/:matchId/dispute` | `multipart/form-data`: required `reason` (1–2,000 characters), `screenshot` | Submits a dispute against another participant's pending claim. Returns the updated match status and dispute claimant. |
| `GET /api/v1/matches/:matchId/result` | No body | Returns the participant-authorized result, both screenshot references, claim/dispute fields, and current status. |
| `GET /api/v1/matches/:matchId/result/evidence/:fileName` | No body | Streams an evidence image only to an authenticated participant or admin. The frontend requests it with the bearer token and displays a temporary object URL. |

The server accepts one JPG/JPEG, PNG, or WEBP image up to 5 MB. Multer validates type/extension and size; storage checks the image signature too. Files are saved outside MongoDB under the backend's local `uploads/game-results` directory with a generated UUID filename. MongoDB stores only the protected evidence URL in `p1Screenshot` or `p2Screenshot`. The backend chooses that field from the JWT user ID after verifying match participation; the browser sends no player number or user ID. Evidence URLs are not public or storage credentials.

The backend permits a claim only on a `JOINED` match with two players and no prior claim. It stores the claimant as `winnerPlayer` and `winnerClaimedBy`, sets `winnerClaimStatus=PENDING`, and changes match status to `COMPLETED`. The claim records evidence only; this frontend makes no wallet request and performs no payout or fee calculation. A dispute requires a different participant, a `COMPLETED` match, and a pending claim; it stores the authenticated disputer and trimmed reason and changes status to `DISPUTED`. These eligibility rules are enforced by the backend.

The actual backend match statuses are `ACTIVE`, `JOINED`, `COMPLETED`, `DISPUTED`, `SETTLED`, `CANCELLED`, and `REJECTED`; winner-claim statuses are `PENDING`, `APPROVED`, and `REJECTED`. Match detail is still initially loaded from `GET /matches/:matchId`. After a result socket event, the page reloads match/result data over HTTP, including protected screenshots, so refreshes remain backed by MongoDB state.

After the database update, the backend emits `result_submitted` for claims or `dispute_submitted` for disputes to the private `match:<Match._id>` room. It also emits `match_result_updated` with the same status summary. That room only accepts verified participants (or other explicitly authorized backend roles); payloads contain match/status/claim identifiers and no wallet data or evidence URLs. The frontend listens to the specific submission events to avoid duplicate fetches from the paired generic event. The backend emits only after its match update succeeds.

If the database update fails after a file is saved, both claim and dispute services attempt to delete the new file. A filesystem deletion failure could still leave an orphan file; there is no background orphan cleanup. Evidence display and writes are restricted server-side, so a nonparticipant's direct API attempts receive 403 even if frontend route checks are bypassed.

The two-account live flow and nonparticipant security probes were not run as part of this source integration. The backend integration suite requires a separately configured test MongoDB database (`MONGODB_URI_TEST`); without it, automated endpoint tests are skipped. No wallet credit, refund, admin settlement, or payment operation is part of this checkpoint.

## Admin match settlement (Checkpoint 8)

All settlement routes are mounted under `/api/v1/admin` and use `authMiddleware` followed by `adminMiddleware`. The role is reloaded from the authenticated user record; the frontend sends no role or admin ID. Requests use the shared `apiClient` bearer token.

| Method and path | Purpose | Request and response |
| --- | --- | --- |
| `GET /api/v1/admin/matches/pending-settlement?page=1&limit=100` | Load backend-filtered `COMPLETED` or `DISPUTED` matches with pending winner claims | Returns `{ matches, pagination }`. The service requests pages from this filtered endpoint rather than loading all matches and filtering in React. |
| `GET /api/v1/admin/matches/:matchId/settlement` | Load settlement details, evidence references, audit information, and wallet transactions | Returns `{ match, walletTransactions }`. The existing match detail endpoint is also read to obtain `roomCode` and `joinedAt`, which the settlement detail serializer omits. |
| `POST /api/v1/admin/matches/:matchId/settle` | Finalize an eligible match | Body is `{ action: 'DECLARE_WINNER', winnerUserId }`, `{ action: 'REFUND_BOTH' }`, or `{ action: 'REJECT_CLAIM', reason }`. The normalized response message/data are displayed by the existing admin UI. |
| `GET /api/v1/admin/matches/disputed?page=1&limit=1` | Read the real pending-dispute count used by the admin summary KPI | Returns paginated filtered matches; the UI uses the backend `pagination.total`. Other summary KPIs remain mock data. |

`DECLARE_WINNER` credits the selected participant using `GAME_WIN` with `SUCCESS`, match reference, wallet ID, user ID, before/after balances, and remarks. The backend validates that the winner is a participant. For a `COMPLETED` match, the winner must be the submitted claimant; for a `DISPUTED` match, the admin may choose either participant. The selected ID comes from the returned player records, while the backend remains authoritative.

`REFUND_BOTH` credits each player's original stored entry amount with a `GAME_REFUND` transaction and marks the match `CANCELLED`. `REJECT_CLAIM` requires a 5–500 character reason and has the backend-defined meaning of rejecting the claim, refunding both players, and cancelling the match. The UI states this effect before confirmation. Neither action calculates or changes balances in React.

The backend performs each wallet update, transaction insert, and match update inside one MongoDB session transaction. It validates only `COMPLETED`/`DISPUTED` matches with a pending claim, checks prior payout/refund transactions, conditionally updates the match, and has unique transaction indexes to prevent repeat credits. It records `settledBy`, `settledAt`, `settlementAction`, reason fields, and `settlementWalletTransactionIds`. The authenticated admin ID comes from `request.user.id`; it is never accepted from the browser. The settlement list is reloaded after a successful action. There is no admin settlement socket room; the backend emits private match events instead.

The backend calculates `totalPool`, platform fee, and winner amount with its shared `calculateMatchFinancials`/`roundMoney` logic. At ₹50 entry per player, the backend rule yields a ₹100 pool, ₹20 fee, and ₹80 payout; at ₹100 entry per player, it yields a ₹200 pool, ₹6 fee, and ₹194 payout. The frontend only renders values returned by the backend. `match.platformFee` records the platform fee; there is no platform wallet/ledger transaction.

After the transaction commits, Socket.IO emits `match_settled` with match ID, `SETTLED`, winner ID, and winner amount; `match_refunded` with match ID and `CANCELLED`; or `match_claim_rejected` with match ID and `CANCELLED`. These events go only to `match:<Match._id>`. The player match page listens and reloads match/result data from HTTP, then displays the settled winner and status or cancellation status. Admins see the refreshed queue without reloading the browser.

Wallet and match monetary schema fields are Mongoose `Number`, not Decimal128. The backend helper rounds through integer cents for calculations, but persisted values are still floating point. Migrate money fields to integer paise or Decimal128 before production. MongoDB transactions also require a replica set or sharded deployment; a standalone server cannot provide this atomic settlement guarantee.

The backend integration tests include claim/dispute, nonparticipant, settlement, refund, and concurrency scenarios. They require `MONGODB_URI_TEST` pointing to a database whose name includes `test`; without that isolated test database the suite skips. No live account-to-account financial scenario was run in this checkpoint.

## Current user and wallet APIs (verified from the backend)

| Method and path | Purpose | Request and response |
| --- | --- | --- |
| `GET /api/v1/auth/me` | Load the authenticated profile | Requires bearer JWT. Returns `{ success, data: { user: { id, fullName, phone, role } } }`. This is handled during AuthContext startup and its user data drives the existing profile display. |
| `GET /api/v1/wallet` | Load the authenticated user's wallet | Requires bearer JWT; user identity comes from the token. Returns `{ success, data: { id, userId, balance, createdAt, updatedAt } }`. |
| `GET /api/v1/wallet/transactions?page=1&limit=10` | Load wallet history | Requires bearer JWT. `page` defaults to 1; `limit` defaults to 10 and must be between 1 and 100. Returns `{ success, data: { transactions: [...], pagination: { page, limit, total, totalPages } } }`. Each serialized transaction includes `id`, `walletId`, `userId`, `phone`, `transactionType`, `amount`, `balanceBefore`, `balanceAfter`, `status`, `remarks`, `referenceId`, `referenceType`, `createdAt`, and `updatedAt`. The serializer does not return UPI identifiers even though the database model has those fields. |

The wallet page requests page 1 with a maximum page size of 100; the dashboard requests its three most recent rows. The backend currently supports no transaction type, status, or date filters, so the existing Credits/Debits tabs filter only the fetched page. It has no self-service profile update endpoint; profile edits remain `PROFILE_UPDATE_PENDING`. `/auth/me` does not currently return email, date of birth, gender, or UPI ID. Those fields are left empty when unavailable rather than filled from mock fixtures. No user ID is sent for wallet reads, and balances are rendered from the wallet response, never calculated from transactions.

Transaction timestamps are displayed in `Asia/Kolkata` using `src/utils/formatDate.js`. `src/services/walletService.js` owns the authenticated wallet and transaction GET requests. Deposit and withdrawal actions remain outside this checkpoint; their existing mock service paths are retained and are not wallet API writes.

## Games API (verified from the backend)

| Method and path | Purpose | Request and response |
| --- | --- | --- |
| `GET /api/v1/games` | Public player catalog | No JWT required. Returns `{ success, data: { games } }`, where each game has `id` (Mongo ID), numeric `gameCode`, `name`, `imageUrl`, `isActive`, and `isOpen`. This endpoint returns active games only. |
| `GET /api/v1/games/:id` | Read one game by Mongo ID | JWT is optional; non-admin callers only receive active games. There is no lookup-by-gameCode route. The existing `/games/:gameCode` UI route resolves its code against the public catalog. |
| `GET /api/v1/games/image/:fileName` | Read a game image | JWT optional for active games; an admin JWT is required by backend logic to read inactive-game images. |
| `GET /api/v1/games/admin?page=1&limit=20` | Admin catalog, including inactive games | Requires JWT and admin role. Pagination defaults to page 1, limit 20; max limit 100. Returns `{ games, pagination }`. Admin game fields additionally include `createdBy`, `updatedBy`, `createdAt`, and `updatedAt`. |
| `POST /api/v1/games` | Create a game | Requires admin JWT. JSON fields: numeric positive `gameCode`, `name`, optional `imageUrl`, optional booleans `isActive` and `isOpen`. Returns `{ game }`. |
| `PUT /api/v1/games/:id` | Update a game | Requires admin JWT. Accepts only the same editable game fields and returns `{ game }`. |
| `PATCH /api/v1/games/:id/status` | Set active status | Requires admin JWT and `{ isActive: boolean }`; returns `{ game }`. |
| `PATCH /api/v1/games/:id/open-status` | Set matchmaking status | Requires admin JWT and `{ isOpen: boolean }`; returns `{ game }`. |
| `DELETE /api/v1/games/:id` | Deactivate a game | Requires admin JWT. Soft deactivates it (`isActive=false`, `isOpen=false`); it is not a hard delete. |

`isActive` controls whether the public catalog and player detail lookup expose a game. `isOpen` separately controls matchmaking availability. A closed game remains visible in the active catalog; the existing lobby view hides matchmaking rows and its create action while closed. Game codes are numeric and distinct from Mongo IDs. The player listing and lobby display `gameCode`; match API calls continue to use the Mongo ID.

The game model has no category or entry-price fields. Player cards therefore use the backend open/closed state and omit mock category and entry-price values. The admin form submits only fields supported by the backend. It accepts an image URL, but there is no game image upload route or multipart handler; the backend only serves already stored images through `/games/image/:fileName` and accepts an `imageUrl` string on create/update. Backend-hosted images are loaded through the shared API client so admin bearer authentication is attached (needed to display inactive-game images); external HTTP(S) image URLs load directly. Image paths are resolved against `VITE_API_BASE_URL`.

## Socket.IO and room-code realtime (verified from the backend)

The backend already starts Socket.IO on the same HTTP server as Express (`http.createServer(app)`) and configures socket CORS from `CLIENT_URL`/`FRONTEND_URL` plus its development origins. It does not use wildcard origins. No backend socket setup was needed for this checkpoint.

The frontend connects one `socket.io-client` instance per authenticated token. `AuthContext` passes the JWT as `auth.token`; backend `socketAuth` verifies it with the same JWT verifier as HTTP auth and checks that the database user is active and not blocked. Server identity comes from the verified token, not a client-supplied user ID. Login/token replacement reconnects with the new token; logout, expired session, and provider unmount disconnect. Socket.IO's built-in reconnection is used, and the service rejoins tracked rooms on each `connect`. Temporary `connect_error` events do not create repeated user-facing toasts.

`VITE_SOCKET_URL` may point to a separate Socket.IO origin. It defaults to `VITE_API_BASE_URL`; both values are backend origins without `/api/v1`. The sample `.env.example` uses the local backend origin for both.

| Backend room/event | Purpose and payload |
| --- | --- |
| `game:lobby:<Game._id>` | Authenticated lobby room. Client emits `join_game_lobby` / `leave_game_lobby` with `{ gameId }`. Backend verifies that game exists and is active. The existing `/games/:gameCode` route resolves to a Mongo game ID before joining. |
| `match:<Match._id>` | Private match room. Client emits `join_match_room` / `leave_match_room` with `{ matchId }`. Backend only joins Player 1 or Player 2. |
| `match_created` | Emitted to the game lobby after MongoDB match creation; includes minimal lobby fields (`matchId` and a match object with game, creator, entry, state, and creation time). The client adds it by ID and deduplicates. |
| `match_joined` | Emitted to game lobby; includes match ID, Player 2 name, status, and prize pool. The client removes that match from joinable lobby rows. `match_updated` is also emitted to its private match room. |
| `match_cancelled` | Emitted to game lobby and match room with match ID and status; the client removes it from joinable lobby rows. |
| `match_player_left` | Emitted to lobby and match room with match ID and status; the lobby reloads the HTTP snapshot so the reopened match can appear. |
| `room_code_updated` | Emitted only to `match:<Match._id>` with `{ matchId, roomCode }`; it never goes to the game lobby. The client verifies the match ID and updates the current room code without a page reload. |

The creator submits a room code through `PATCH /api/v1/matches/:matchId/room-code`. The backend requires JWT, creator ownership, a non-empty code, and a joined match; it saves first, then emits the private event. The detail screen still loads its initial match over HTTP. It joins the private socket room and refreshes match data over HTTP for other match updates; missed socket events therefore do not replace the HTTP source of truth. Room code is only returned by the HTTP detail serializer to a participant or admin.

The socket service tracks subscriptions, removes listeners and leaves rooms on page cleanup, preserves current subscriptions during token replacement, and rejoins them after reconnection. Lobby create/join/cancel events are keyed by match ID so duplicate events do not create duplicate cards. No socket polling or custom reconnect timers are used.

## Health check

`apiClient.checkHealth()` makes a browser-side request to `GET ${VITE_API_BASE_URL}/health`. CORS must be configured by the backend; the frontend does not use `no-cors` or a proxy to bypass it.

## Local environment files

Copy `.env.example` to `.env.local` for local overrides. `.env*` is ignored by Git except `.env.example`, so local environment values are not committed.
