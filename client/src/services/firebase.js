import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  onAuthStateChanged,
} from 'firebase/auth'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const storage = getStorage(app)

export async function signUp(email, password, displayName) {
  const credential = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(credential.user, { displayName })
  return credential.user
}

export async function signIn(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password)
  return credential.user
}

export async function signOut() {
  await firebaseSignOut(auth)
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback)
}

export async function getIdToken() {
  const user = auth.currentUser
  if (!user) return null
  return user.getIdToken()
}
