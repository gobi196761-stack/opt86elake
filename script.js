import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, get, set, update } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut, sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

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
const auth = getAuth(app);

// Nimen vertailuavain: pienet kirjaimet, ylimääräiset välilyönnit pois ja
// sanat aakkosjärjestykseen -> "Lasse Vimpari" ja "Vimpari Lasse" = sama nimi.
function normalizeNameKey(name) {
    return (name || "").trim().toLowerCase().replace(/\s+/g, " ").split(" ").sort().join(" ");
}

// AUTH UI LOGIC
window.toggleAuthMode = function() {
    document.getElementById("loginForm").classList.toggle("hidden");
    document.getElementById("registerForm").classList.toggle("hidden");
};

window.login = async function () {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
        showSuccessAndRedirect();
    } catch (error) {
        alert("Login error: " + error.message);
    }
};

window.forgotPassword = async function() {
    const email = document.getElementById("email").value;
    if (!email) {
        alert("Enter your email address in the email field first.");
        return;
    }
    
    if (confirm(`Send a password reset link to ${email}?`)) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("A reset link has been sent to your email.");
        } catch (error) {
            alert("Error: " + error.message);
        }
    }
};

window.register = async function () {
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const password = document.getElementById("reg-password").value;

    // Kenttä on pakollinen: tyhjällä nimellä ei ole tarkoitus luoda tunnusta
    if (!name) {
        alert("Enter your player name.");
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Estä nimen käyttö, jos jokin käyttäjä käyttää jo saman nimistä nimeä
        // (vertailu: pienet kirjaimet, välilyönnit ja sanajärjestys eivät merkitse).
        // Tarkistus tehdään vasta tunnuksen luonnin jälkeen, koska tietokannan
        // säännöt sallivat lukemisen vain kirjautuneelle; varatulla nimellä
        // juuri luotu tunnus poistetaan.
        const regUsersSnapshot = await get(ref(db, "Users"));
        const regAllUsers = regUsersSnapshot.val() || {};
        const regNameKey = normalizeNameKey(name);
        const regNameTaken = Object.values(regAllUsers).some(u =>
            u && u.nimi && normalizeNameKey(u.nimi) === regNameKey
        );
        if (regNameTaken) {
            await user.delete();
            alert("This name is already in use by another user. Choose a different name or contact the administrator.");
            return;
        }

        // Tallenna käyttäjän nimi ja rooli.
        // Nimen on MUISTUTTAVA tallentua, muuten sitä kysytään myöhemmin
        // dashboardilta – siksi uusyritys, jos ensimmäinen tallennus epäonnistuu.
        const userData = { nimi: name, email: email, rooli: "pelaaja" };
        try {
            await set(ref(db, `Users/${user.uid}`), userData);
        } catch (saveError) {
            console.error("Name save failed, retrying:", saveError);
            await new Promise(resolve => setTimeout(resolve, 700));
            try {
                await set(ref(db, `Users/${user.uid}`), userData);
            } catch (saveError2) {
                alert("Your account was created, but the player name could not be saved (" + saveError2.message + "). You will be asked for the name once you open the dashboard.");
            }
        }

        showSuccessAndRedirect();
    } catch (error) {
        alert("Registration error: " + error.message);
    }
};

window.loginAsVisitor = async function () {
    try {
        await signInAnonymously(auth);
        showSuccessAndRedirect();
    } catch (error) {
        alert("Visitor login failed: " + error.message);
    }
};

function showSuccessAndRedirect() {
    const loginContainer = document.getElementById("loginContainer");
    if (loginContainer) loginContainer.classList.add("hidden");
    
    const successMessage = document.getElementById("successMessage");
    if (successMessage) successMessage.classList.remove("hidden");

    setTimeout(() => {
        window.location.href = "dashboard.html";
    }, 1500);
}

window.logout = async function() {
    await signOut(auth);
    window.location.href = "index.html";
};

window.changeMyName = async function() {
    const uusiNimiRaw = prompt("Enter your new player name in the form 'Lastname Firstname':", currentUserData.nimi);
    if (!uusiNimiRaw) return;
    
    const uusiNimi = uusiNimiRaw.trim();
    const lowerNimi = uusiNimi.toLowerCase();
    const nimiKey = normalizeNameKey(uusiNimi);
    if (nimiKey === normalizeNameKey(currentUserData.nimi)) return;

    try {
        const user = auth.currentUser;
        if (!user) return;

        // 1. Estä "Kyösti Alaruikka" (case-insensitive) jos sähköposti ei täsmää
        const isKyosti = lowerNimi === "kyösti alaruikka" || lowerNimi === "alaruikka kyösti";
        if (isKyosti && user.email !== "kyosti.alaruikka@gmail.com") {
            alert("This name is reserved for the main administrator.");
            return;
        }

        // 2. Tarkista onko nimi jo käytössä TOISELLA käyttäjällä (case-insensitive)
        const usersSnapshot = await get(ref(db, "Users"));
        const allUsers = usersSnapshot.val() || {};
        const nameExists = Object.entries(allUsers).some(([uid, u]) =>
            uid !== user.uid && u.nimi && normalizeNameKey(u.nimi) === nimiKey
        );

        if (nameExists) {
            alert("This name is already in use by another user. Choose a different name or contact the administrator.");
            return;
        }

        // 3. Tarkista löytyykö nimi pelaajalistalta TAI ylläpitäjälistalta (case-insensitive)
        const playersSnapshot = await get(ref(db, "Players"));
        const playersData = playersSnapshot.val() || {};
        const adminSnapshot = await get(ref(db, "Config/Admins"));
        const adminList = adminSnapshot.val() || ["kyöstialaruikka", "lassevimpari"];
        
        let foundInList = false;
        let exactNameFromList = uusiNimi;

        // Tarkista pelaajat
        Object.values(playersData).forEach(group => {
            Object.values(group).forEach(p => {
                if (p && p.nimi && normalizeNameKey(p.nimi) === nimiKey) {
                    foundInList = true;
                    exactNameFromList = p.nimi;
                }
            });
        });

        // Tarkista ylläpitäjät (jos ei löytynyt pelaajista)
        if (!foundInList) {
            const foundAdmin = adminList.find(a => a.toLowerCase() === lowerNimi.replace(/\s+/g, ''));
            if (foundAdmin) {
                foundInList = true;
                // Ylläpitäjälistalla nimet ovat ilman välilyöntejä, pidetään käyttäjän syöttämä muoto tai korjataan
                exactNameFromList = uusiNimi; 
            }
        }

        if (!foundInList) {
            alert("The name was not found on the player or administrator list. Make sure you typed the name correctly.");
            return;
        }

        // Päivitä nimi
        await update(ref(db, `Users/${user.uid}`), { nimi: exactNameFromList });
        alert("Name updated! The page is reloading.");
        location.reload();
        
    } catch (error) {
        alert("Error updating name: " + error.message);
    }
};

// DASHBOARD LOGIC - Päivitetty: 2026-10-13 23:15
let currentUserData = null;
let isAdmin = false;

async function checkUserPermissions() {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                if (user.isAnonymous) {
                    currentUserData = { rooli: "vierailija" };
                    isAdmin = false;
                } else {
                    const snapshot = await get(ref(db, `Users/${user.uid}`));
                    currentUserData = snapshot.val();
                    
                    // Jos nimi puuttuu, odotetaan 1.5s ja yritetään uudelleen (Firebase-viive)
                    if (!currentUserData || !currentUserData.nimi || currentUserData.nimi === "Tuntematon") {
                        await new Promise(r => setTimeout(r, 1500));
                        const snapshot2 = await get(ref(db, `Users/${user.uid}`));
                        currentUserData = snapshot2.val() || { rooli: "pelaaja", nimi: "Tuntematon" };
                    }
                    
                    // Jos nimi puuttuu tai on "Tuntematon", pyydä asettamaan se
                    if (!currentUserData.nimi || currentUserData.nimi === "Tuntematon") {
                        const uusiNimi = prompt("Your player name is missing. Enter your name in the form 'Lastname Firstname':");
                        if (uusiNimi && uusiNimi.trim()) {
                            const ehdokas = uusiNimi.trim();
                            const ehdokasLower = ehdokas.toLowerCase();
                            const ehdokasKey = normalizeNameKey(ehdokas);

                            // 1. "Kyösti Alaruikka" on varattu pääylläpitäjälle (sama sääntö kuin nimen vaihdossa)
                            const ehdokasKyosti = ehdokasLower === "kyösti alaruikka" || ehdokasLower === "alaruikka kyösti";
                            if (ehdokasKyosti && user.email !== "kyosti.alaruikka@gmail.com") {
                                alert("This name is reserved for the main administrator. Choose a different name.");
                            } else {
                                // 2. Estä nimi, joka on jo toisen käytössä (myös päinvastaiset variaatiot)
                                const usersSnap = await get(ref(db, "Users"));
                                const nimiVarattu = Object.entries(usersSnap.val() || {}).some(([uid2, u2]) =>
                                    uid2 !== user.uid && u2 && u2.nimi && normalizeNameKey(u2.nimi) === ehdokasKey
                                );
                                if (nimiVarattu) {
                                    alert("This name is already in use by another user. Choose a different name.");
                                } else {
                                    await update(ref(db, `Users/${user.uid}`), { nimi: ehdokas });
                                    currentUserData.nimi = ehdokas;
                                }
                            }
                        }
                        // Varmista että nimi ei jää tyhjäksi (muuten admin-tarkistus kaatuu)
                        if (!currentUserData.nimi) {
                            currentUserData.nimi = "Tuntematon";
                        }
                    }

                    // Tarkista admin-oikeus tietokannasta
                    const adminSnapshot = await get(ref(db, "Config/Admins"));
                    const admins = adminSnapshot.val() || ["kyöstialaruikka", "lassevimpari"];
                    const cleanName = currentUserData.nimi.replace(/\s+/g, '').toLowerCase();
                    isAdmin = admins.includes(cleanName);
                }
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

window.fetchAndDisplayGroups = async function () {
  const groupsRef = ref(db, "Players");
  const snapshot = await get(groupsRef);
  const data = snapshot.val();
  
  const container = document.getElementById("groups-container");
  container.innerHTML = "";

  // Lisää uloskirjautumisnappi
  const logoutBtn = document.createElement("button");
  logoutBtn.textContent = "Log out";
  logoutBtn.onclick = logout;
  logoutBtn.style.float = "right";
  logoutBtn.style.background = "#7f8c8d";
  logoutBtn.style.marginLeft = "10px";
  container.appendChild(logoutBtn);

  // Lisää nimenmuutosnappi (vain kirjautuneille pelaajille)
  if (currentUserData && currentUserData.rooli !== "vierailija") {
    const nameBtn = document.createElement("button");
    nameBtn.textContent = `Change name (${currentUserData.nimi})`;
    nameBtn.onclick = changeMyName;
    nameBtn.style.float = "right";
    nameBtn.style.background = "#3498db";
    container.appendChild(nameBtn);
  }

  if (!data) {
    const msg = document.createElement("p");
    msg.textContent = "No players or groups found.";
    msg.style.textAlign = "center";
    msg.style.marginTop = "50px";
    container.appendChild(msg);
    
    // Jos data on tyhjä, näytä silti admin-napit (jotta voi palauttaa tai generoida)
    if (isAdmin) {
      addButtons();
    }
    return;
  }

  Object.keys(data).sort().forEach(groupKey => {
    const groupData = data[groupKey];
    const players = Object.keys(groupData)
      .filter(key => key.startsWith("pelaaja"))
      .map(key => ({ ...groupData[key], id: key }));

    const groupTitle = document.createElement("h2");
    groupTitle.className = "group-title";
    groupTitle.textContent = groupKey.replace("Ryhmä", "Group");
    container.appendChild(groupTitle);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>Name</th>` +
      players.map(p => `<th>${p.nimi}</th>`).join("") + 
      `<th>Points</th><th>Position</th><th>Rating</th>`;
    table.appendChild(headerRow);

    players.forEach((player, rowIndex) => {
      const row = document.createElement("tr");
      
      row.innerHTML = `<td>${player.nimi}</td>`;

      players.forEach((opponent, colIndex) => {
        if (rowIndex === colIndex) {
          row.innerHTML += `<td>-</td>`;
        } else {
          const matchResult = groupData.ottelut ? groupData.ottelut[`${rowIndex}-${colIndex}`] || "TBD" : "TBD";
          
          // Tarkista muokkausoikeus:
          // 1. Käyttäjä on ylläpitäjä TAI
          // 2. Käyttäjä on jompikumpi pelaajista (eikä ole vierailija)
          const isVisitor = currentUserData.rooli === "vierailija";
          const isMyMatch = !isVisitor && (normalizeNameKey(currentUserData.nimi) === normalizeNameKey(player.nimi) || normalizeNameKey(currentUserData.nimi) === normalizeNameKey(opponent.nimi));
          const canEdit = isAdmin || isMyMatch;

      // Värit tuloksille (select-laatikon taustaksi):
      // Voitto: #a5d6a7, Häviö: #ef9a9a
      let selectStyle = '';
      let matchStyle = '';

      if (matchResult !== "TBD") {
          const [a, b] = matchResult.split('-').map(Number);
          if (a > b) {
              selectStyle = 'background-color: #a5d6a7;';
              matchStyle = 'color: #ffffff; font-weight: bold;';
          } else if (a < b) {
              selectStyle = 'background-color: #ef9a9a;';
              matchStyle = 'color: #ffffff; font-weight: bold;';
          }
      }

      row.innerHTML += `<td>
            <select id="result-${groupKey}-${rowIndex}-${colIndex}" 
                    onchange="updatePoints('${groupKey}', ${rowIndex}, ${colIndex})"
                    ${!canEdit ? 'disabled' : ''}
                    style="${selectStyle} ${matchStyle}">
              <option value="TBD" style="color: black; background-color: white;" ${matchResult === "TBD" ? "selected" : ""}>TBD</option>
              <option value="3-2" style="color: black; background-color: white;" ${matchResult === "3-2" ? "selected" : ""}>3-2</option>
              <option value="3-1" style="color: black; background-color: white;" ${matchResult === "3-1" ? "selected" : ""}>3-1</option>
              <option value="3-0" style="color: black; background-color: white;" ${matchResult === "3-0" ? "selected" : ""}>3-0</option>
              <option value="0-3" style="color: black; background-color: white;" ${matchResult === "0-3" ? "selected" : ""}>0-3</option>
              <option value="1-3" style="color: black; background-color: white;" ${matchResult === "1-3" ? "selected" : ""}>1-3</option>
              <option value="2-3" style="color: black; background-color: white;" ${matchResult === "2-3" ? "selected" : ""}>2-3</option>
            </select>
          </td>`;
        }
      });

      // Määritä sijoituksen väri
      let rankStyle = "background-color: #fff9c4; color: black; font-weight: bold; border-radius: 4px; padding: 2px 8px;";
      const rank = player.sijoitus;
      const totalPlayers = players.length;
      
      if (rank === 1) {
        rankStyle = "background-color: #4caf50; color: white; font-weight: bold; border-radius: 4px; padding: 2px 8px;";
      } else if (rank === 2) {
        rankStyle = "background-color: #81c784; color: white; font-weight: bold; border-radius: 4px; padding: 2px 8px;";
      } else if (rank === totalPlayers - 1 && totalPlayers > 2) {
        rankStyle = "background-color: #ef9a9a; color: white; font-weight: bold; border-radius: 4px; padding: 2px 8px;"; // Vaaleanpunainen
      } else if (rank === totalPlayers && totalPlayers > 1) {
        rankStyle = "background-color: #b71c1c; color: white; font-weight: bold; border-radius: 4px; padding: 2px 8px;"; // Tummanpunainen
      }

      row.innerHTML += `
        <td id="points-${groupKey}-${rowIndex}" style="text-align: center;">${player.pisteet}</td>
        <td id="rank-${groupKey}-${rowIndex}" style="text-align: center;"><span style="${rankStyle}">${rank}</span></td>
        <td style="text-align: center;">${player.rating}</td>`;
      table.appendChild(row);
    });

    const tableScroll = document.createElement("div");
    tableScroll.className = "table-scroll";
    tableScroll.appendChild(table);
    container.appendChild(tableScroll);
  });

  if (isAdmin) {
    addButtons();
  }
};

// Muut funktiot (updatePoints, recalculateGroupPoints, jne.) pysyvät lähes samoina, 
// mutta ne on tuotava window-objektiin, jotta ne toimivat HTML:stä.

window.updatePoints = async function (group, rowIndex, colIndex) {
  const resultInput = document.getElementById(`result-${group}-${rowIndex}-${colIndex}`);
  const result = resultInput.value;
  await updateMatchResultWithReverse(group, rowIndex, colIndex, result);
  await recalculateGroupPoints(group);
};

async function updateMatchResultWithReverse(group, rowIndex, colIndex, result) {
  const reverseResult = result === "TBD" ? "TBD" : result.split("-").reverse().join("-");
  await update(ref(db, `Players/${group}/ottelut`), {
    [`${rowIndex}-${colIndex}`]: result,
    [`${colIndex}-${rowIndex}`]: reverseResult
  });
}

async function recalculateGroupPoints(groupKey) {
  const groupRef = ref(db, `Players/${groupKey}`);
  const snapshot = await get(groupRef);
  const groupData = snapshot.val();
  if (!groupData) return;

  const players = Object.keys(groupData).filter(key => key.startsWith("pelaaja"));
  const matches = groupData.ottelut || {};
  const updates = {};

  players.forEach(playerKey => {
    const rowIndex = parseInt(playerKey.replace('pelaaja', '')) - 1;
    let points = 0;

    players.forEach(opponentKey => {
      const opponentIndex = parseInt(opponentKey.replace('pelaaja', '')) - 1;
      if (rowIndex === opponentIndex) return;

      const matchKey = `${rowIndex}-${opponentIndex}`;
      const result = matches[matchKey] || "TBD";
      
      if (result !== "TBD") {
        const [a] = result.split('-').map(Number);
        points += a;
      }
    });
    updates[`Players/${groupKey}/${playerKey}/pisteet`] = points;
  });

  await update(ref(db), updates);
  await updateRankings(groupKey);
  fetchAndDisplayGroups();
}

async function updateRankings(group) {
  const playersRef = ref(db, `Players/${group}`);
  const snapshot = await get(playersRef);
  const groupData = snapshot.val();
  if (!groupData) return;

  const players = Object.keys(groupData)
    .filter(key => key.startsWith("pelaaja"))
    .map(key => ({ ...groupData[key], key: key }));

  players.sort((a, b) => (b.pisteet - a.pisteet) || (a.rating - b.rating));

  const updates = {};
  players.forEach((player, index) => {
    updates[`Players/${group}/${player.key}/sijoitus`] = index + 1;
  });
  await update(ref(db), updates);
}

function addButtons() {
  if (!currentUserData || !isAdmin) {
    return;
  }

  const container = document.getElementById("groups-container");
  const btnDiv = document.createElement("div");
  btnDiv.style.margin = "20px 0";

  const updateRatingsBtn = document.createElement("button");
  updateRatingsBtn.textContent = "Update ratings";
  updateRatingsBtn.onclick = updateRatings;
  updateRatingsBtn.style.marginRight = "10px";

  const updateGroupsBtn = document.createElement("button");
  updateGroupsBtn.textContent = "Generate new groups";
  updateGroupsBtn.onclick = updateGroups;
  updateGroupsBtn.style.marginRight = "10px";

  const restoreBtn = document.createElement("button");
  restoreBtn.textContent = "Restore previous draw";
  restoreBtn.onclick = restoreBackup;
  restoreBtn.style.background = "#e67e22";
  restoreBtn.style.marginRight = "10px";

  const printBtn = document.createElement("button");
  printBtn.textContent = "Print group sheets";
  printBtn.onclick = printGroupSheets;
  printBtn.style.background = "#2c3e50";

  btnDiv.appendChild(updateRatingsBtn);
  btnDiv.appendChild(updateGroupsBtn);
  btnDiv.appendChild(restoreBtn);
  btnDiv.appendChild(printBtn);
  container.appendChild(btnDiv);
}

window.printGroupSheets = async function() {
  const groupsRef = ref(db, "Players");
  const snapshot = await get(groupsRef);
  const data = snapshot.val();
  if (!data) return;

  const months = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
  const currentMonth = months[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  // Käytetään paikallista tiedostoa, jotta se toimii varmasti
  const logoUrl = "logo.png";

  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html>
      <head>
        <title>OPT-86 Printout</title>
        <style>
          @page { size: A4; margin: 0; }
          body { font-family: "Arial Black", Arial, sans-serif; margin: 0; padding: 0; color: #000; }
          .sheet { 
            width: 210mm; 
            height: 297mm; 
            padding: 15mm; 
            box-sizing: border-box; 
            position: relative; 
            page-break-after: always;
            display: flex;
            flex-direction: column;
          }
          @media screen {
            body { background: #e0e0e0; padding: 20px; }
            .sheet { background: white; margin: 0 auto 20px auto; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
          }
          
          .header { 
            display: flex; 
            justify-content: space-between; 
            align-items: center; 
            margin-bottom: 20px; 
            border-bottom: 6px solid #000; 
            padding-bottom: 10px; 
          }
          .title-box h1 { margin: 0; font-size: 38pt; text-transform: uppercase; line-height: 1; }
          .title-box h2 { margin: 5px 0 0 0; font-size: 26pt; text-transform: uppercase; color: #333; }
          
          .logo-box img { height: 130px; width: auto; display: block; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
          th, td { border: 3px solid #000; padding: 10px; text-align: center; font-size: 16pt; }
          th { background: #ddd; text-transform: uppercase; }
          
          .player-table th:nth-child(1) { width: 12%; }
          .player-table th:nth-child(2) { width: 63%; text-align: left; padding-left: 20px; }
          .player-table td:nth-child(2) { text-align: left; padding-left: 20px; }
          .player-table th:nth-child(3) { width: 25%; }

          .matches-section {
            flex-grow: 1;
          }
          
          .matches-grid { 
            display: grid; 
            grid-template-columns: 1fr 1fr; 
            gap: 40px; 
          }
          
          .match-table th { background: #000; color: #fff; font-size: 14pt; }
          .match-table td { height: 45px; font-size: 18pt; font-weight: bold; }
          .match-table td:first-child { width: 40%; background: #f0f0f0; }

          .footer { 
            margin-top: auto;
            border-top: 4px solid #000;
            padding-top: 15px;
            text-align: center; 
            font-size: 18pt; 
            font-weight: bold; 
            font-style: italic;
          }
        </style>
      </head>
      <body>
  `);

  const sortedGroupKeys = Object.keys(data).sort();
  
  sortedGroupKeys.forEach((groupKey, index) => {
    const groupData = data[groupKey];
    const players = Object.keys(groupData)
      .filter(key => key.startsWith("pelaaja"))
      .map(key => ({ ...groupData[key], id: key }))
      .sort((a, b) => b.rating - a.rating);

    const groupLetter = groupKey.split(' ')[1] || 'A';
    
    // Generate match pairs (1-2, 1-3, etc.)
    const matchPairs = [];
    for (let i = 1; i <= players.length; i++) {
      for (let j = i + 1; j <= players.length; j++) {
        matchPairs.push(`${i} - ${j}`);
      }
    }

    // Split matches into two columns
    const mid = Math.ceil(matchPairs.length / 2);
    const leftMatches = matchPairs.slice(0, mid);
    const rightMatches = matchPairs.slice(mid);

    printWindow.document.write(`
      <div class="sheet">
        <div class="header">
          <div class="title-box">
            <h1>MONTHLY MATCHES</h1>
            <h2>${currentMonth} ${currentYear}</h2>
          </div>
          <div class="logo-box">
            <img src="${logoUrl}" alt="OPT-86 Logo">
          </div>
        </div>

        <table class="player-table">
          <thead>
            <tr>
              <th>GROUP ${groupLetter}</th>
              <th>NAME</th>
              <th>RATING</th>
            </tr>
          </thead>
          <tbody>
            ${players.map((p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${p.nimi}</td>
                <td>${p.rating}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="matches-section">
          <div class="matches-grid">
            <table class="match-table">
              <thead>
                <tr>
                  <th>MATCH</th>
                  <th>RESULT</th>
                </tr>
              </thead>
              <tbody>
                ${leftMatches.map(m => `<tr><td>${m}</td><td></td></tr>`).join('')}
              </tbody>
            </table>
            <table class="match-table">
              <thead>
                <tr>
                  <th>MATCH</th>
                  <th>RESULT</th>
                </tr>
              </thead>
              <tbody>
                ${rightMatches.map(m => `<tr><td>${m}</td><td></td></tr>`).join('')}
                ${rightMatches.length < leftMatches.length ? '<tr><td>&nbsp;</td><td></td></tr>' : ''}
              </tbody>
            </table>
          </div>
        </div>

        <div class="footer">
          Mark only sets, for example 3-2
        </div>
      </div>
    `);
  });

  printWindow.document.write(`
      </body>
    </html>
  `);
  printWindow.document.close();
  
  // Odota että kuvat latautuvat ennen tulostusta
  setTimeout(() => {
    printWindow.print();
  }, 1000);
};

// UUDEN PELAAJAN LISÄYS MUOKKAUSTILASSA
window.addPlayerToEditMode = async function() {
  const nameInput = document.getElementById("new-player-name");
  const name = nameInput.value.trim();
  if (!name) return;

  let rating = 0;
  try {
    const res = await fetch("/api/get-ratings");
    const ratings = await res.json();
    const found = ratings.find(p => p.nimi.toLowerCase() === name.toLowerCase());
    if (found) rating = found.rating;
  } catch (e) {
    console.warn("Could not fetch the rating automatically.");
  }

  if (rating === 0) {
    const manualRating = prompt(`Player "${name}" was not found in SPTL. Enter the rating manually:`, "0");
    rating = parseInt(manualRating) || 0;
  }

  // Etsi viimeinen ryhmä
  const lists = document.querySelectorAll(".drag-list");
  const lastList = lists[lists.length - 1];
  
  if (lastList) {
    const li = document.createElement("li");
    li.setAttribute("data-name", name);
    li.setAttribute("data-rating", rating);
    li.style.cssText = "background:white; margin:5px 0; padding:10px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); cursor:move; display:flex; justify-content:space-between;";
    li.innerHTML = `
      <span>${name}</span>
      <div style="display:flex; align-items:center; gap:10px;">
        <span style="color:#7f8c8d; font-size:0.8em;">${rating}</span>
        <button onclick="this.closest('li').remove()" style="background:none; color:#e74c3c; padding:0; border:none; cursor:pointer;">❌</button>
      </div>
    `;

    // Lisää oikeaan väliin ratingin mukaan (laskeva järjestys)
    const existingItems = Array.from(lastList.querySelectorAll("li"));
    const insertBefore = existingItems.find(item => parseInt(item.getAttribute("data-rating")) < rating);
    
    if (insertBefore) {
      lastList.insertBefore(li, insertBefore);
    } else {
      lastList.appendChild(li);
    }
    
    nameInput.value = "";
  }
};

// UUDEN RYHMÄN LISÄYS MUOKKAUSTILASSA
window.addNewGroupToEditMode = function() {
  const currentGroups = document.querySelectorAll(".drag-list").length;
  const nextLetter = String.fromCharCode(65 + currentGroups); // A, B, C...
  const groupKey = `Ryhmä ${nextLetter}`;
  
  const container = document.getElementById("edit-lists-container");
  const groupDiv = document.createElement("div");
  groupDiv.style.cssText = "flex: 1; min-width: 200px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 2px dashed #bdc3c7;";
  
  groupDiv.innerHTML = `<h3 style="margin-top:0; color:#2c3e50;">${groupKey.replace("Ryhmä", "Group")}</h3>
    <ul id="list-${groupKey}" class="drag-list" style="list-style:none; padding:0; min-height:100px;"></ul>`;
  
  container.appendChild(groupDiv);

  new Sortable(document.getElementById(`list-${groupKey}`), {
    group: 'shared-groups',
    animation: 150,
    ghostClass: 'blue-background-class'
  });
};

// YLLÄPITÄJIEN LISÄYS MUOKKAUSTILASSA
window.addAdminToEditMode = function() {
  const input = document.getElementById("new-admin-name");
  const name = input.value.trim().toLowerCase().replace(/\s+/g, '');
  if (!name) return;

  const list = document.getElementById("admin-list");
  // Tarkista onko jo listalla
  if (list.querySelector(`li[data-admin="${name}"]`)) {
    alert("This administrator is already on the list.");
    return;
  }

  const li = document.createElement("li");
  li.setAttribute("data-admin", name);
  li.style.cssText = "background:white; padding:5px 12px; border-radius:20px; border:1px solid #3498db; display:flex; align-items:center; gap:8px;";
  li.innerHTML = `${name} <button onclick="this.closest('li').remove()" style="background:none; color:#e74c3c; padding:0; border:none; cursor:pointer; font-weight:bold;">×</button>`;
  list.appendChild(li);
  input.value = "";
};

// VARMUUSKOPIOINTI JA PALAUTUS
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

async function backupCurrentGroups() {
  const snapshot = await get(ref(db, "Players"));
  const data = snapshot.val();
  if (data) {
    await set(ref(db, "Backup/Players"), data);
  }
}

window.restoreBackup = async function() {
  if (!confirm("Are you sure you want to restore the previous group draw and results?")) return;
  
  try {
    const snapshot = await get(ref(db, "Backup/Players"));
    let data = snapshot.val();
    
    if (!data) {
      console.log("No backup found, using the original data.");
      data = initialData;
    }
    
    await set(ref(db, "Players"), data);
    alert("Restored successfully!");
    location.reload();
  } catch (e) {
    alert("Error during restore: " + e.message);
  }
};

// SPTL RATING UPDATE
window.updateRatings = async function (event) {
    // Jos kutsutaan napista, event on olemassa. Jos koodista, se voi olla null.
    const btn = event?.target || document.querySelector('button[onclick="updateRatings"]');
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Fetching...";
    }

    try {
        console.log("Fetching ratings from the API...");
        const res = await fetch("/api/get-ratings");
        
        // Lue vastaus ensin tekstinä vianetsintää varten
        const text = await res.text();
        console.log("Server response (raw):", text.substring(0, 200));

        let result;
        try {
            result = JSON.parse(text);
        } catch (parseError) {
            console.error("JSON parsing error:", parseError);
            throw new Error("The server response is not valid JSON data. Check the Vercel logs.");
        }
        
        if (!res.ok) {
            throw new Error(result.error || `The server returned an error ${res.status}`);
        }

        if (!Array.isArray(result)) {
            console.error("Response is not an array:", result);
            throw new Error("The rating data is not in the correct format. Check the Netlify logs.");
        }

        const ratings = result;
        const lookup = ratings.reduce((acc, p) => {
            if (p?.nimi) acc[p.nimi.trim().toLowerCase()] = p.rating;
            return acc;
        }, {});

        const snapshot = await get(ref(db, "Players"));
        const data = snapshot.val();
        if (!data) throw new Error("No players found in the database.");

        const updates = {};
        let updatedCount = 0;

        Object.keys(data).forEach(g => {
            Object.keys(data[g]).forEach(p => {
                if (p.startsWith("pelaaja")) {
                    const name = data[g][p].nimi.trim().toLowerCase();
                    if (lookup[name] !== undefined) {
                        updates[`Players/${g}/${p}/rating`] = lookup[name];
                        updatedCount++;
                    }
                }
            });
        });

        if (updatedCount === 0) {
            alert("Ratings were fetched, but none of the players on the list were found in the SPTL registry. Check the spelling of the names.");
        } else {
            await update(ref(db), updates);
            alert(`Updated ratings for ${updatedCount} players!`);
            location.reload();
        }
    } catch (e) {
        alert("Error: " + e.message);
        console.error("Rating update error:", e);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "Update ratings";
        }
    }
};

// PELAAJAN POISTO (POISTETTU DASHBOARDILTA, KÄYTETÄÄN VAIN MUOKKAUSTILASSA)
window.deletePlayer = async function(groupKey, playerId) {
  // Tämä funktio on nyt tyhjä, koska poistot tehdään muokkaustilassa
};

// RYHMIEN GENERONTILOGIIKKA (PARANNETTU + MANUAALINEN MUOKKAUS)
window.updateGroups = async function () {
  const moveCountStr = prompt("How many players move up and down? (0, 1 or 2):", "2");
  const moveCount = parseInt(moveCountStr);
  
  if (isNaN(moveCount) || (moveCount < 0 || moveCount > 2)) {
    alert("Choose 0, 1 or 2.");
    return;
  }

  if (!confirm(`Start generating new groups (${moveCount} players move up/down)? This fetches the latest ratings and lets you edit the groups before saving.`)) {
    return;
  }

  try {
    // 1. Hae uusimmat ratingit
    console.log("Fetching the latest ratings...");
    const res = await fetch("/api/get-ratings");
    const latestRatings = await res.json();
    const ratingLookup = latestRatings.reduce((acc, p) => {
      if (p?.nimi) acc[p.nimi.trim().toLowerCase()] = p.rating;
      return acc;
    }, {});

    // 2. Hae kaikki nykyiset pelaajat
    const groupsRef = ref(db, "Players");
    const snapshot = await get(groupsRef);
    const originalData = snapshot.val();
    if (!originalData) {
      // Tyhjä tietokanta (uusi kisa): avataan muokkaustila yhdellä tyhjällä
      // ryhmällä, johon pelaajat lisätään käsin.
      renderEditGroups([{ key: "Ryhmä A", players: [] }]);
      return;
    }

    let allGroups = [];
    Object.entries(originalData).forEach(([gKey, group]) => {
      const playerKeys = Object.keys(group).filter(k => k.startsWith("pelaaja"));
      const matches = group.ottelut || {};
      
      const players = playerKeys.map(pKey => {
        const p = group[pKey];
        const rowIndex = parseInt(pKey.replace('pelaaja', '')) - 1;
        let pointsWithPenalties = 0;

        playerKeys.forEach(oKey => {
          const opponentIndex = parseInt(oKey.replace('pelaaja', '')) - 1;
          if (rowIndex === opponentIndex) return;
          const result = matches[`${rowIndex}-${opponentIndex}`] || "TBD";
          if (result === "TBD") {
            pointsWithPenalties -= 3;
          } else {
            const [a] = result.split('-').map(Number);
            pointsWithPenalties += a;
          }
        });

        const cleanName = p.nimi.trim().toLowerCase();
        return {
          ...p,
          rating: ratingLookup[cleanName] || p.rating,
          oldPisteet: pointsWithPenalties
        };
      });
      
      players.sort((a, b) => (b.oldPisteet - a.oldPisteet) || (a.rating - b.rating));
      allGroups.push({ key: gKey, players });
    });

    allGroups.sort((a, b) => a.key.localeCompare(b.key));

    // 3. Laske automaattiset siirrot (käyttäjän valitsema määrä)
    let finalPlayerList = [];
    for (let i = 0; i < allGroups.length; i++) {
      const players = allGroups[i].players;
      players.forEach((p, idx) => {
        let move = 0;
        if (moveCount > 0) {
          if (idx < moveCount && i > 0) move = -1; // Nousee
          if (idx >= players.length - moveCount && i < allGroups.length - 1) move = 1; // Laskee
        }
        finalPlayerList.push({ ...p, targetGroupIdx: i + move });
      });
    }

    // 4. Valmistele data muokkaustilaa varten
    const initialGroups = allGroups.map((g, idx) => ({
      key: g.key,
      players: finalPlayerList.filter(p => p.targetGroupIdx === idx).sort((a, b) => b.rating - a.rating)
    }));

    renderEditGroups(initialGroups);
  } catch (error) {
    console.error("Error while preparing groups:", error);
    alert("Error: " + error.message);
  }
};

async function renderEditGroups(groups) {
  const container = document.getElementById("edit-lists-container");
  container.innerHTML = "";
  
  // Lisää ylläpitäjien hallintaosio
  const adminSnapshot = await get(ref(db, "Config/Admins"));
  const currentAdmins = adminSnapshot.val() || ["kyöstialaruikka", "lassevimpari"];
  
  const adminSection = document.createElement("div");
  adminSection.style.cssText = "width: 100%; background: #ecf0f1; padding: 20px; border-radius: 10px; margin-bottom: 30px; border: 1px solid #bdc3c7;";
  adminSection.innerHTML = `
    <h3 style="margin-top:0;">Administrator management</h3>
    <p style="font-size:0.9em; color:#7f8c8d;">Add new administrators by typing their name (lowercase, without spaces).</p>
    <div style="display:flex; gap:10px; margin-bottom:15px;">
      <input type="text" id="new-admin-name" placeholder="e.g. john-doe" style="padding:8px; border-radius:4px; border:1px solid #ccc; flex:1;">
      <button onclick="addAdminToEditMode()" style="background:#3498db;">Add administrator</button>
    </div>
    <ul id="admin-list" style="list-style:none; padding:0; display:flex; flex-wrap:wrap; gap:10px;">
      ${currentAdmins.map(admin => `
        <li data-admin="${admin}" style="background:white; padding:5px 12px; border-radius:20px; border:1px solid #3498db; display:flex; align-items:center; gap:8px;">
          ${admin}
          ${admin !== 'kyöstialaruikka' ? `<button onclick="this.closest('li').remove()" style="background:none; color:#e74c3c; padding:0; border:none; cursor:pointer; font-weight:bold;">×</button>` : ''}
        </li>
      `).join("")}
    </ul>
  `;
  container.appendChild(adminSection);

  groups.forEach(group => {
    const groupDiv = document.createElement("div");
    groupDiv.style.cssText = "flex: 1; min-width: 200px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 2px dashed #bdc3c7;";
    
    groupDiv.innerHTML = `<h3 style="margin-top:0; color:#2c3e50;">${group.key.replace("Ryhmä", "Group")}</h3>
      <ul id="list-${group.key}" class="drag-list" style="list-style:none; padding:0; min-height:100px;">
        ${group.players.map(p => `
          <li data-name="${p.nimi}" data-rating="${p.rating}" style="background:white; margin:5px 0; padding:10px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); cursor:move; display:flex; justify-content:space-between;">
            <span>${p.nimi}</span>
            <div style="display:flex; align-items:center; gap:10px;">
              <span style="color:#7f8c8d; font-size:0.8em;">${p.rating}</span>
              <button onclick="this.closest('li').remove()" style="background:none; color:#e74c3c; padding:0; border:none; cursor:pointer;">❌</button>
            </div>
          </li>
        `).join("")}
      </ul>`;
    
    container.appendChild(groupDiv);

    // Alusta SortableJS tälle listalle
    new Sortable(document.getElementById(`list-${group.key}`), {
      group: 'shared-groups',
      animation: 150,
      ghostClass: 'blue-background-class'
    });
  });

  document.getElementById("edit-groups-mode").classList.remove("hidden");
}

window.cancelGroupEdit = function() {
  if (confirm("Are you sure you want to cancel? Changes will not be saved.")) {
    document.getElementById("edit-groups-mode").classList.add("hidden");
  }
};

window.saveFinalGroups = async function() {
  if (!confirm("Do you want to save these groups and start a new month? This will reset all results.")) {
    return;
  }

  try {
    await backupCurrentGroups(); // Ota varmuuskopio ennen tallennusta
    
    // Tallenna ylläpitäjät
    const adminList = document.getElementById("admin-list");
    if (adminList) {
      const newAdmins = Array.from(adminList.querySelectorAll("li")).map(li => li.getAttribute("data-admin"));
      if (newAdmins.length > 0) {
        await set(ref(db, "Config/Admins"), newAdmins);
      }
    }

    const newGroupsData = {};
    const lists = document.querySelectorAll(".drag-list");
    
    lists.forEach(list => {
      const groupKey = list.id.replace("list-", "");
      const playerItems = list.querySelectorAll("li");
      
      if (playerItems.length === 0) return; // Automaattinen tyhjän ryhmän poisto

      const players = {};
      playerItems.forEach((li, index) => {
        players[`pelaaja${index + 1}`] = {
          nimi: li.getAttribute("data-name"),
          rating: parseInt(li.getAttribute("data-rating")),
          pisteet: 0,
          sijoitus: index + 1
        };
      });

      newGroupsData[groupKey] = {
        ...players,
        ottelut: generateNewMatches(playerItems.length)
      };
    });

    if (Object.keys(newGroupsData).length === 0) {
      alert("Error: No groups to save. Add at least one group and one player.");
      return;
    }

    await set(ref(db, "Players"), newGroupsData);
    alert("New groups saved successfully!");
    location.reload();
  } catch (error) {
    console.error("Error while saving:", error);
    alert("Error: " + error.message);
  }
};

function generateNewMatches(playerCount) {
  const matches = {};
  for (let i = 0; i < playerCount; i++) {
    for (let j = 0; j < playerCount; j++) {
      if (i !== j) matches[`${i}-${j}`] = "TBD";
    }
  }
  return matches;
}

function setMonthlyResultsTitle() {
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const title = document.getElementById("monthlyResultsTitle");
    if (title) title.textContent = `${months[new Date().getMonth()]} Results`;
}

window.onload = async function () {
  setMonthlyResultsTitle();
  const authed = await checkUserPermissions();
  
  const isDashboard = window.location.pathname.endsWith("dashboard.html");
  
  if (isDashboard) {
    if (!authed) {
      window.location.href = "index.html";
    } else {
      fetchAndDisplayGroups();
    }
  }
};
// Vercel trigger
