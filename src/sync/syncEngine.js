// Push/pull sync between the local Dexie store (src/db/localDb.js) and
// Firestore, plus conflict handling for append-only bills/payments
// (architecture.md §2 "Offline behavior", §5, §7).
//
// Implemented per feature hook rather than as one central engine:
//   useVeparis.js / useBills.js / usePayments.js / useSilakEntries.js
// each do Dexie-first writes, then background Firestore setDoc/updateDoc,
// with live onSnapshot merge via syncHelpers.js (up-front firestoreId
// to avoid duplicate rows). That proved the offline-first bet by Phase 4
// and was reused through Phases 5–9 — see memory.md.
//
// This file remains as the architecture.md §3 folder placeholder so the
// documented layout stays intact; do not add a second sync path here
// without consolidating the hooks first.
