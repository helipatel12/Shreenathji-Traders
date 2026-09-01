// Firebase project initialization.
//
// Values come from environment variables (see .env.example) rather than
// being hardcoded, so this file is safe to commit while the actual
// project credentials stay out of source control.
//
// NOTE (Phase 0): a real Firebase project (Firestore, Auth, Hosting
// enabled, Spark/free plan per rules.md §2 and architecture.md §6)
// still needs to be created in the Firebase console by the project owner,
// and its config values dropped into a local .env file. This file will
// throw a clear error until that happens, rather than silently using
// placeholder values.
// Storage is intentionally not initialized here — bill photo
// attachment was dropped from v1 scope (prd.md §6) once Firebase
// began requiring the Blaze plan for Storage access; see
// architecture.md §6 and memory.md's decisions log.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const requiredKeys = ['apiKey', 'projectId', 'appId']
const missing = requiredKeys.filter((key) => !firebaseConfig[key])

if (missing.length > 0) {
  // Loud in dev, so nobody chases a mysterious blank screen — see
  // rules.md §4 (no silent failures) applied to setup, not just runtime.
  console.error(
    `Firebase config is missing: ${missing.join(', ')}. ` +
      'Create a Firebase project (Spark/free plan) and copy its config into .env — see .env.example.'
  )
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// Firestore's own offline persistence, as architecture.md §2 describes:
// "Firestore, which has its own offline persistence enabled as a
// second safety net" alongside Dexie (src/db/localDb.js). Using
// initializeFirestore + persistentLocalCache rather than the older
// enableIndexedDbPersistence(), which the SDK now deprecates in favor
// of this. Multi-tab manager so the app behaves if the owner has it
// open in two browser tabs on the same device.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
})
