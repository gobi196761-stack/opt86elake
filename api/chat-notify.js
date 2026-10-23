// Vercel Serverless Function: chat-notify
// Lähettää push-ilmoituksen ryhmän muille pelaajille, kun ryhmän chattiin tulee viesti.
// Kutsuja: viestin lähettäjän selain heti viestin tallennuksen jälkeen.
//   POST { kuukausi, ryhma, viesti }, Authorization: Bearer <Firebase ID token>
// Ilmoitus lähetetään vain kutsujan omasta, tuoreesta viestistä ja vain kerran (ilmoitettu-merkintä).
import { bearerToken, readJson, send } from "../lib/http.js";
import { NOTIFY_MAX_AGE_MS, notificationPayload, recipientUids, memberNameKeys } from "../lib/chat-logic.js";

const KEY = /^[^.#$\[\]\/]{1,100}$/;   // Firebasen sallima avain

export async function notify({ db, auth, sendPush, idToken, body, now = Date.now() }) {
  const { kuukausi, ryhma, viesti } = body || {};
  if (!/^\d{4}-\d{2}$/.test(kuukausi || "") || !KEY.test(ryhma || "") || !KEY.test(viesti || "")) {
    return { status: 400, data: { error: "Invalid message reference" } };
  }
  if (!idToken) return { status: 401, data: { error: "Missing ID token" } };
  let user;
  try {
    user = await auth.verifyIdToken(idToken);
  } catch {
    return { status: 401, data: { error: "Invalid ID token" } };
  }
  if (user.firebase && user.firebase.sign_in_provider === "anonymous") {
    return { status: 403, data: { error: "Visitors cannot send messages" } };
  }

  const path = `Chats/${kuukausi}/${ryhma}/${viesti}`;
  const message = (await db.ref(path).get()).val();
  if (!message) return { status: 404, data: { error: "Message not found" } };
  if (message.uid !== user.uid) return { status: 403, data: { error: "Not your message" } };
  if (typeof message.aika !== "number" || now - message.aika > NOTIFY_MAX_AGE_MS) {
    return { status: 409, data: { error: "Message is too old to notify" } };
  }

  // Kerran per viesti: transaktio keskeytyy, jos merkintä on jo olemassa
  const claim = await db.ref(`${path}/ilmoitettu`).transaction(current => (current ? undefined : true));
  if (!claim.committed) return { status: 200, data: { sent: 0, already: true } };

  const groupData = (await db.ref(`Players/${ryhma}`).get()).val() || {};
  const nameIndex = {};
  await Promise.all(memberNameKeys(groupData).map(async key => {
    nameIndex[key] = (await db.ref(`NameIndex/${key}`).get()).val();
  }));
  const payload = JSON.stringify(notificationPayload({ group: ryhma, name: message.nimi, text: message.teksti }));

  let sent = 0, failed = 0, removed = 0;
  for (const uid of recipientUids(groupData, nameIndex, user.uid)) {
    const subs = (await db.ref(`PushSubs/${uid}`).get()).val() || {};
    await Promise.all(Object.entries(subs).map(async ([id, s]) => {
      try {
        await sendPush({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        sent++;
      } catch (e) {
        // 404/410: tilaus on vanhentunut (sovellus poistettu tai lupa peruttu)
        if (e && (e.statusCode === 404 || e.statusCode === 410)) {
          await db.ref(`PushSubs/${uid}/${id}`).remove();
          removed++;
        } else {
          console.error("push failed:", e && (e.statusCode || e.message));
          failed++;
        }
      }
    }));
  }
  return { status: 200, data: { sent, failed, removed } };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  let ConfigError = null;
  try {
    // Kirjastot ladataan vasta pyynnössä: latausvirhe palautetaan viestinä eikä funktio kaadu
    const { admin, ConfigError: CE } = await import("../lib/admin.js");
    ConfigError = CE;
    const { vapidKeys } = await import("../lib/vapid.js");
    const { default: webpush } = await import("web-push");
    const { db, auth } = admin();
    const keys = await vapidKeys(db);
    const host = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
    const vapidDetails = {
      subject: process.env.VAPID_SUBJECT || `https://${host}`,
      publicKey: keys.publicKey,
      privateKey: keys.privateKey
    };
    const sendPush = (subscription, payload) =>
      webpush.sendNotification(subscription, payload, { vapidDetails, TTL: 12 * 3600, urgency: "normal" });
    const { status, data } = await notify({ db, auth, sendPush, idToken: bearerToken(req), body: await readJson(req) });
    return send(res, status, data);
  } catch (e) {
    console.error("chat-notify:", e);
    return send(res, ConfigError && e instanceof ConfigError ? 503 : 500, { error: String(e.message || e) });
  }
}
