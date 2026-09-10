# Shreenathji Traders Management

Offline-first digital ledger for **Shreenathji Traders** — an agricultural commission agent (આડતીયા) business in Tarapur.

Replaces paper **કેશ મેમો**, **વેપારી દાખલા**, **રોજમેળ**, and **જણસે સિલક** with a single Progressive Web App used by the broker’s team. Farmers and buyers appear as parties on records; they do not log in.

**Live app:** [https://shreenath-traders.web.app](https://shreenath-traders.web.app)

---

## Features

| Module | What it does |
|--------|----------------|
| **Cash memo (બિલ)** | Create, edit, void, and print bills; immutable-by-default note numbers with optional edit; searchable buyer picker |
| **Vepari dakhla** | Auto ledger from bills — weight, rate (ભાવ), tolai / shes / commission / total |
| **Rojmer** | Track farmer payments against bills; pending / cleared views; quick “record payment” entry |
| **Jansa silak** | Daily cash position with auto + manual જમા / ઉધાર entries |
| **Dashboard** | Today’s KPIs, income / P&L charts, ranking |
| **CA reports** | Read-only FY / date-range totals and exports for the accountant |
| **Settings** | Buyers (veparis), business profile, default rates, invites / users, year-end backup |

Also included:

- **Gujarati ↔ English** UI toggle (prints stay Gujarati, matching the paper books)
- **Roles:** Owner (full), Staff (write ledgers), CA (read-only)
- **Offline-first:** Dexie (IndexedDB) + background Firestore sync
- **Export / print:** Excel, CSV, PDF, and paper-style cash memo / dakhla layouts
- **Installable PWA** for phone and desktop

---

## Tech stack

- **UI:** React 19, Vite 8, Tailwind CSS 4, React Router
- **Data:** Firebase Auth, Cloud Firestore, Dexie
- **Forms:** React Hook Form + Zod
- **Exports:** ExcelJS (.xlsx), jsPDF, JSZip
- **PWA:** vite-plugin-pwa

---

## Getting started

### Prerequisites

- Node.js 20+ (recommended)
- A Firebase project with **Authentication (Email/Password)** and **Firestore** enabled
- Firebase CLI (for deploy): `npm i -g firebase-tools`

### Install & run

```bash
npm install
cp .env.example .env   # fill in Firebase web config
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

### Environment

Copy `.env.example` → `.env` and set the Firebase web app values:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_BUSINESS_ID=shreenath-traders
```

Never commit `.env`. `VITE_BUSINESS_ID` defaults to `shreenath-traders` if omitted.

### Firebase setup

1. Create a project in the [Firebase Console](https://console.firebase.google.com) (Spark/free is fine for Auth email + Firestore).
2. Enable **Authentication → Email/Password** and **Firestore**.
3. Register a web app and paste its config into `.env`.
4. Deploy security rules when ready:

```bash
firebase deploy --only firestore:rules
```

The **first account to sign up** becomes the business **owner**. Invite staff and CA users from Settings afterward.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development server |
| `npm run build` | Production build + PWA assets |
| `npm run preview` | Preview the production build |
| `npm run lint` | Lint with oxlint |

### Deploy (hosting)

Only when you intentionally want to publish:

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```

---

## Roles

| Role | Access |
|------|--------|
| **Owner** | Full access — settings, rates, users, void, year-end backup |
| **Staff** | Create / edit ledgers (bills, payments, silak manuals) |
| **CA** | Read-only reports and ledgers |

---

## Architecture (short)

- **Source of truth online:** Firestore under `businesses/{businessId}/…`
- **Source of truth offline:** Dexie tables (`bills`, `payments`, `veparis`, `silakEntries`) with `syncStatus`
- **Derived, not stored:** dakhla lines, rojmer balances, silak day totals — computed on read via `src/utils/calc.js`
- **Dates:** stored as `YYYY-MM-DD` (IST calendar day); UI displays `DD-MM-YYYY`
- **Financial year:** 1 April – 31 March

For the full model and sync rules, see `architecture.md`.

---

## Project docs

| File | Contents |
|------|----------|
| `prd.md` | Product scope and requirements |
| `architecture.md` | Data model, offline, sync |
| `rules.md` | Engineering constraints |
| `design.md` | Visual identity |
| `phases.md` | Build phases and done-when criteria |
| `memory.md` | Decision / progress log |

---

## Repository layout

```
src/
  components/     Shared UI (tables, shell, searchable selects, print/export)
  context/        Auth + locale
  db/             Dexie schema
  features/       Screens by domain (bills, dakhla, rojmer, silak, …)
  firebase/       Auth + Firestore helpers
  hooks/          Data hooks (local-first)
  locales/        gu.json / en.json
  sync/           Sync engine
  utils/          calc, dates, export, vepari helpers
```

---

## License

Private business software for Shreenathji Traders. All rights reserved.
