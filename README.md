# Shreenath Traders Management

Digital ledger for **Shreenathji Traders** (agricultural commission agent / aadatiya). Replaces paper કેશ મેમો, વેપારી દાખલા, રોજમેળ, and જણસે સિલક with one offline-first Firebase app.

**Live:** https://shreenath-traders.web.app

Used by the **broker** (owner/staff). Farmers and buyers are parties on bills — not login roles.

## Features

- **Cash memo (બિલ)** — create, edit, void, print in paper-memo format
- **Vepari dakhla** — auto ledger with tolai / shes / commission
- **Rojmer** — farmer payment tracking
- **Jansa silak** — daily cash position
- **Gujarati ↔ English** language toggle (UI); printed bills stay Gujarati
- **Roles** — owner (full), staff (write ledgers), CA (read-only)
- Offline-first via Dexie + Firestore

## Getting started

```bash
npm install
cp .env.example .env   # fill in Firebase web config
npm run dev
```

### Firebase setup

1. Create a project at https://console.firebase.google.com (Spark/free is fine).
2. Enable **Firestore** and **Authentication → Email/Password**.
3. Copy web app config into `.env` (see `.env.example`).
4. Deploy security rules:

```bash
firebase deploy --only firestore:rules,storage:rules
```

The first account to sign up becomes the **owner**. Invite staff/CA from Settings.

### Scripts

- `npm run dev` — local development
- `npm run build` — production build + PWA
- `npm run preview` — preview production build
- `npm run lint` — oxlint

## Docs

- `prd.md` — product scope
- `architecture.md` — data model & offline design
- `rules.md` — engineering constraints
- `design.md` — UI identity
- `phases.md` — build phases
- `memory.md` — decision log

## Print

Cash memo print (`src/features/bills/billPrint.js`) matches the red-bordered paper pad: farmer + village, buyer + village, weight as ક્વિ./કી., amount as રૂા./પૈસા.
