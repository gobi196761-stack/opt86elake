// Ryhmächatin yhteinen logiikka: käytetään sekä selaimessa (chat.js) että
// Vercel-funktioissa (api/chat-*.js). Ei riippuvuuksia.

// Kuukausi vaihtuu Suomen ajan mukaan; chatit ovat polussa Chats/{kuukausi}/{ryhmä}.
export const CHAT_TIME_ZONE = "Europe/Helsinki";
export const MAX_MESSAGE_LENGTH = 500;
export const MESSAGES_SHOWN = 50;
// Ilmoitus lähetetään vain tuoreesta viestistä (estää vanhojen viestien uudelleenlähetyksen)
export const NOTIFY_MAX_AGE_MS = 5 * 60 * 1000;

const MONTH_KEY = /^\d{4}-\d{2}$/;

// "2026-10" Suomen ajassa
export function monthKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: CHAT_TIME_ZONE, year: "numeric", month: "2-digit" })
    .formatToParts(date);
  const get = type => parts.find(p => p.type === type).value;
  return `${get("year")}-${get("month")}`;
}

// Kuukaudet, jotka ovat ennen nykyistä ja poistetaan ("2026-09" < "2026-10")
export function oldMonths(keys, current = monthKey()) {
  return keys.filter(k => MONTH_KEY.test(k) && k < current);
}

export function groupLabel(groupKey) {
  return String(groupKey).replace("Ryhmä", "Group");
}

// Ryhmän pelaajien nimiavaimet (Players/{ryhmä}/pelaajaN/nameKey)
export function memberNameKeys(groupData) {
  return Object.keys(groupData || {})
    .filter(key => /^pelaaja\d+$/.test(key))
    .map(key => groupData[key] && groupData[key].nameKey)
    .filter(k => typeof k === "string" && k.length > 0);
}

// Ilmoituksen saajat: ryhmän pelaajien käyttäjätunnukset NameIndexin kautta, ei lähettäjää
export function recipientUids(groupData, nameIndex, senderUid) {
  const uids = memberNameKeys(groupData)
    .map(k => (nameIndex || {})[k])
    .filter(uid => typeof uid === "string" && uid !== senderUid);
  return [...new Set(uids)];
}

export function notificationPayload({ group, name, text }) {
  const body = String(text || "");
  return {
    title: `${groupLabel(group)}: ${name}`,
    body: body.length > 140 ? body.slice(0, 139) + "…" : body,
    url: `/dashboard.html?chat=${encodeURIComponent(group)}`,
    tag: `chat-${group}`
  };
}
