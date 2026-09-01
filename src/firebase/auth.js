// Login/logout helpers (Firebase Auth, email + password) — Phase 1.
//
// Originally built as phone number + OTP per the original phases.md
// plan, matching architecture.md's original reasoning that phone
// "fits Indian small-business users better than email." That's still
// true from a pure UX standpoint, but Firebase changed its pricing in
// September 2024: phone/SMS auth now requires the Blaze (pay-as-you-go)
// plan with a billing card attached, even for the first SMS — there's
// no Spark-plan (free) path left for it. That broke prd.md §5's "free
// tiers only, nothing that bills the owner" requirement, so the owner
// chose to switch to email + password instead, which stays fully free
// on Spark. See memory.md's decisions log for the full writeup.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import { auth } from './config'

export async function signUp(email, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function logout() {
  await signOut(auth)
}
