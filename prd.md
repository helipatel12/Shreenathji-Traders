# PRD — Shreenath Traders Management
**Commission Agent (Aadatiya) Management App**

## 1. What this is

A digital ledger app for an agricultural commission agent (aadatiya / kacha vepari) who sits between **farmers (khedut)** selling produce and **traders (vepari)** buying it. Today this is done on paper: cash memos, a vepari ledger book, a rojmer (payments-due) notebook, and a daily cash-balance (jansa silak) page. This app replaces those four paper registers with one connected system, while keeping the exact same workflow and vocabulary the business already uses.

## 2. Problem

- Same data (farmer name, amount) gets written by hand into 3–4 different registers → slow, error-prone, hard to cross-check.
- No easy way to see "who still owes a farmer money" or "what's my cash position today" without flipping through books.
- Paper bills get lost/damaged; no backup.
- Multiple people/locations can't see the same books at the same time.
- No search — finding "all bills from Bharat Traders in March" means flipping every page.

## 3. Target users

- **Primary**: The aadatiya (owner/operator) — enters bills, manages vepari accounts, tracks payments, checks daily cash position.
- **Secondary**: Staff/munim at the same or a second location — enters bills, records payments, cannot change settings or rates.
- **Tertiary**: CA / accountant — read-only access at period end to export reports (see "Part-B / CA" in original notes).

Business is Gujarati-language, so all farmer-facing and ledger vocabulary stays in Gujarati (with English where natural, e.g. "cash", "cheque").

## 4. Core features (v1 scope)

### 4.1 Bill entry (કેશ મેમો)
- Record: farmer name, farmer village, date, buyer/vepari name, vepari village (auto-filled from vepari master list).
- Line items: goods type (ડાંગર, મગ, ઘાવ, મઠિયાં, રાજગરો, ચણા, તુવેર, custom), weight (kg), rate (per 20kg, matching current paper convention), auto-calculated amount.
- Support multiple goods lines per bill.
- Fully editable after saving (correct a typo, weight, rate) — an edit history/timestamp is kept so nothing changes silently.
- Downloadable: any single bill, or the full bill list for a date range, exportable as Excel/CSV/PDF.

### 4.2 Vepari Dakhla (auto-generated trader ledger)
- Every saved bill automatically appears under its vepari's ledger, grouped by vepari name + date — no manual re-entry.
- Auto-calculates: tolai (weighing charge), shes (wastage %), commission (%), and total amount owed by the vepari.
- Default formulas from existing business rates (editable in Settings):
  - Tolai = ₹0.006 × total weight (kg)
  - Shes = 0.7% × goods amount
  - Commission = 0.45% × goods amount
  - Total owed = goods amount + tolai + shes + commission
- Editable: an aadatiya can override any line (correct a weight, adjust a rate) after the fact.
- Vepari master list with default village (e.g. Bharat Traders → Tarapur), managed in Settings.
- Downloadable: any vepari's ledger, or all veparis for a date range, exportable as Excel/CSV/PDF.

### 4.3 Rojmer (farmer payment tracking)
- Per bill: total bill amount, amount paid so far, payment type (cash/cheque), balance remaining.
- Partial payments supported — record each payment with its own date.
- When balance reaches 0, bill is marked "cleared" with the clearing date.
- Filterable view: "who do I still owe money to."
- Payments editable (correct an amount/date entered by mistake) — edit history kept. A payment entered by mistake entirely (wrong bill, duplicate) is voided rather than deleted — see architecture.md §5a.
- Downloadable: rojmer list (pending or cleared, or both) for a date range, as Excel/CSV/PDF.

### 4.4 Jansa Silak (daily cash position)
- Per day: જમા (money currently held — includes farmer balances not yet paid, bank balance) vs ઉધાર (money paid out to veparis/settled).
  - ⚠️ **Built interpretation, needs owner validation**: this wording is a little ambiguous, and the app doesn't track "cash actually collected from a vepari" as its own event — only what a vepari currently owes (§4.2's dakhla). Since this phase's own dependency is stated as "bills + rojmer + vepari dakhla," not a new vepari-payment feature, the implementation treats જમા as each bill's goods amount on its own date, and ઉધાર as each rojmer payment on its own date. This is the most internally-consistent reading using only what's already built, but hasn't been checked against a real paper ledger or the sample data referenced in phases.md Phase 7's "done when." See `useJansaSilak.js`'s header comment and memory.md's decisions log.
- Opening balance carries forward automatically from the previous day's closing balance.
- Manual entries allowed (e.g. bank deposit/withdrawal) alongside auto-populated entries from bills/rojmer.
- Manual entries editable/deletable; auto-populated entries can be annotated but not silently altered (they reflect real bills/payments — see architecture.md §5 on derived totals).
- Downloadable: daily/monthly/full-year silak sheet, as Excel/CSV/PDF.

### 4.5 Year-end archive (auto, on financial year change)
- App detects the first login/use on or after 01/04 (new FY start) and prompts: "Financial year closed — download full backup?" — tracked per-device (localStorage), matching this section's own "offered as a direct download on the device doing the check" — a multi-location business plausibly wants each device to get its own backup rather than one device's dismissal silencing it everywhere. See `useYearEndArchive.js`'s header comment.
- One tap generates a single ZIP containing: all bills, all vepari dakhla exports, all rojmer records, all jansa silak sheets, and the vepari master list — each as its own Excel/CSV file inside the zip, for the just-closed year (01/04 previous year → 30/03 current year).
- The zip is offered as a direct download on the device doing the check; it is not something the user has to remember to trigger — but it also never happens silently without the user's confirmation, since it may be a large file on mobile data.
- Previous years' data stays visible/searchable in the app too (archiving is a backup, not a delete) — this app never deletes financial data on its own. See rules.md for retention rule.

### 4.6 Settings
- Vepari master list: name, default village, custom commission rates (overrides global default).
- Global rate defaults (tolai/shes/commission).
- Financial year: starts 01/04, closes 30/03 — app resets/archives year-over-year on this boundary.
- Business name/profile.
- User management (add staff, assign location).

### 4.7 CA / reporting (Part-B)
- Read-only export view for the financial year: bill list, vepari-wise totals, commission earned, outstanding rojmer balances.
- Export to Excel/PDF for handing to the CA.
- This overlaps with the year-end archive (4.5) but stays as a separate on-demand report — the CA may want a specific date range mid-year, not just the full closed-year zip.

## 5. Non-functional requirements

- **Offline-first**: must be fully usable with no internet (create bills, record payments); syncs automatically when connection returns.
- **Multi-location**: small scale — up to 5 user logins total (owner + staff across locations), minimum 1. All see a shared, synced set of books (with conflict handling — see architecture.md). This is a small-business tool, not designed to scale beyond that without revisiting the architecture.
- **Mobile + desktop**: same app, responsive — phone for on-the-spot bill entry in the yard, computer for end-of-day reconciliation.
- **Language**: Gujarati-first UI with the specific business vocabulary already in use (not generic translations).
- **Data safety**: ledger entries must never be silently lost, even offline.
- **Cost**: the app must run on **free tiers only** — no paid subscriptions, no paid API keys, nothing that bills the owner per month. At 1–5 users this fits comfortably inside Firebase's free (Spark) plan and free/open-source libraries throughout. See architecture.md §6 and rules.md §1 for the specific choices this drives (e.g. avoiding Cloud Functions, which require a billing account even when usage is free).
- **Editability & export everywhere**: every module (bills, vepari dakhla, rojmer, jansa silak) supports edit-after-save and export to Excel/CSV/PDF, individually and in bulk. This is a first-class requirement, not an afterthought — see each feature above.

## 6. Out of scope (v1)

- Direct integration with bank/UPI for payments.
- SMS/WhatsApp notifications to farmers.
- Multi-currency (not applicable).
- Inventory/warehouse management beyond what's on the bill.
- Native iOS/Android app builds (PWA covers this for v1 — see architecture.md).
- Bill photo attachment. Originally in scope (camera/gallery capture, per an earlier draft of this doc), removed because it depended on Firebase Storage, which — like phone/SMS auth — now requires the paid Blaze plan even at ₹0 actual usage; the owner chose to drop the feature rather than add a billing card. See architecture.md §1/§6 and memory.md's decisions log. Bills still reference the physical paper copy by entry number (design.md §4) for manual cross-checking.

## 7. Success criteria

- An aadatiya can fully replace their 4 paper registers with this app for daily use.
- Every bill entered on a phone with no signal appears correctly on the office computer once online.
- Vepari dakhla and jansa silak totals always match what bill + rojmer entries imply (no manual reconciliation needed).
- A new staff member can be trained to enter a bill in under 5 minutes.
