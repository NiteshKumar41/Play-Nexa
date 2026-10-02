# Backend Integration Audit

Audit of the current React app before establishing the shared HTTP client.
The project uses JavaScript and Vite; no TypeScript types are present.

| File or area | Current dependency | What it is used for | Replacement / target API | Action |
| --- | --- | --- | --- | --- |
| `src/services/authService.js` | Backend auth endpoints via shared `apiClient` | Signup, login, current-user lookup, local logout | `/api/v1/auth/signup`, `/api/v1/auth/login`, `/api/v1/auth/me` | Integrated in Checkpoint 2 using the inspected backend payloads. |
| `src/services/gameService.js` | Shared `apiClient` → `/api/v1/games/*` | Player catalog/detail lookup and admin catalog CRUD/status | Public list by numeric gameCode; admin list/create/update/status routes by Mongo ID | Checkpoint 4 uses actual backend field names, resolves player route game codes from the public list, and wires admin game operations. Backend image upload/category/entry-price fields are unavailable. |
| `src/services/matchService.js` | Shared `apiClient` for match HTTP; `socketService` for lobby/detail subscriptions | Player match pages, including room-code, result, and settlement updates | `/api/v1/matches/*` plus backend Socket.IO match events | Checkpoints 6–8 use backend state and remove mock settlement actions from this service. |
| `src/services/adminSettlementService.js` | Shared `apiClient` plus authenticated evidence requests | Admin settlement queue, detail, screenshots, and finalization actions | `/api/v1/admin/matches/pending-settlement`, `/api/v1/admin/matches/:id/settlement`, `/api/v1/admin/matches/:id/settle` | Checkpoint 8 sends only the selected action, winner, or reason; the backend owns authorization and wallet changes. |
| `src/services/resultService.js` | Shared `apiClient` for multipart result/dispute submissions, protected evidence, and admin result reads | Player result claims, screenshots, disputes, and result review | `/api/v1/matches/:matchId/result`, `/dispute`, and `/result/evidence/:fileName` | Checkpoint 7 submits backend-compatible multipart forms and loads private evidence with JWT. Result writes and screenshot ownership are validated by the backend. |
| `src/services/socketService.js` | Authenticated singleton `socket.io-client` connection | Game lobby and private match rooms; live room-code/match updates | Backend Socket.IO on HTTP server | AuthContext connects for the signed-in token, rejoins tracked rooms after reconnection, and disconnects on logout/session expiry. |
| `src/services/walletService.js` | Shared `apiClient` for wallet reads; `mockStore` for mutations | Authenticated wallet balance and paginated history; mock withdrawal/refund/match wallet operations | `GET /api/v1/wallet`, `GET /api/v1/wallet/transactions?page=&limit=` | Balance and transaction reads integrated in Checkpoint 3. Mutations remain mock-only for their later checkpoints. |
| `src/services/paymentService.js` | `mockStore`, local checkout simulation, object URLs | Deposits and development payment simulation | Future deposit/payment endpoints under `/api/v1` | Keep mocked; no payment integration is part of this checkpoint. |
| `src/services/adminService.js` | `mockStore` plus live pending-dispute count | Admin summary, deposits, payouts, games, payment methods, users | `/api/v1/admin/matches/disputed` for the pending-dispute KPI; remaining admin services are mocked | Checkpoint 8 removes the mock dispute count; other admin workflows remain for later checkpoints. |
| `src/services/supportService.js` | `mockStore` in-memory data | Player and admin support tickets | Future support endpoints under `/api/v1/support` | Keep mocked until support integration. |
| `src/services/mockStore.js` | Domain fixtures and in-memory mutations | Shared mock operations used by wallet, payment, support, and unfinished admin services | Endpoint-specific services | Settlement rows/actions were removed; unrelated unfinished feature fixtures remain. |
| `src/data/*.js`, `src/data/mockData.js` | Static mock users, games, matches, transactions, tickets, and admin data | UI initial state for features not yet integrated | Live feature endpoints | Player dashboard/game catalog no longer use mock game records; shared game fixtures remain in the mock store for the remaining mock workflows. |
| `src/services/userService.js` | In-memory profile map plus `localStorage` key `playnexa.mock-profiles` | Legacy profile lookup and local profile edits for mock features | `GET /api/v1/auth/me` supplies current auth identity; no self-service update endpoint exists | AuthContext uses the real `/auth/me` response. Legacy mock helpers remain for unrelated mock features; profile editing is `PROFILE_UPDATE_PENDING`. |
| `src/services/tokenStorage.js` | `localStorage` token key `playnexa.auth-token` | JWT persistence | Same single token key | Shared by auth and REST client. No user profile, passcode, or wallet balance is stored here. |
| `src/services/userService.js` | Legacy `playnexa.mock-session` read | `getCurrentUserId()` for mock operations | Authenticated user context | No current writer was found; remove when mock services are retired. |
| `src/pages/player/Dashboard.jsx`, `GamesPage.jsx`, `src/components/games/GameCard.jsx` | API game catalog and mock match fixtures | Dashboard popular games, catalog filters/cards, and game-code navigation | `gameService.getGames()` / `getGameByCode()` | Player game grid reads backend data; closed matchmaking is shown as closed. Match data/workflows remain separate. |
| `src/pages/admin/AdminPages.jsx` settlement section | Authenticated settlement service and protected screenshot reads | Review pending claims, inspect match details/evidence, and finalize | `adminSettlementService` | Checkpoint 8 uses backend-filtered queue data, confirmation actions, rejection reason, and fresh list state. |
| `src/pages/admin/AdminPages.jsx` game section | API game catalog; other admin sections remain mocked | Create/edit game and set active/open states | `gameService` admin endpoints | Admin game CRUD and toggles now persist through the backend. Image upload is unavailable in backend routes; form uses supported image URL field. |
| `src/pages/player/WalletPage.jsx`, `Dashboard.jsx` wallet sections | Wallet services and retained domain fixtures | Show current wallet balance and recent/paged transaction rows | `walletService.getWallet()` and `walletService.getTransactions()` | Dashboard and wallet reads integrated; deposit/withdrawal actions remain excluded and mock-backed. |

## Architecture Notes

- Vite + React 19 + React Router 7; JavaScript/JSX.
- `src/App.jsx` declares public auth routes, player routes, admin routes, and protected route nesting. `src/routes/ProtectedRoutes.jsx` owns authentication and admin checks.
- Auth UI is in `src/pages/auth/AuthPage.jsx`; player pages are split under `src/pages/player/`; admin pages remain in `src/pages/admin/AdminPages.jsx`.
- Shared presentation components are in `src/components/common/`; player and admin shells are in `src/components/layout/`.
- `src/hooks/useAuth.js` reads the React Context exposed by `src/contexts/AuthContext.jsx`.
- The app uses React Context for authenticated user, token, profile view, and loading/error state; page state remains local.
- Forms use native form events and `FormData`; feature pages keep loading/error state locally and render shared `DataState` components.
- `fetch` is used; Axios is not installed.
- `socket.io-client` helpers are present but are not connected by AuthProvider in this checkpoint.
- No Supabase or Firebase imports were found.
- The JWT token key is centralized in `src/services/tokenStorage.js` and used by auth and API requests.
- Mock data remains split by domain under `src/data/`, with `mockStore.js` providing mutable local data.
- The environment example is now the API origin (`http://localhost:5000`); `api.js` adds `/api/v1` for REST calls.
- This project is JavaScript, so no TypeScript types folder or `ApiResponse<T>` is applicable. The JS client returns a normalized `{ success, message, data }` envelope and throws `ApiError` for HTTP failures.
- No Supabase or Firebase dependencies, clients, or calls were found. Existing active backend calls are listed in the table above; remaining feature data is explicitly local mock data.
