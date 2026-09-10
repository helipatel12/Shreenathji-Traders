# Architecture — Shreenath Traders Management

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React + Vite | Fast dev loop, works well as a PWA, huge ecosystem |
| Styling | Tailwind CSS | Fast, consistent, easy for an AI agent to apply predictably |
| Offline storage | IndexedDB via Dexie.js | Structured local database, survives app restarts, works fully offline |
| Backend / DB | Firebase Firestore | Real-time sync, built-in offline persistence, scales to multi-location without custom sync code |
| Auth | Firebase Authentication | Email + password login. Originally phone number + OTP (fits Indian small-business users better than email) — switched after Firebase began requiring the paid Blaze plan for phone/SMS auth in Sept 2024, which conflicts with the free-tier requirement in prd.md §5. See memory.md's decisions log. |
| Hosting | Firebase Hosting | Free tier, HTTPS by default, works with PWA |
| PWA layer | Vite PWA plugin (Workbox) | Installable app, offline shell caching, background sync |
| State management | React Context + hooks (no Redux) | App is not complex enough to need Redux; keep it simple |
| Export | ExcelJS, jsPDF | Client-side Excel (.xlsx) / CSV and PDF generation — no server/paid export service needed |
| Archive | JSZip | Bundles the year-end export set into a single downloadable zip, entirely client-side |

**Explicitly not using**: React Native / Flutter (a PWA covers phone + desktop from one codebase, no app-store approval delay), a custom Node.js backend (Firestore removes the need to write and host sync/API logic ourselves).

## 2. App flow (high level)

```
[Login] → email + password (Firebase Auth)
   ↓
[Dashboard] → today's summary: bills entered, rojmer pending, silak position
   ↓
   ├── [New Bill] → farmer/vepari details → line items → Save
   │                     ↓ (auto, no user action)
   │              [Vepari Dakhla entry created]
   │                     ↓ (auto)
   │              [Rojmer entry created, balance = bill total]
   │
   ├── [Vepari Dakhla] → select vepari → view/edit ledger by date
   │
   ├── [Rojmer] → list of pending balances → record payment (full/partial)
   │
   ├── [Jansa Silak] → daily balance sheet, carries forward automatically
   │
   └── [Settings] → vepari master list, rates, users, business profile
```

### Offline behavior
- All screens read/write to the local Dexie (IndexedDB) store first — the UI never waits on the network.
- A sync layer listens for connectivity and pushes/pulls changes to/from Firestore, which has its own offline persistence enabled as a second safety net.
- **Conflict rule**: last-write-wins per field is not acceptable for money — bills and payments are treated as **append-only events** (a payment is a new record, not an edit to a running total), so two offline locations recording payments to the same farmer never silently overwrite each other. Vepari dakhla totals and jansa silak are always **derived/computed** from these events, never stored as an editable running number.

## 3. Folder structure

```
shreenath-traders-management/
├── public/
│   └── icons/                     # PWA icons, manifest assets
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── firebase/
│   │   ├── config.js               # Firebase init
│   │   ├── auth.js                 # login/logout helpers
│   │   └── firestore.js            # typed collection helpers
│   ├── db/
│   │   └── localDb.js              # Dexie schema + offline queue
│   ├── sync/
│   │   └── syncEngine.js           # push/pull + conflict handling
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── bills/                  # કેશ મેમો entry + list
│   │   ├── vepariDakhla/
│   │   ├── vepariPay/              # vepari settlement (dakhla totals)
│   │   ├── rojmer/
│   │   ├── jansaSilak/
│   │   ├── reports/                # CA read-only reports
│   │   ├── admin/                  # users + offline queue (owner)
│   │   └── settings/
│   ├── components/                 # shared UI: ledger row, stamp badge, etc.
│   ├── context/                    # auth/role context (Phase 1) — read app-wide via hooks
│   ├── hooks/
│   ├── utils/
│   │   ├── calc.js                 # tolai/shes/commission formulas — single source of truth
│   │   └── dates.js                # FY boundary (01/04–30/03) helpers
│   └── styles/
│       └── tokens.css              # design tokens from design.md
├── firestore.rules
├── firebase.json
├── vite.config.js
└── package.json
```

## 4. Data model (Firestore collections)

```
businesses/{businessId}
  name, financialYearStart: "04-01"

businesses/{businessId}/users/{userId}
  name, email, role: "owner" | "staff" | "ca", location, phone?

businesses/{businessId}/veparis/{vepariId}
  name, village, customRates?: { tolai, shes, commission }

businesses/{businessId}/bills/{billId}
  farmerName, farmerVillage, vepariId, date, items: [{type, weightKg, ratePer20kg, amount}],
  totalAmount, createdBy, createdAt, locationId

businesses/{businessId}/payments/{paymentId}
  billId, amount, type: "cash" | "cheque", date, createdBy, createdAt
  # rojmer balance = bill.totalAmount - sum(payments where billId matches)

businesses/{businessId}/silakEntries/{entryId}
  date, side: "jama" | "udhar", label, amount, isManual: boolean, createdBy
  # daily closing balance is always computed, never stored as a mutable total
```

## 5a. Editing derived data safely

Bills, payments, and manual silak entries can all be **edited or corrected** after saving (per prd.md) — this doesn't contradict the append-only/derived-totals design in §5, it refines it:

- Editing a **bill** (weight, rate, farmer name) updates that bill record directly, but keeps a small `editHistory: [{field, oldValue, newValue, editedBy, editedAt}]` array on the record — so a correction is visible, not silent. Vepari dakhla/rojmer/silak all recompute automatically from the corrected bill, same as before.
- Editing a **payment** works the same way — the payment record is corrected in place with history kept, and rojmer balance recalculates from the corrected list.
- Payments (and bills) are **never deleted** — `firestore.rules` enforces this (`allow delete: if false`), matching rules.md §3's "the app never auto-deletes financial data." A payment entered entirely by mistake (wrong bill, duplicate entry) is **voided**, not deleted: `isVoided: true` plus a `voidReason`/`voidedBy`/`voidedAt`, set via the same `update` permission editing already uses — no new Firestore rule needed. A voided payment stays visible (struck through, clearly labeled) rather than vanishing, and is excluded from balance/clearing calculations (`calc.js`'s `getBillClearingInfo`). This is the standard accounting-software answer to "delete a financial record": the record and its audit trail survive; only its effect on the running balance is reversed.
- **Auto-populated** jansa silak entries (ones derived from bills/rojmer) are not directly editable as numbers — to correct them, correct the underlying bill/payment, and the silak entry updates itself. Only **manual** silak entries (e.g. a bank deposit typed in directly) are freely editable/deletable.

## 5b. Export & year-end archive

- Every list screen (bills, a vepari's dakhla, rojmer, silak, vepari pay, reports) has an "Export" action that builds an Excel/CSV/PDF client-side (ExcelJS/jsPDF) from the currently-filtered data — no server round trip needed beyond the initial data fetch.
- The year-end archive (prd.md §4.5) runs the same export logic for every module across the closing financial year, bundles the results with JSZip, and triggers a browser download. This is a **client-side, on-demand action confirmed by the user** — not a scheduled server job — specifically so it doesn't require Cloud Functions (see §6 below).

## 6. Cost constraint & free-tier design

The app must run entirely on free tiers (prd.md non-functional requirements). At a 1–5 user scale this is comfortable, but it shapes a few decisions:

- **No Cloud Functions for the year-end archive.** Firebase Cloud Functions require a Blaze (pay-as-you-go) billing account attached even if actual usage stays at ₹0 — the project owner may not want to add a card at all. Instead, the FY-boundary check and zip generation happen **client-side**, triggered on login (see prd.md §4.5).
- **Firestore usage stays inside Spark (free) plan limits** at this scale (5 users, modest daily bill volume).
  - **Firebase Storage is not used at all.** It was originally planned for bill photo attachments, but as of February 2026 Storage also began requiring the Blaze plan (same "even ₹0 usage needs a billing card" issue as Phone Auth — see the Auth row in §1). Rather than add billing, the owner chose to drop photo attachment from v1 entirely (prd.md §6) — bills reference the physical paper copy by entry number instead. `getStorage()` and `storage.rules` were removed from the codebase since nothing uses them.
- **No paid third-party APIs** anywhere in the stack (login uses Firebase's free email/password auth — see the Auth row in §1 for why phone/SMS auth was dropped — no paid export/PDF service either).
- If the business grows well beyond 5 users or needs features that push past free-tier limits, that's a deliberate future decision to revisit — not something the v1 architecture should assume or design around.

## 7. Why derived totals, not stored totals

Vepari dakhla totals, rojmer balances, and jansa silak closing balances are **calculated on read** from bills/payments/silakEntries, not stored as a number that gets edited directly. This is the single most important architectural decision for this app: it's what makes offline multi-location sync safe. Two people can each record a payment offline at the same time without one overwriting the other's number — because there is no shared number to overwrite, only a shared list of events.
