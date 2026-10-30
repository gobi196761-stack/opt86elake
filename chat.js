// Ryhmächatti ja sen push-ilmoitukset (dashboard). Viestit ovat polussa
// Chats/{kuukausi}/{ryhmä}; kuukauden vaihtuessa chat alkaa tyhjästä ja vanhat
// kuukaudet poistetaan (Vercel Cron /api/chat-cleanup, varalla ylläpitäjän selain).
// Lukemaan ja kirjoittamaan pääsevät vain ryhmän pelaajat (tietokannan säännöt).
import { ref, query, limitToLast, onValue, push, remove, set, get, update, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { monthKey, oldMonths, groupLabel, MAX_MESSAGE_LENGTH, MESSAGES_SHOWN } from './lib/chat-logic.js';
import { t, paikallinen } from './kieli.js';

let ctx = null;                  // { db, auth, user: () => currentUserData, isAdmin: () => bool }
let groups = {};                 // viimeksi näytetyt ryhmät (Players)
const lastMessages = new Map();  // ryhmä -> viimeisin viesti (lukemattomien merkki)
const watchers = new Map();      // ryhmä -> kuuntelijan lopetus
const buttons = new Map();       // ryhmä -> ryhmän Chat-nappi
let openGroup = null;
let stopOpen = null;

const el = id => document.getElementById(id);
const chatPath = group => `Chats/${monthKey()}/${group}`;
const seenKey = group => `chatSeen:${monthKey()}:${group}`;

function readSeen(group) {
  try { return Number(localStorage.getItem(seenKey(group))) || 0; } catch { return 0; }
}

function markSeen(group, time) {
  try { localStorage.setItem(seenKey(group), String(Math.max(time, readSeen(group)))); } catch { /* yksityinen tila */ }
}

function myUid() {
  return ctx.auth.currentUser && !ctx.auth.currentUser.isAnonymous ? ctx.auth.currentUser.uid : null;
}

function myPlayer(groupData) {
  const me = ctx.user();
  const key = me && me.nameKey;
  if (!key) return null;
  return Object.keys(groupData || {})
    .filter(k => /^pelaaja\d+$/.test(k) && groupData[k] && groupData[k].nameKey === key)
    .map(k => ({ ...groupData[k], idx: parseInt(k.slice(7)) - 1 }))[0] || null;
}

// Chat näkyy ryhmän pelaajille ja ylläpitäjille, ei vierailijoille
function canChat(groupData) {
  if (!myUid()) return false;
  return ctx.isAdmin() || !!myPlayer(groupData);
}

export function initChat(context) {
  ctx = context;
  el("chat-close").onclick = closeChat;
  el("chat-send").onclick = sendMessage;
  el("chat-notify-btn").onclick = toggleNotifications;
  el("chat-propose").onchange = proposeTime;
  el("chat-input").maxLength = MAX_MESSAGE_LENGTH;
  el("chat-input").addEventListener("keydown", e => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) sendMessage();
  });
  el("chat-panel").addEventListener("click", e => { if (e.target.id === "chat-panel") closeChat(); });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && openGroup) closeChat(); });

  // Ilmoituksen napautus, kun sovellus on jo auki (sw.js lähettää viestin)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", e => {
      if (e.data && e.data.type === "open-chat") openChatFromUrl(e.data.url);
    });
    navigator.serviceWorker.startMessages();
  }
  if (ctx.isAdmin()) removeOldMonths();
}

// Varalla Vercel Cronille: ylläpitäjän selain poistaa edellisten kuukausien chatit
async function removeOldMonths() {
  try {
    const snap = await get(ref(ctx.db, "Chats"));
    const old = oldMonths(Object.keys(snap.val() || {}), monthKey());
    if (old.length) await update(ref(ctx.db, "Chats"), Object.fromEntries(old.map(k => [k, null])));
  } catch (e) {
    console.warn("Old chat cleanup failed:", e);
  }
}

// Ryhmäkortin Chat-nappi (null, jos käyttäjä ei ole ryhmässä). Kutsutaan jokaisella piirrolla.
export function chatButton(groupKey, groupData) {
  groups[groupKey] = groupData;
  if (!canChat(groupData)) return null;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chat-btn";
  btn.onclick = () => openChat(groupKey);
  buttons.set(groupKey, btn);
  updateButton(groupKey);
  if (!watchers.has(groupKey)) {
    const last = query(ref(ctx.db, chatPath(groupKey)), limitToLast(1));
    watchers.set(groupKey, onValue(last, snap => {
      let message = null;
      snap.forEach(c => { message = c.val(); });
      lastMessages.set(groupKey, message);
      if (openGroup === groupKey && message) markSeen(groupKey, message.aika);
      updateButton(groupKey);
    }, e => console.warn("Chat watcher failed:", e)));
  }
  return btn;
}

function updateButton(groupKey) {
  const btn = buttons.get(groupKey);
  if (!btn) return;
  const last = lastMessages.get(groupKey);
  const unread = !!last && last.uid !== myUid() && last.aika > readSeen(groupKey);
  btn.textContent = unread ? "💬 Chat – new messages" : "💬 Chat";
  btn.classList.toggle("unread", unread);
}

export function setGroups(data) {
  groups = data || {};
}

// ?chat=<ryhmä> (ilmoituksen linkki) avaa ryhmän chatin
export function openChatFromUrl(url = location.href) {
  const group = new URL(url, location.href).searchParams.get("chat");
  if (group && groups[group] && canChat(groups[group])) openChat(group);
}

function openChat(groupKey) {
  if (stopOpen) stopOpen();
  openGroup = groupKey;
  el("chat-title").textContent = `${groupLabel(groupKey)} chat`;
  el("chat-messages").innerHTML = "";
  el("chat-input").value = "";
  fillProposals(groupKey);
  el("chat-panel").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  refreshNotifyButton();

  const recent = query(ref(ctx.db, chatPath(groupKey)), limitToLast(MESSAGES_SHOWN));
  stopOpen = onValue(recent, snap => {
    const messages = [];
    snap.forEach(c => { messages.push({ id: c.key, ...c.val() }); });
    renderMessages(groupKey, messages);
  }, e => {
    el("chat-messages").textContent = "Could not load messages: " + e.message;
  });
}

function closeChat() {
  if (stopOpen) stopOpen();
  stopOpen = null;
  openGroup = null;
  el("chat-panel").classList.add("hidden");
  document.body.style.overflow = "";
  if (new URL(location.href).searchParams.has("chat")) history.replaceState(null, "", "dashboard.html");
}

function formatTime(ms) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(paikallinen, { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Helsinki" });
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? time : `${d.toLocaleDateString(paikallinen, { weekday: "short", day: "numeric", month: "numeric", timeZone: "Europe/Helsinki" })} ${time}`;
}

function renderMessages(groupKey, messages) {
  const list = el("chat-messages");
  list.innerHTML = "";
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "chat-empty";
    empty.textContent = "No messages this month yet. Agree on your match times here – the chat starts fresh every month.";
    list.appendChild(empty);
  }
  messages.forEach(m => {
    const own = m.uid === myUid();
    const item = document.createElement("div");
    item.className = own ? "chat-msg own" : "chat-msg";
    const meta = document.createElement("div");
    meta.className = "chat-meta";
    meta.textContent = `${m.nimi} · ${typeof m.aika === "number" ? formatTime(m.aika) : ""}`;
    if (own || ctx.isAdmin()) {
      const del = document.createElement("button");
      del.type = "button";
      del.className = "chat-delete";
      del.textContent = "✕";
      del.title = "Delete message";
      del.setAttribute("aria-label", "Delete message");
      del.onclick = async () => {
        if (!confirm("Delete this message?")) return;
        try {
          await remove(ref(ctx.db, `${chatPath(groupKey)}/${m.id}`));
        } catch (e) {
          alert("Could not delete the message: " + e.message);
        }
      };
      meta.appendChild(del);
    }
    const text = document.createElement("div");
    text.className = "chat-text";
    text.textContent = m.teksti;
    text.setAttribute("translate", "no"); // käyttäjän viestiä ei käännetä
    item.append(meta, text);
    list.appendChild(item);
  });
  list.scrollTop = list.scrollHeight;
  const newest = messages.length ? messages[messages.length - 1].aika : 0;
  markSeen(groupKey, typeof newest === "number" ? newest : Date.now());
  updateButton(groupKey);
}

// Pikaehdotus: omat pelaamattomat ottelut ryhmässä -> valmis viestipohja
function fillProposals(groupKey) {
  const select = el("chat-propose");
  select.innerHTML = '<option value="">Propose a match time…</option>';
  const groupData = groups[groupKey] || {};
  const me = myPlayer(groupData);
  if (!me) {
    select.classList.add("hidden");
    return;
  }
  const ottelut = groupData.ottelut || {};
  Object.keys(groupData)
    .filter(k => /^pelaaja\d+$/.test(k))
    .map(k => ({ ...groupData[k], idx: parseInt(k.slice(7)) - 1 }))
    .filter(p => p.idx !== me.idx && (ottelut[`${me.idx}-${p.idx}`] || "TBD") === "TBD")
    .sort((a, b) => a.idx - b.idx)
    .forEach(p => {
      const option = document.createElement("option");
      option.value = p.nimi;
      option.textContent = `vs. ${p.nimi}`;
      select.appendChild(option);
    });
  select.classList.toggle("hidden", select.options.length <= 1);
}

function proposeTime() {
  const select = el("chat-propose");
  const opponent = select.value;
  select.value = "";
  if (opponent) fillProposal(opponent);
}

// Ottelutaulukon 💬-nappi omassa pelaamattomassa ottelussa: avaa ryhmän chatin viestipohjalla
export function proposeMatch(groupKey, opponent) {
  if (!groups[groupKey] || !canChat(groups[groupKey])) return;
  openChat(groupKey);
  fillProposal(opponent);
}

function fillProposal(opponent) {
  const me = ctx.user();
  const input = el("chat-input");
  input.value = t(`${me.nimi} – ${opponent}: would ___ at ___ suit you?`);
  input.focus();
  const at = input.value.indexOf("___");
  input.setSelectionRange(at, at + 3);
}

async function sendMessage() {
  const input = el("chat-input");
  const text = input.value.trim();
  const uid = myUid();
  if (!text || !openGroup || !uid) return;
  if (text.length > MAX_MESSAGE_LENGTH) {
    alert(`The message is too long (max ${MAX_MESSAGE_LENGTH} characters).`);
    return;
  }
  const group = openGroup;
  const sendBtn = el("chat-send");
  sendBtn.disabled = true;
  try {
    const msgRef = await push(ref(ctx.db, chatPath(group)), {
      uid, nimi: ctx.user().nimi, teksti: text, aika: serverTimestamp()
    });
    input.value = "";
    notifyGroup(group, msgRef.key);
  } catch (e) {
    alert("Could not send the message: " + e.message);
  } finally {
    sendBtn.disabled = false;
  }
}

// Push-ilmoitus ryhmän muille pelaajille (palvelin tarkistaa lähettäjän ja viestin)
async function notifyGroup(group, messageId) {
  try {
    const token = await ctx.auth.currentUser.getIdToken();
    const res = await fetch("/api/chat-notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ kuukausi: monthKey(), ryhma: group, viesti: messageId })
    });
    if (!res.ok) console.warn("Chat notification failed:", res.status, await res.text());
  } catch (e) {
    console.warn("Chat notification failed:", e);
  }
}

// ---------------------------------------------------------------------------
// Push-ilmoitusten tilaus tälle laitteelle
// ---------------------------------------------------------------------------

const pushSupported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

// Tilauksen tunniste tietokannassa: SHA-256(endpoint) heksana (avaimessa ei saa olla /-merkkejä)
async function subscriptionId(endpoint) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(endpoint));
  return [...new Uint8Array(hash)].slice(0, 16).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function saveSubscription(sub) {
  const uid = myUid();
  if (!uid || !sub) return;
  const json = sub.toJSON();
  await set(ref(ctx.db, `PushSubs/${uid}/${await subscriptionId(json.endpoint)}`), {
    endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, luotu: serverTimestamp()
  });
}

function base64UrlToBytes(value) {
  const padded = (value + "===".slice((value.length + 3) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0));
}

async function refreshNotifyButton() {
  const btn = el("chat-notify-btn");
  if (!pushSupported() && !isIos()) {
    btn.classList.add("hidden");
    return;
  }
  btn.classList.remove("hidden");
  let on = false;
  try {
    // Päällä, kun laitteella on tilaus ja se on tallennettu tämän käyttäjän nimiin
    const sub = await currentSubscription();
    if (sub && Notification.permission === "granted") {
      on = (await get(ref(ctx.db, `PushSubs/${myUid()}/${await subscriptionId(sub.endpoint)}`))).exists();
    }
  } catch (e) {
    console.warn("Push state check failed:", e);
  }
  btn.textContent = on ? "🔔 Notifications on" : "🔕 Notifications off";
  btn.dataset.on = on ? "1" : "";
}

async function toggleNotifications() {
  const btn = el("chat-notify-btn");
  if (isIos() && !isStandalone()) {
    alert("On iPhone, notifications work in the installed app: tap Share → Add to Home Screen, open the app from the Home Screen and turn notifications on there.");
    return;
  }
  if (!pushSupported()) {
    alert("This browser does not support notifications.");
    return;
  }
  btn.disabled = true;
  try {
    if (btn.dataset.on) {
      const sub = await currentSubscription();
      if (sub) {
        await remove(ref(ctx.db, `PushSubs/${myUid()}/${await subscriptionId(sub.endpoint)}`));
        await sub.unsubscribe();
      }
    } else {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        alert("Notifications are blocked. Allow notifications for this site in your browser or phone settings.");
        return;
      }
      const res = await fetch("/api/push-key");
      if (!res.ok) {
        alert("Notifications are not available on the server yet. Try again later.");
        return;
      }
      const { publicKey } = await res.json();
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription() ||
        await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) });
      await saveSubscription(sub);
    }
  } catch (e) {
    alert("Could not change notifications: " + e.message);
  } finally {
    btn.disabled = false;
    refreshNotifyButton();
  }
}

// Uloskirjautuessa tämän laitteen ilmoitukset lopetetaan, ettei seuraava samalla
// laitteella kirjautuva saa edellisen käyttäjän ilmoituksia.
export async function chatBeforeLogout() {
  if (!ctx) return;
  try {
    const uid = myUid();
    const sub = await currentSubscription();
    if (uid && sub) {
      await remove(ref(ctx.db, `PushSubs/${uid}/${await subscriptionId(sub.endpoint)}`));
      await sub.unsubscribe();
    }
  } catch (e) {
    console.warn("Push subscription cleanup failed:", e);
  }
}
