# Shreenathji Traders Management

Offline-first ledger for **Shreenathji Traders**, an agricultural commission agent (આડતિયા) in Tarapur.

The app replaces the paper કેશ મેમો, વેપારી દાખલા, રોજમેળ, and જણસે સિલક with one Progressive Web App for the broker’s team. Farmers and buyers appear on records; they do not log in.

**Production:** [https://shreenath-traders.web.app](https://shreenath-traders.web.app)

---

## Product

Two surfaces share the same codebase:

| Surface | Who | Purpose |
|---------|-----|---------|
| **Company books** | Company Admin, Staff, CA | Day-to-day ledgers for one company |
| **Platform** | Master Admin | Add, pause, and open isolated companies |

Each company is isolated. Ledgers never cross tenants.

### Company modules

| Module | Description |
|--------|-------------|
| **Dashboard** | Today’s figures, income and P&L charts, vepari ranking |
| **Bills (કેશ મેમો)** | Create, edit, void, print, and export cash memos |
| **Vepari dakhla** | Auto ledger from bills (weight, rate, tolai, shes, commission) |
| **Rojmer** | Farmer payment settlement against bills |
| **Vepari pay** | Buyer payment settlement against dakhla |
| **Jansa silak** | Daily જમા / ઉધાર position, auto and manual lines |
| **Reports** | Read-only financial-year and date-range totals for the CA |
| **Settings** | Veparis, default rates, business profile, users, year-end backup |

### Platform modules

Overview (statistics and charts), calendar, task inbox, company directory, and Master Admin profile.

---

## Roles

| Role | Access |
|------|--------|
| **Master Admin** | Platform operator. Creates companies, assigns Company Admins, can open any company’s books. |
| **Company Admin** | Full access to one company: ledgers, rates, staff, void. Cannot see other companies. |
| **Staff** | Create and edit ledgers for their company. |
| **CA** | Read-only reports and ledgers for their company. |

Company Admins and staff join by invite. They create their own email and password. Public signup cannot create a company.

---

## Stack

| Layer | Technology |
|-------|------------|
| App | React 19, Vite 8, Tailwind CSS 4, React Router 7 |
| Auth / data | Firebase Authentication (email + password), Cloud Firestore |
| Offline | Dexie (IndexedDB), background sync to Firestore |
| Forms | React Hook Form, Zod |
| Export | ExcelJS, jsPDF, JSZip (loaded on demand) |
| PWA | vite-plugin-pwa |

Runs on Firebase Spark. There are no Cloud Functions, no Admin SDK, and no Firebase Storage.

---

## Local development

**Requirements:** Node.js 20+, a Firebase project with Email/Password auth and Firestore.

```bash
npm install
cp .env.example .env
npm run dev
```

Vite prints the local URL (typically `http://localhost:5173`).

### Environment

Copy `.env.example` to `.env` and set the Firebase web app values. Do not commit `.env`.

| Variable | Purpose |
|----------|---------|
| `VITE_FIREBASE_*` | Firebase web SDK config from Project settings |
| `VITE_MASTER_ADMIN_EMAIL` | Designated Master Admin login (default `imhelipatel12@gmail.com`) |
| `VITE_BUSINESS_ID` | First company id (default `shreenath-traders`) |

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Development server |
| `npm run build` | Production build and PWA assets |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Lint with oxlint |

---

## Data

- **Companies:** `businesses/{companyId}` (existing collection name so live Shreenathji data stays in place)
- **Users:** `users/{uid}` with `role` and `companyId` (`null` for Master Admin)
- **Ledgers:** nested under each company; every row is also stamped with `companyId`
- **Offline:** Dexie per company and user
- **Totals:** dakhla, rojmer balances, and silak closings are computed on read, not stored
- **Dates:** stored `YYYY-MM-DD` (IST); shown as `DD-MM-YYYY`
- **Financial year:** 1 April – 31 March

Prints stay Gujarati. The on-screen UI toggles Gujarati and English.

See `architecture.md` for the full model and sync rules.

---

## Documentation

| File | Contents |
|------|----------|
| `prd.md` | Product scope |
| `architecture.md` | Data model, offline, sync |
| `rules.md` | Engineering constraints |
| `design.md` | Visual identity |
| `phases.md` | Build phases |
| `memory.md` | Progress log |

---

## License

Private software for Shreenathji Traders. All rights reserved.
