# Shreenath Traders Management

A digital ledger app for an agricultural commission agent (aadatiya) — replaces four paper registers (કેશ મેમો, વેપારી દાખલા, રોજમેળ, જણસે સિલક) with one connected, offline-first app.

Full project docs live alongside the code and are the source of truth:

- `prd.md` — what this is, for whom, and v1 scope
- `architecture.md` — tech stack, data model, folder structure, offline/sync design
- `rules.md` — library allow/avoid list, money-math rules, AI agent boundaries
- `design.md` — the bahi khata (ledger-book) visual identity
- `phases.md` — build order, one demoable phase at a time
- `memory.md` — running log of what's done and what's next (**read this first**)

## Status

**Phase 0 (project setup) — done.** See `memory.md` for details and what's next.

## Getting started

```bash
npm install
cp .env.example .env   # fill in Firebase config — see below
npm run dev
```

### Firebase project (manual step — not done yet)

This scaffold expects a Firebase project on the **free Spark plan** with Firestore, Authentication (Email/Password provider), and Hosting enabled. Firebase Storage is intentionally not used — bill photo attachment was dropped from v1 scope after Firebase began requiring the paid Blaze plan for Storage access; see `architecture.md` §6. Nobody can create the Firebase project on your behalf from here — it needs the Firebase console and your Google account:

1. Create a project at https://console.firebase.google.com (stay on Spark/free — see `rules.md` §2 and `architecture.md` §6).
2. Enable **Firestore Database** and **Authentication → Email/Password**.
3. Add a web app to the project and copy its config values into `.env` (see `.env.example`).
4. `firebase.json`, `firestore.rules`, and `firestore.indexes.json` are already scaffolded in this repo — `firestore.rules` is a **draft** and needs your review before `firebase deploy` (see the comment at the top of the file, and `rules.md` §6).

### Scripts

- `npm run dev` — local dev server
- `npm run build` — production build to `dist/` (also generates the PWA service worker + manifest)
- `npm run preview` — serve the production build locally
- `npm run lint` — oxlint

## What's here vs. what's next

Phase 0 set up the scaffold, design tokens, and PWA shell — see `phases.md` for Phase 0's exact checklist and `memory.md` for what's done. It did **not** build login, the dashboard, or any of the four ledger modules; those are Phases 1–11.
