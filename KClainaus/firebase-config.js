import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAJ7NZHIiwYbICxjMcCyZY3TGH7YhFmpvw",
  authDomain: "kclainaus.firebaseapp.com",
  databaseURL: "https://kclainaus-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "kclainaus",
  storageBucket: "kclainaus.firebasestorage.app",
  messagingSenderId: "785222933901",
  appId: "1:785222933901:web:df0ab0bf9ee983e64e71c4",
  measurementId: "G-SW2HTD1SM3"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);