// Vercel Serverless Function: chat-cleanup (Vercel Cron, ks. vercel.json)
// Poistaa edellisten kuukausien ryhmächatit: chat alkaa joka kuukausi tyhjästä.
// Jos CRON_SECRET on asetettu, Vercel lähettää sen Authorization-otsakkeessa.
import { bearerToken, send } from "../lib/http.js";
import { monthKey, oldMonths } from "../lib/chat-logic.js";

export async function cleanup({ db, now = new Date() }) {
  const chats = (await db.ref("Chats").get()).val() || {};
  const removed = oldMonths(Object.keys(chats), monthKey(now));
  if (removed.length) {
    await db.ref("Chats").update(Object.fromEntries(removed.map(k => [k, null])));
  }
  return { current: monthKey(now), removed };
}

export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET;
  if (secret && bearerToken(req) !== secret) return send(res, 401, { error: "Unauthorized" });
  let ConfigError = null;
  try {
    const { admin, ConfigError: CE } = await import("../lib/admin.js");
    ConfigError = CE;
    return send(res, 200, await cleanup({ db: admin().db }));
  } catch (e) {
    console.error("chat-cleanup:", e);
    return send(res, ConfigError && e instanceof ConfigError ? 503 : 500, { error: String(e.message || e) });
  }
}
