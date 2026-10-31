import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getDatabase, ref, get, set, update, connectDatabaseEmulator } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously, onAuthStateChanged, signOut, sendPasswordResetEmail, connectAuthEmulator } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { initChat, chatButton, setGroups, openChatFromUrl, chatBeforeLogout, proposeMatch } from './chat.js';
import { ratingChange, formatChange } from './lib/rating.js';

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

// Paikallinen testaus Firebase-emulaattoreilla (npm run emulators): vain osoitteessa
// 127.0.0.1, kun sivu on avattu kerran parametrilla ?emulator=1. Ei vaikuta julkaistuun sivustoon.
if (location.hostname === "127.0.0.1") {
    if (new URLSearchParams(location.search).has("emulator")) localStorage.setItem("useEmulators", "1");
    if (localStorage.getItem("useEmulators") === "1") {
        connectDatabaseEmulator(db, "127.0.0.1", 9000);
        connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    }
}

// Nimen vertailuavain: pienet kirjaimet, ylimääräiset välilyönnit pois ja
// sanat aakkosjärjestykseen -> "Lasse Vimpari" ja "Vimpari Lasse" = sama nimi.
function normalizeNameKey(name) {
    return (name || "").trim().toLowerCase().replace(/\s+/g, " ").split(" ").sort().join(" ");
}

// NameIndex-avain: normalisoitu nimi ilman merkkejä, joita Firebase ei salli avaimissa.
// Sama avain tallennetaan käyttäjälle (Users/{uid}/nameKey) ja ryhmän pelaajalle
// (Players/{ryhmä}/pelaajaN/nameKey); tietokannan säännöt tunnistavat pelaajan sen kautta.
function nameKeyFor(name) {
    return normalizeNameKey(name).replace(/[.#$\[\]\/]/g, "_");
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => (
        { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
}

// Varaa nimen käyttäjälle: Users-tietue ja NameIndex kirjoitetaan yhdellä
// päivityksellä. Säännöt hylkäävät varauksen, jos nimi on jo jonkun muun.
async function claimName(uid, name) {
    const nameKey = nameKeyFor(name);
    const taken = await get(ref(db, `NameIndex/${nameKey}`));
    if (taken.exists() && taken.val() !== uid) return false;
    try {
        await update(ref(db), {
            [`Users/${uid}`]: { nimi: name, nameKey, rooli: "pelaaja" },
            [`NameIndex/${nameKey}`]: uid
        });
        return true;
    } catch (e) {
        console.error("Name claim failed:", e);
        return false;
    }
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

        // Nimi varataan vasta tunnuksen luonnin jälkeen, koska tietokannan
        // säännöt sallivat sen vain kirjautuneelle. Jos nimi on jo jonkun
        // muun (vertailu: pienet kirjaimet, välilyönnit ja sanajärjestys eivät
        // merkitse), juuri luotu tunnus poistetaan.
        if (!(await claimName(user.uid, name))) {
            await user.delete();
            alert("This name is already in use by another user. Choose a different name or contact the administrator.");
            return;
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
    await chatBeforeLogout();
    await signOut(auth);
    window.location.href = "index.html";
};

// DASHBOARD LOGIC
let currentUserData = null;
let isAdmin = false;
let noAdminsYet = false;

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

                    // Nimi puuttuu (esim. ylläpitäjä vapautti nimen): pyydä varaamaan nimi.
                    // Nimeä ei voi itse vaihtaa jälkikäteen – sen korjaa ylläpitäjä.
                    if (!currentUserData) {
                        const uusiNimi = prompt("Your player name is missing. Enter your name in the form 'Lastname Firstname':");
                        if (uusiNimi && uusiNimi.trim()) {
                            if (await claimName(user.uid, uusiNimi.trim())) {
                                const snapshot2 = await get(ref(db, `Users/${user.uid}`));
                                currentUserData = snapshot2.val();
                            } else {
                                alert("This name is already in use by another user. Contact the administrator.");
                            }
                        }
                        if (!currentUserData) currentUserData = { rooli: "pelaaja", nimi: "Unknown" };
                    }

                    // Ylläpito-oikeus on sidottu käyttäjätunnukseen (uid), ei nimeen
                    const adminSnapshot = await get(ref(db, "Config/AdminUids"));
                    const adminUids = adminSnapshot.val() || {};
                    isAdmin = adminUids[user.uid] === true;
                    noAdminsYet = Object.keys(adminUids).length === 0;
                }
                resolve(true);
            } else {
                resolve(false);
            }
        });
    });
}

// Ottelun tulos solusta rivi -> sarake ("TBD" jos ei pelattu)
function matchResultFor(groupData, rowIndex, colIndex) {
  return (groupData.ottelut && groupData.ottelut[`${rowIndex}-${colIndex}`]) || "TBD";
}

// Ryhmän pelaajat järjestyksessä pelaaja1, pelaaja2, ... Indeksi (idx) vastaa
// ottelut-avaimen numeroa: pelaajaN <-> N-1.
function groupPlayers(groupData) {
  return Object.keys(groupData)
    .filter(key => /^pelaaja\d+$/.test(key))
    .map(key => ({ ...groupData[key], id: key, idx: parseInt(key.slice(7)) - 1 }))
    .sort((a, b) => a.idx - b.idx);
}

// Pisteet ja sijoitukset lasketaan näytettäessä ottelutuloksista; niitä ei tallenneta.
function computeStandings(groupData, players) {
  const points = {};
  players.forEach(p => {
    points[p.idx] = 0;
    players.forEach(o => {
      if (o.idx === p.idx) return;
      const result = matchResultFor(groupData, p.idx, o.idx);
      if (result !== "TBD") points[p.idx] += Number(result.split("-")[0]);
    });
  });
  const ranked = [...players].sort((a, b) => (points[b.idx] - points[a.idx]) || (a.rating - b.rating));
  const ranks = {};
  ranked.forEach((p, i) => { ranks[p.idx] = i + 1; });
  return { points, ranks };
}

const RESULT_OPTIONS = ["TBD", "3-2", "3-1", "3-0", "0-3", "1-3", "2-3"];

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

  // Kirjautuneen pelaajan nimi (nimen vaihtaa ylläpitäjä)
  if (currentUserData && currentUserData.rooli !== "vierailija") {
    const nameLabel = document.createElement("span");
    nameLabel.textContent = `Signed in: ${currentUserData.nimi || "Unknown"}`;
    nameLabel.title = "Contact the administrator to change your name.";
    nameLabel.style.cssText = "float:right; padding:10px; color:#2c3e50; font-weight:bold;";
    container.appendChild(nameLabel);
  }

  // Ensimmäisen ylläpitäjän asetus: näytä oma uid, jonka voi lisätä Firebase Consolessa
  if (noAdminsYet && auth.currentUser && !auth.currentUser.isAnonymous) {
    const info = document.createElement("p");
    info.style.cssText = "clear:both; background:#fff3cd; padding:10px; border-radius:6px;";
    info.textContent = `No administrators yet. Your user ID is ${auth.currentUser.uid} – add it in the Firebase Console as Config/AdminUids/${auth.currentUser.uid} = true.`;
    container.appendChild(info);
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

  const isVisitor = !currentUserData || currentUserData.rooli === "vierailija";
  const myKey = isVisitor ? null : currentUserData.nameKey;
  setGroups(data);

  Object.keys(data).sort().forEach(groupKey => {
    const groupData = data[groupKey];
    const players = groupPlayers(groupData);
    const { points, ranks } = computeStandings(groupData, players);

    const groupTitle = document.createElement("h2");
    groupTitle.className = "group-title";
    groupTitle.textContent = groupKey.replace("Ryhmä", "Group");
    container.appendChild(groupTitle);

    // Ryhmän oma chat pelien sopimiseen (vain ryhmän pelaajille ja ylläpitäjille)
    const chatBtn = chatButton(groupKey, groupData);
    if (chatBtn) container.appendChild(chatBtn);

    const table = document.createElement("table");
    const headerRow = document.createElement("tr");
    headerRow.innerHTML = `<th>Name</th>` +
      players.map(p => `<th>${escapeHtml(p.nimi)}</th>`).join("") +
      `<th>Points</th><th>Position</th><th>Rating</th>`;
    table.appendChild(headerRow);

    players.forEach(player => {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      nameCell.textContent = player.nimi;
      row.appendChild(nameCell);

      players.forEach(opponent => {
        const cell = document.createElement("td");
        row.appendChild(cell);
        // Ottelu itseään vastaan: musta neliö
        if (player.idx === opponent.idx) {
          // Tulosvalikon kokoinen ja samassa kohdassa: sama elementti mustana, ei valittavissa
          const box = document.createElement("select");
          box.className = "self-match-box";
          box.disabled = true;
          box.tabIndex = -1;
          box.setAttribute("aria-hidden", "true");
          RESULT_OPTIONS.forEach(value => box.appendChild(new Option(value)));
          cell.appendChild(box);
          return;
        }
        const matchResult = matchResultFor(groupData, player.idx, opponent.idx);

        // Muokkausoikeus: ylläpitäjä tai jompikumpi pelaajista (tietokannan
        // säännöt tarkistavat saman nimi-indeksin kautta)
        const isMyMatch = !!myKey && (player.nameKey === myKey || opponent.nameKey === myKey);
        const canEdit = isAdmin || isMyMatch;

        // Värit tuloksille: voitto #a5d6a7, häviö #ef9a9a
        const select = document.createElement("select");
        if (matchResult !== "TBD") {
          const [a, b] = matchResult.split('-').map(Number);
          if (a !== b) {
            select.style.backgroundColor = a > b ? "#a5d6a7" : "#ef9a9a";
            select.style.color = "#ffffff";
            select.style.fontWeight = "bold";
          }
        }
        RESULT_OPTIONS.forEach(value => {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = value;
          option.style.cssText = "color: black; background-color: white;";
          option.selected = value === matchResult;
          select.appendChild(option);
        });
        select.disabled = !canEdit;
        select.onchange = () => updatePoints(groupKey, player.idx, opponent.idx, select.value);
        cell.appendChild(select);

        // Oma pelaamaton ottelu: 💬 ehdottaa peliaikaa ryhmän chatissa (vain omalla rivillä)
        if (matchResult === "TBD" && player.nameKey === myKey) {
          const proposeBtn = document.createElement("button");
          proposeBtn.type = "button";
          proposeBtn.className = "propose-btn";
          proposeBtn.textContent = "💬";
          proposeBtn.title = `Propose a match time to ${opponent.nimi}`;
          proposeBtn.setAttribute("aria-label", proposeBtn.title);
          proposeBtn.onclick = () => proposeMatch(groupKey, opponent.nimi);
          cell.appendChild(proposeBtn);
        }
      });

      // Määritä sijoituksen väri
      let rankStyle = "background-color: #fff9c4; color: black; font-weight: bold; border-radius: 4px; padding: 2px 8px;";
      const rank = ranks[player.idx];
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

      row.insertAdjacentHTML("beforeend", `
        <td style="text-align: center;">${points[player.idx]}</td>
        <td style="text-align: center;"><span style="${rankStyle}">${rank}</span></td>
        <td style="text-align: center;">${escapeHtml(player.rating)}${ratingChangeHtml(player, players, groupData.ottelut)}</td>`);
      table.appendChild(row);
    });

    const tableScroll = document.createElement("div");
    tableScroll.className = "table-scroll";
    tableScroll.appendChild(table);
    container.appendChild(tableScroll);
  });

  const ratingNote = document.createElement("p");
  ratingNote.className = "rating-note";
  ratingNote.textContent = "The number under a rating is the estimated rating change from this month's group matches " +
    "(SPTL rating formula, +1 bonus point per win). Official ratings are calculated by SPTL.";
  container.appendChild(ratingNote);

  if (isAdmin) {
    addButtons();
  }
};

// Laskennallinen rating-muutos ryhmän pelatuista otteluista (SPTL:n kaavat, lib/rating.js)
// varsinaisen ratingin alle; ei tallenneta eikä muuta varsinaista ratingia.
function ratingChangeHtml(player, players, ottelut) {
  const change = ratingChange(player, players, ottelut);
  if (!change) return "";
  if (!change.matches) {
    return `<div class="rating-change" title="No rating for this player or the opponents – change cannot be calculated">?</div>`;
  }
  const cls = Math.round(change.total) > 0 ? "up" : Math.round(change.total) < 0 ? "down" : "";
  const title = `Estimated rating change from ${change.matches} group match${change.matches === 1 ? "" : "es"} ` +
    `(${change.wins} W, ${change.losses} L): ${change.base >= 0 ? "+" : ""}${change.base.toFixed(1)} rating` +
    ` + ${change.bonus} bonus. SPTL formula; the official rating is calculated by SPTL.` +
    (change.skipped ? ` ${change.skipped} match(es) without a rating not counted.` : "");
  return `<div class="rating-change ${cls}" title="${escapeHtml(title)}">${formatChange(change.total)}</div>`;
}

// Tallentaa ottelutuloksen molempiin suuntiin. Pisteet ja sijoitukset
// lasketaan näytettäessä, joten muuta ei kirjoiteta.
window.updatePoints = async function (group, rowIndex, colIndex, result) {
  const reverseResult = result === "TBD" ? "TBD" : result.split("-").reverse().join("-");
  try {
    await update(ref(db, `Players/${group}/ottelut`), {
      [`${rowIndex}-${colIndex}`]: result,
      [`${colIndex}-${rowIndex}`]: reverseResult
    });
  } catch (error) {
    alert("Could not save the result: " + error.message);
  }
  fetchAndDisplayGroups();
};

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
  printBtn.style.marginRight = "10px";

  const usersBtn = document.createElement("button");
  usersBtn.textContent = "Manage users";
  usersBtn.onclick = openUserManagement;
  usersBtn.style.background = "#8e44ad";
  usersBtn.style.marginRight = "10px";

  btnDiv.appendChild(updateRatingsBtn);
  btnDiv.appendChild(updateGroupsBtn);
  btnDiv.appendChild(restoreBtn);
  btnDiv.appendChild(printBtn);
  btnDiv.appendChild(usersBtn);

  const migrateBtn = document.createElement("button");
  migrateBtn.textContent = "Run data migration";
  migrateBtn.onclick = runDataMigration;
  migrateBtn.style.background = "#c0392b";
  migrateBtn.style.display = "none";
  btnDiv.appendChild(migrateBtn);
  // Näytetään vain, jos kertaluontoista siirtoa uuteen tietomalliin ei ole vielä tehty
  get(ref(db, "Config/MigratedV2")).then(s => {
    if (s.val() !== true) migrateBtn.style.display = "";
  });

  container.appendChild(btnDiv);
}

// KÄYTTÄJIEN HALLINTA (YLLÄPITÄJÄ): nimen korjaus, nimen vapautus ja ylläpito-oikeus
window.openUserManagement = async function () {
  const [usersSnap, adminSnap] = await Promise.all([
    get(ref(db, "Users")),
    get(ref(db, "Config/AdminUids"))
  ]);
  const users = usersSnap.val() || {};
  const adminUids = adminSnap.val() || {};

  const overlay = document.createElement("div");
  overlay.id = "user-management";
  overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:2000; overflow-y:auto; padding:16px; box-sizing:border-box;";
  const panel = document.createElement("div");
  panel.style.cssText = "background:white; padding:20px; border-radius:8px; max-width:720px; margin:0 auto;";
  panel.innerHTML = `<h3 style="margin-top:0;">Users</h3>
    <p style="font-size:0.9em; color:#7f8c8d;">A player can enter results for matches where the group list name matches their own name.
    "Release" removes the user's name so that they choose it again at their next sign-in.</p>`;

  const table = document.createElement("table");
  table.innerHTML = "<tr><th>Name</th><th>Admin</th><th></th></tr>";
  Object.entries(users)
    .sort(([, a], [, b]) => (a?.nimi || "").localeCompare(b?.nimi || ""))
    .forEach(([uid, u]) => {
      const row = document.createElement("tr");

      const nameCell = document.createElement("td");
      nameCell.textContent = u?.nimi || "(no name)";
      if (!u?.nameKey) nameCell.textContent += " (not migrated)";
      row.appendChild(nameCell);

      const adminCell = document.createElement("td");
      const adminBox = document.createElement("input");
      adminBox.type = "checkbox";
      adminBox.checked = adminUids[uid] === true;
      // Omaa ylläpito-oikeutta ei voi poistaa, ettei kukaan lukitse itseään ulos
      adminBox.disabled = uid === auth.currentUser.uid;
      adminBox.onchange = async () => {
        try {
          await set(ref(db, `Config/AdminUids/${uid}`), adminBox.checked ? true : null);
        } catch (e) {
          alert("Error: " + e.message);
          adminBox.checked = !adminBox.checked;
        }
      };
      adminCell.appendChild(adminBox);
      row.appendChild(adminCell);

      const actionCell = document.createElement("td");
      const renameBtn = document.createElement("button");
      renameBtn.textContent = "Rename";
      renameBtn.style.marginRight = "6px";
      renameBtn.onclick = () => adminRenameUser(uid, u);
      const releaseBtn = document.createElement("button");
      releaseBtn.textContent = "Release";
      releaseBtn.style.background = "#e67e22";
      releaseBtn.onclick = () => adminReleaseUser(uid, u);
      actionCell.appendChild(renameBtn);
      actionCell.appendChild(releaseBtn);
      row.appendChild(actionCell);

      table.appendChild(row);
    });
  panel.appendChild(table);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.cssText = "margin-top:15px; background:#95a5a6;";
  closeBtn.onclick = () => { overlay.remove(); location.reload(); };
  panel.appendChild(closeBtn);

  overlay.appendChild(panel);
  document.body.appendChild(overlay);
};

async function adminRenameUser(uid, u) {
  const newName = (prompt("New name in the form 'Lastname Firstname':", u?.nimi || "") || "").trim();
  if (!newName) return;
  const newKey = nameKeyFor(newName);
  const taken = await get(ref(db, `NameIndex/${newKey}`));
  if (taken.exists() && taken.val() !== uid) {
    alert("This name is already in use by another user.");
    return;
  }
  const updates = {
    [`Users/${uid}/nimi`]: newName,
    [`Users/${uid}/nameKey`]: newKey,
    [`NameIndex/${newKey}`]: uid
  };
  if (u?.nameKey && u.nameKey !== newKey) updates[`NameIndex/${u.nameKey}`] = null;
  try {
    await update(ref(db), updates);
    document.getElementById("user-management").remove();
    openUserManagement();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

async function adminReleaseUser(uid, u) {
  if (uid === auth.currentUser.uid) {
    alert("You cannot release your own name.");
    return;
  }
  if (!confirm(`Release the name "${u?.nimi || ""}"? The user will be asked for a name at the next sign-in.`)) return;
  const updates = { [`Users/${uid}`]: null };
  if (u?.nameKey) updates[`NameIndex/${u.nameKey}`] = null;
  try {
    await update(ref(db), updates);
    document.getElementById("user-management").remove();
    openUserManagement();
  } catch (e) {
    alert("Error: " + e.message);
  }
}

// KERTALUONTOINEN SIIRTO UUTEEN TIETOMALLIIN (ylläpitäjä ajaa kerran julkaisun jälkeen):
// - käyttäjille nimiavain ja NameIndex, email-kenttä pois
// - ryhmien pelaajille nimiavain, vanhat pisteet/sijoitukset pois
// - vanhat nimipohjaiset ylläpitäjät (Config/Admins) uid-pohjaisiksi
window.runDataMigration = async function () {
  if (!confirm("Run the one-time data migration now?")) return;
  try {
    const [usersSnap, playersSnap, adminsSnap, indexSnap] = await Promise.all([
      get(ref(db, "Users")), get(ref(db, "Players")),
      get(ref(db, "Config/Admins")), get(ref(db, "NameIndex"))
    ]);
    const users = usersSnap.val() || {};
    const index = indexSnap.val() || {};
    const oldAdmins = Object.values(adminsSnap.val() || {}).map(a => String(a).toLowerCase());
    const updates = {};
    const conflicts = [];

    Object.entries(users).forEach(([uid, u]) => {
      if (!u) return;
      updates[`Users/${uid}/email`] = null;
      if (u.nimi && !u.nameKey) {
        const key = nameKeyFor(u.nimi);
        if (index[key] && index[key] !== uid) {
          conflicts.push(u.nimi);
          return;
        }
        index[key] = uid;
        updates[`Users/${uid}/nameKey`] = key;
        updates[`NameIndex/${key}`] = uid;
      }
      // Vanha ylläpitäjälista oli nimiä ilman välilyöntejä, esim. "kyöstialaruikka"
      const compact = (u.nimi || "").replace(/\s+/g, "").toLowerCase();
      const reversed = (u.nimi || "").trim().split(/\s+/).reverse().join("").toLowerCase();
      if (oldAdmins.includes(compact) || oldAdmins.includes(reversed)) {
        updates[`Config/AdminUids/${uid}`] = true;
      }
    });

    Object.entries(playersSnap.val() || {}).forEach(([g, group]) => {
      Object.entries(group || {}).forEach(([p, player]) => {
        if (!/^pelaaja\d+$/.test(p) || !player) return;
        updates[`Players/${g}/${p}/nameKey`] = nameKeyFor(player.nimi);
        updates[`Players/${g}/${p}/pisteet`] = null;
        updates[`Players/${g}/${p}/sijoitus`] = null;
      });
    });

    updates["Config/Admins"] = null;
    updates["Config/MigratedV2"] = true;
    await update(ref(db), updates);
    alert("Migration completed." + (conflicts.length ? `\nDuplicate names, fix these in "Manage users": ${conflicts.join(", ")}` : ""));
    location.reload();
  } catch (e) {
    alert("Migration error: " + e.message);
  }
};

window.printGroupSheets = async function() {
  const groupsRef = ref(db, "Players");
  const snapshot = await get(groupsRef);
  const data = snapshot.val();
  if (!data) return;

  // Käytetään paikallista tiedostoa, jotta se toimii varmasti
  const logoUrl = "logo.png";
  // Linkki web-sovellukseen, jossa tulokset voi syöttää itse
  const appUrl = `${location.origin}/`;

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
            padding: 12mm; 
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
            margin-bottom: 12px; 
            border-bottom: 4px solid #000; 
            padding-bottom: 6px; 
          }
          .title-box h1 { margin: 0; font-size: 28pt; text-transform: uppercase; line-height: 1; }
          
          .logo-box img { height: 80px; width: auto; display: block; }

          table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
          th, td { border: 2px solid #000; padding: 5px; text-align: center; font-size: 12pt; }
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
            gap: 24px; 
          }
          
          .match-table th { background: #000; color: #fff; font-size: 11pt; }
          .match-table td { height: 26px; font-size: 13pt; font-weight: bold; }
          .match-table td:first-child { width: 40%; background: #f0f0f0; }

          .footer { 
            margin-top: auto;
            border-top: 3px solid #000;
            padding-top: 8px;
            text-align: center; 
            font-size: 13pt; 
            font-weight: bold; 
            font-style: italic;
          }
          .web-app { margin-top: 4px; font-size: 0.75em; font-style: normal; }
          .web-app a { color: #000; }
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
            <h1>SENIOR GAMES</h1>
          </div>
          <div class="logo-box">
            <img src="${logoUrl}" alt="OPT-86 Logo">
          </div>
        </div>

        <table class="player-table">
          <thead>
            <tr>
              <th>GROUP ${escapeHtml(groupLetter)}</th>
              <th>NAME</th>
              <th>RATING</th>
            </tr>
          </thead>
          <tbody>
            ${players.map((p, i) => `
              <tr>
                <td>${i + 1}</td>
                <td>${escapeHtml(p.nimi)}</td>
                <td>${escapeHtml(p.rating)}</td>
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
          <div class="web-app">You can also enter your results into the web app: <a href="${appUrl}">${location.origin}</a></div>
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

// Muokkaustilan pelaajarivi (nimi lisätään tekstinä, ei HTML:nä)
function createEditListItem(name, rating) {
  const li = document.createElement("li");
  li.setAttribute("data-name", name);
  li.setAttribute("data-rating", rating);
  li.style.cssText = "background:white; margin:5px 0; padding:10px; border-radius:4px; box-shadow:0 1px 3px rgba(0,0,0,0.1); cursor:move; display:flex; justify-content:space-between;";
  li.innerHTML = `
    <span class="edit-name"></span>
    <div style="display:flex; align-items:center; gap:10px;">
      <span style="color:#7f8c8d; font-size:0.8em;">${escapeHtml(rating)}</span>
      <button onclick="this.closest('li').remove()" style="background:none; color:#e74c3c; padding:0; border:none; cursor:pointer;">❌</button>
    </div>
  `;
  li.querySelector(".edit-name").textContent = name;
  return li;
}

// Muokkaustilan ryhmälaatikko
function createEditGroup(groupKey) {
  const groupDiv = document.createElement("div");
  groupDiv.style.cssText = "flex: 1; min-width: 200px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 2px dashed #bdc3c7;";
  const title = document.createElement("h3");
  title.style.cssText = "margin-top:0; color:#2c3e50;";
  title.textContent = groupKey.replace("Ryhmä", "Group");
  const list = document.createElement("ul");
  list.id = `list-${groupKey}`;
  list.className = "drag-list";
  list.style.cssText = "list-style:none; padding:0; min-height:100px;";
  groupDiv.appendChild(title);
  groupDiv.appendChild(list);
  return { groupDiv, list };
}

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
    const li = createEditListItem(name, rating);

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
  const { groupDiv, list } = createEditGroup(`Ryhmä ${nextLetter}`);
  document.getElementById("edit-lists-container").appendChild(groupDiv);

  new Sortable(list, {
    group: 'shared-groups',
    animation: 150,
    ghostClass: 'blue-background-class'
  });
};

// VARMUUSKOPIOINTI JA PALAUTUS
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
      alert("No backup found.");
      return;
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

// Siirtyjien määrän valinta alasvetovalikosta (oletus 1).
// Palauttaa valitun luvun, tai null jos käyttäjä peruu.
function chooseMoveCount() {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.id = "move-count-dialog";
    overlay.style.cssText = "position:fixed; inset:0; background:rgba(0,0,0,0.6); z-index:2000; display:flex; align-items:center; justify-content:center; padding:16px; box-sizing:border-box;";
    overlay.innerHTML = `
      <div style="background:white; padding:20px; border-radius:8px; max-width:360px; width:100%; box-sizing:border-box;">
        <h3 style="margin-top:0;">Generate new groups</h3>
        <label for="move-count-select" style="display:block; margin-bottom:8px; font-weight:bold;">Players moving up and down:</label>
        <select id="move-count-select" style="width:100%; padding:8px; font-size:16px; margin-bottom:12px;">
          <option value="0">0</option>
          <option value="1" selected>1</option>
          <option value="2">2</option>
          <option value="3">3</option>
        </select>
        <p style="font-size:0.9em; color:#7f8c8d;">This fetches the latest ratings and lets you edit the groups before saving.</p>
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button type="button" id="move-count-cancel" style="background:#95a5a6;">Cancel</button>
          <button type="button" id="move-count-ok" style="background:#27ae60;">Start</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const close = (value) => { overlay.remove(); resolve(value); };
    overlay.querySelector("#move-count-ok").onclick = () =>
      close(parseInt(overlay.querySelector("#move-count-select").value));
    overlay.querySelector("#move-count-cancel").onclick = () => close(null);
  });
}

// RYHMIEN GENERONTILOGIIKKA (PARANNETTU + MANUAALINEN MUOKKAUS)
window.updateGroups = async function () {
  const moveCount = await chooseMoveCount();
  if (moveCount === null) return;

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

  groups.forEach(group => {
    const { groupDiv, list } = createEditGroup(group.key);
    group.players.forEach(p => list.appendChild(createEditListItem(p.nimi, p.rating)));
    container.appendChild(groupDiv);

    // Alusta SortableJS tälle listalle
    new Sortable(list, {
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

    const newGroupsData = {};
    const lists = document.querySelectorAll(".drag-list");

    lists.forEach(list => {
      const groupKey = list.id.replace("list-", "");
      const playerItems = list.querySelectorAll("li");

      if (playerItems.length === 0) return; // Automaattinen tyhjän ryhmän poisto

      const players = {};
      playerItems.forEach((li, index) => {
        const nimi = li.getAttribute("data-name");
        players[`pelaaja${index + 1}`] = {
          nimi,
          nameKey: nameKeyFor(nimi),
          rating: parseInt(li.getAttribute("data-rating")) || 0
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

window.onload = async function () {
  const authed = await checkUserPermissions();
  
  const isDashboard = window.location.pathname.endsWith("dashboard.html");
  
  if (isDashboard) {
    if (!authed) {
      window.location.href = "index.html";
    } else {
      initChat({ db, auth, user: () => currentUserData, isAdmin: () => isAdmin });
      await fetchAndDisplayGroups();
      openChatFromUrl();   // ilmoituksen linkki: dashboard.html?chat=<ryhmä>
    }
  }
};
// Vercel trigger
