import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, set } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

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

const initialData = {
  "Ryhmä A": {
    "pelaaja1": { "nimi": "Ågren Pekka", "rating": 2207, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Slesar Tomas", "rating": 2143, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Debazac Florent", "rating": 2042, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Seppälä Marko", "rating": 1851, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Vimpari Lasse", "rating": 1833, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  },
  "Ryhmä B": {
    "pelaaja1": { "nimi": "Niemelä Konsta", "rating": 1916, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Koponen Saku", "rating": 1746, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Vuoste Hannu", "rating": 1701, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Halavaara Kari", "rating": 1561, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Trofimov Vitali", "rating": 1339, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  },
  "Ryhmä C": {
    "pelaaja1": { "nimi": "Honkavaara Oskari", "rating": 1561, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Zhu Ning", "rating": 1428, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Salminen Jukka-Pekka", "rating": 1349, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Tuuttila Tapio", "rating": 1295, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Mikkola Pekka", "rating": 1273, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  },
  "Ryhmä D": {
    "pelaaja1": { "nimi": "Trofimov Dennis", "rating": 1335, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Hiltunen Teijo", "rating": 1200, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Sammalneva Virpi", "rating": 1195, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Kääriäinen Juha", "rating": 925, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Montin Aapo", "rating": 900, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  }
};

async function emergencyRestore() {
    const statusDiv = document.getElementById("status");
    const btn = document.getElementById("restoreBtn");
    
    statusDiv.textContent = "Performing emergency restore...";
    statusDiv.className = "";
    btn.disabled = true;

    try {
        await set(ref(db, "Players"), initialData);
        await set(ref(db, "Backup/Players"), initialData);
        statusDiv.textContent = "Emergency restore completed! Player data restored. You can now go back to the dashboard.";
        statusDiv.className = "success";
    } catch (e) {
        console.error("Emergency restore error:", e);
        statusDiv.textContent = "Error: " + e.message + ". Make sure you are signed in as an administrator in another tab.";
        statusDiv.className = "error";
        btn.disabled = false;
    }
}

document.getElementById("restoreBtn").addEventListener("click", emergencyRestore);
