# Play Nexa

Play Nexa is a React and Vite frontend for a skill gaming and matchmaking product. It currently runs with local mock data and browser-only demo authentication. It does not connect to a backend or database.

The demo login accepts any email and six-digit passcode. Use `admin@playnexa.local` to preview the admin area. Demo passcodes are not checked or saved.

## Run locally

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

## Project structure

- `src/pages/` contains the player and admin screens.
- `src/components/common/` contains shared UI components.
- `src/services/` contains frontend-only mock services. They are the intended boundary for a future API client.
- `src/data/` contains mock users, games, matches, transactions, and support tickets.
- `src/constants/` contains shared business status and role values.
- `src/utils/` contains currency formatting and match calculations.
- `src/contexts/` contains the temporary browser-only authentication state.

All wallet, payment, matchmaking, settlement, support, and admin records are demonstration data. No real payments or account changes are performed.
