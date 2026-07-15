// src/lib/firebase.js
//
// This file connects the app to your Firebase project (the same kind of
// filing cabinet your expense tracker already uses).
//
// SETUP (plain steps):
// 1. Go to https://console.firebase.google.com and open your existing
//    PremiX Firebase project (or create one if this is brand new).
// 2. Project settings -> General -> "Your apps" -> Web app -> copy the
//    config values shown there.
// 3. Create a file called `.env.local` in the root of this project
//    (copy `.env.local.example` and rename it) and paste your values in.
// 4. Never commit `.env.local` to GitHub — it's already in .gitignore.

import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Avoids re-initializing Firebase on every hot-reload in development.
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
