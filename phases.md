# Phases — Shreenath Traders Management

Each phase should be fully working and demoable before moving to the next. Update `memory.md` when a phase (or a file within it) is completed.

## Phase 0 — Project setup
- Vite + React + Tailwind scaffold
- Firebase project created (Firestore, Auth, Storage, Hosting enabled)
- PWA plugin configured (manifest, icons, service worker shell)
- Folder structure from `architecture.md` in place
- Design tokens from `design.md` wired into `src/styles/tokens.css` + Tailwind config
- **Done when**: blank app deploys to Firebase Hosting, installable as a PWA on a phone.

## Phase 1 — Login
- Email + password login via Firebase Auth (originally phone number + OTP — switched because Firebase now requires the paid Blaze plan for phone/SMS auth; see architecture.md §1 and memory.md's decisions log)
- User record created/fetched in `businesses/{businessId}/users/{userId}` on first login
- Role read (owner/staff/ca) and stored in auth context
- Logout
- **Done when**: a real account can log in and land on an empty dashboard shell; role is available app-wide.

## Phase 2 — Dashboard
- Today's summary cards: bills entered today, rojmer pending count/amount, today's jansa silak position
- Quick action: "New Bill" button
- Bottom nav (mobile) / sidebar (desktop) linking to all main screens
- **Done when**: dashboard shows correct live numbers from Firestore, reads local-first per offline rules.

## Phase 3 — Vepari master list (Settings, partial)
- Add/edit/delete vepari: name, default village, optional custom rates
- Needed before bill entry, since bill entry references this list
- **Done when**: a vepari can be added and appears in a dropdown.

## Phase 4 — Bill entry (કેશ મેમો)
- Form: farmer name/village, date, vepari (dropdown from Phase 3), line items (type, weight, rate, auto amount), multi-line support
- Save writes to local Dexie immediately, syncs to Firestore in background
- Edit an existing bill (with edit history kept, per rules.md)
- Export a single bill or a filtered bill list to Excel/CSV/PDF
- **Done when**: a bill can be created fully offline (airplane mode test) and appears correctly once back online; an edited bill shows correct history; an export produces a readable file.

## Phase 5 — Vepari Dakhla (auto-ledger)
- Bills auto-grouped by vepari + date, no manual entry step
- Tolai/shes/commission/total computed via `src/utils/calc.js` using resolved rate (vepari override or business default)
- Edit a line (correct weight/rate) — recalculates totals live
- Export a vepari's ledger, or all veparis for a date range, to Excel/CSV/PDF
- **Done when**: every saved bill from Phase 4 appears correctly grouped and totaled here with zero manual steps, and an export matches what's shown on screen.

## Phase 6 — Rojmer (payments)
- List of bills with balance due (derived: bill total − sum of payments)
- Record a payment (amount, cash/cheque, date) — partial allowed
- Bill marked cleared when balance reaches 0, with clearing date shown
- Edit a payment (amount/date correction, with history kept); export rojmer list (pending/cleared/both) to Excel/CSV/PDF
- **Done when**: two payments recorded from two different offline devices for the same farmer both appear correctly once synced (this is the key architecture test — see architecture.md §5).

## Phase 7 — Jansa Silak (daily balance)
- Auto-populated જમા/ઉધાર entries derived from bills + rojmer + vepari dakhla
- Manual entry support (e.g. bank deposit)
- Opening balance carries forward from previous day's computed closing balance
- Manual entries editable/deletable (auto entries correct themselves via their source bill/payment, per architecture.md §5a)
- Export daily/monthly/full-year silak sheet to Excel/CSV/PDF
- **Done when**: closing balance for a day matches manual paper-ledger calculation for the same sample data used in `EX1.xlsx`, and edits to manual entries update the running balance correctly.

## Phase 8 — Settings (remaining) + users
- Global default rates (tolai/shes/commission)
- Business profile (name, financial year boundary — fixed 01/04–30/03 but confirmable)
- Add staff users, assign to a location
- **Done when**: a second staff login can be created and used from a second device/location.

## Phase 9 — Year-end archive
- Detect financial-year rollover (crossing 01/04) on app open
- Prompt: "Financial year closed — download full backup?"
- On confirm, generate the full export set (bills, all vepari dakhla, rojmer, silak) for the closed year and bundle as a single zip (JSZip), client-side, per architecture.md §5b — no Cloud Functions
- Confirm previous years remain fully browsable/searchable in-app (this is a backup, not a delete — rules.md)
- **Done when**: crossing the FY boundary in a test environment correctly prompts once, and the resulting zip contains a correct, complete export of every module for that year.

## Phase 10 — CA / reporting export
- Read-only report view: bill list, vepari-wise totals, commission earned, outstanding rojmer, filtered by financial year
- Export to Excel/PDF
- **Done when**: an export for a sample date range matches the totals shown in-app for the same range.

## Phase 11 — Offline hardening + polish
**Code for Phases 0–10 is complete.** Phase 11 is an **owner trial on real devices** — it cannot be closed from the agent alone.

### Owner multi-device offline checklist
Use two phones/browsers signed in as **owner** (or owner + staff). Prefer live app: https://shreenath-traders.web.app

1. **Single-device offline (airplane mode)**  
   - Go offline → add a bill → edit it → record a Rojmer payment and/or Vepari pay → check Admin → Queue shows pending.  
   - Go online → wait for sync → hard refresh → same records still present with correct totals.
2. **Two devices, different bills (same day)**  
   - Device A offline: bill for farmer X. Device B offline: bill for farmer Y.  
   - Both reconnect → both bills appear on both devices; નોંધ નં. / દાખલા નં. stay unique (no duplicate collisions).
3. **Two devices, same farmer bill payments (architecture key test)**  
   - Online: create one bill with balance > 0.  
   - Device A offline: partial Rojmer payment. Device B offline: another partial on the **same** bill.  
   - Both reconnect → both payments listed; balance = bill total − sum(non-voided); no payment lost.
4. **Conflict / edit edge**  
   - Device A offline edits farmer name on a bill. Device B offline voids a *different* bill.  
   - Reconnect → edit history on A’s bill; voided bill stays voided on both; Admin → Queue empty.
5. **Polish spot-check**  
   - Empty / error / loading states feel clear in Gujarati.  
   - PWA install on one phone; export one Excel + one PDF from Bills and Reports.

- Sync conflict rules: architecture.md §5 and rules.md §5  
- **Done when**: checklist above passes on real hardware, and the business can run a trial week without paper fallback for those flows.

---

### Suggested build order note
Phase 1 (login) and Phase 2 (dashboard shell) are listed first because they're structurally needed by everything else, but the **riskiest architectural bet — offline-first multi-location sync — should be proven early**, ideally by the end of Phase 4 (bill entry), not left until Phase 11. If offline sync doesn't work cleanly on real bill data, it's better to find out before Phases 5–10 are built on top of it.

At 1–5 users total, load/scale testing is not a real concern for this project — testing focus should stay on offline correctness and export/archive accuracy, not concurrency at scale.
