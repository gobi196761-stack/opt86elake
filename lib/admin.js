// Firebase Admin SDK Vercel-funktioille. Palvelutili annetaan ympäristömuuttujassa
// FIREBASE_SERVICE_ACCOUNT (Firebase Console -> Project settings -> Service accounts ->
// Generate new private key; JSON sellaisenaan tai base64-koodattuna).
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const DATABASE_URL = process.env.FIREBASE_DATABASE_URL ||
  "https://opt86elake-default-rtdb.europe-west1.firebasedatabase.app";

export class ConfigError extends Error {}

function serviceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) throw new ConfigError("FIREBASE_SERVICE_ACCOUNT environment variable is not set");
  const json = raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(json);
}

// Emulaattorissa (FIREBASE_DATABASE_EMULATOR_HOST) palvelutiliä ei tarvita
function appOptions() {
  if (process.env.FIREBASE_DATABASE_EMULATOR_HOST) {
    return { projectId: process.env.GCLOUD_PROJECT || "opt86elake", databaseURL: DATABASE_URL };
  }
  return { credential: cert(serviceAccount()), databaseURL: DATABASE_URL };
}

export function admin() {
  const app = getApps()[0] || initializeApp(appOptions());
  return { auth: getAuth(app), db: getDatabase(app) };
}
