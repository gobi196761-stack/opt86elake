
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, get, set } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

const firebaseConfig = {
  apiKey: "AIzaSyDpw6dswlMirzivT3r3H4X3TYeDbn9Hjgo",
  authDomain: "testisofta-f0e2a.firebaseapp.com",
  databaseURL: "https://testisofta-f0e2a-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "testisofta-f0e2a",
  storageBucket: "testisofta-f0e2a.firebasestorage.app",
  messagingSenderId: "367683236352",
  appId: "1:367683236352:web:7123a65c4ef7db5cfadee5"
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
