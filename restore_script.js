
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyCx-WWULj2y8-ZfY7zKq-fCAkELwwP0-Ak",
  authDomain: "opt86elake.firebaseapp.com",
  databaseURL: "https://opt86elake-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "opt86elake",
  storageBucket: "opt86elake.firebasestorage.app",
  messagingSenderId: "759056126209",
  appId: "1:759056126209:web:5275a95b76577e3d268b00"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function restore() {
    console.log("Starting restore...");
    try {
        const snapshot = await get(ref(db, "Backup/Players"));
        const data = snapshot.val();
        if (!data) {
            console.error("No backup found at the Backup/Players path!");
            return;
        }
        await set(ref(db, "Players"), data);
        console.log("Restore completed!");
    } catch (e) {
        console.error("Restore error:", e);
    }
}

restore();
