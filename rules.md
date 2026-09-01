# Rules — Shreenath Traders Management

Ground rules for anyone (human or AI) writing code in this repo.

## 1. Libraries — use

- React + Vite
- Tailwind CSS (core utility classes only — no custom plugin sprawl)
- Dexie.js (IndexedDB wrapper)
- Firebase SDK (auth, firestore, storage, hosting) — official SDK only
- Vite PWA plugin (Workbox under the hood)
- date-fns (date math — financial year boundaries, IST timezone handling)
- react-hook-form (form state — bill entry has many fields)
- react-router-dom (client-side navigation between screens — Home/Bill/Dakhla/Rojmer/Silak/Settings)
- lucide-react (icons)
- SheetJS (xlsx) — Excel/CSV export, client-side
- jsPDF — PDF export, client-side
- JSZip — year-end archive bundling, client-side

## 2. Libraries — avoid

- **Redux / MobX / Zustand** — app state is not complex enough; React Context + hooks is enough. Adding a state library is over-engineering for this scope.
- **Moment.js** — deprecated, heavy; use date-fns.
- **Any UI kit that bundles its own design system** (MUI, Chakra, Ant Design) — this app has a specific ledger-book visual identity (see design.md); a generic component kit fights that.
- **A custom Node/Express backend** — Firestore + security rules covers everything this app needs. Don't build a server unless a real requirement appears that Firestore genuinely cannot do.
- **Any library that stores money as a floating point without rounding rules** — always round currency to 2 decimals at the point of display and at the point of storage for computed values; never let floating-point drift accumulate silently.
- **Firebase Cloud Functions** (or any feature requiring the Blaze billing plan) — the project must stay on Firebase's free Spark plan; see architecture.md §6. Do the year-end archive and any "scheduled-feeling" logic client-side, triggered on user action/login instead.
- **Any paid API key or subscription service** of any kind (paid SMS, paid PDF/export APIs, paid map/geocoding, etc.) — if a feature seems to need one, flag it and propose a free alternative rather than adding it.

## 3. Money & calculation rules

- All money math (tolai, shes, commission, totals) lives in **one file**: `src/utils/calc.js`. No component is allowed to reimplement a formula inline. If a formula needs to change, it changes in one place.
- Rates are **per-vepari overridable, business-default otherwise** — always resolve rate as `vepari.customRates ?? business.defaultRates`, never hardcode a rate in a component.
- Never store a "running total" or "current balance" as an editable field. Balances are **always derived** from the underlying list of bills/payments (see architecture.md §5). This is non-negotiable — it's what keeps offline multi-location sync safe.
- Bills and payments are editable, but every edit appends to that record's `editHistory` array (field, old value, new value, who, when) rather than silently overwriting — see architecture.md §5a.
- The app never auto-deletes financial data, including at financial-year rollover — the year-end archive (architecture.md §5b) is a backup/export, not a purge. Any future "delete old data" feature needs explicit, separate confirmation UI — never bundle it with an export or year-change action.
- All currency displayed to 2 decimal places, rupee formatting (₹), Indian digit grouping (e.g. ₹1,23,456.78) not Western grouping.

## 4. Error handling

- Every Firestore write must be wrapped in try/catch; on failure, the write **stays queued locally** (Dexie) and retries automatically when back online — it must never just fail silently or throw the user's form data away.
- Show errors in the interface's voice, not a generic "Something went wrong": e.g. "Bill saved on this phone — will sync when internet is back," not a red toast with a stack trace.
- Never let a sync conflict silently drop data. If the sync engine ever encounters two records with the same ID from two devices (should be rare given append-only design — see architecture.md), keep both and flag for manual review rather than picking one.

## 5. Offline/sync boundaries

- Every screen must render and be fully usable (create, edit locally) with zero network calls. Network status is never a blocker for using the app.
- No screen may show a blank/loading spinner waiting on Firestore if local (Dexie) data already exists — read local first, reconcile with server in the background.

## 6. AI agent boundaries (for Claude Code / any AI working on this repo)

- **Do not** invent new Firestore collections or fields without updating `architecture.md` first — the data model is the contract.
- **Do not** modify `src/utils/calc.js` formulas without explicit confirmation from the project owner — these are real money calculations tied to actual business rates.
- **Do not** add a new npm dependency without checking it against §2 (avoid list) first and stating why it's needed.
- **Do not** remove or bypass the offline-first read pattern (local-first, sync-in-background) to "simplify" a component — this is a core requirement, not an implementation detail.
- **Do** work one phase at a time per `phases.md`, and update `memory.md` after finishing a file or feature.
- **Do** ask before changing anything in `firestore.rules` (security rules) — a mistake here can expose one location's data to another.
- When unsure whether a change is in scope, treat `prd.md` as the source of truth for what v1 includes — don't silently add out-of-scope features (see prd.md §6).

## 7. Code style

- Functional components + hooks only, no class components.
- One feature = one folder under `src/features/` (see architecture.md folder structure) — no cross-feature imports except through shared `components/`, `hooks/`, `utils/`.
- Gujarati UI strings live in a single `src/locales/gu.json` file, not inline in components — makes it possible to add English/Hindi later without touching component code.
- Every form uses react-hook-form + a schema (zod) for validation — no manual `useState` per field for anything beyond 2 fields.
