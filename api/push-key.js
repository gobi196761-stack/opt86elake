// Vercel Serverless Function: push-key
// Palauttaa web push -tilauksen julkisen VAPID-avaimen (luodaan ensimmäisellä kutsulla).
import { send } from "../lib/http.js";

export default async function handler(req, res) {
  let ConfigError = null;
  try {
    // Kirjastot ladataan vasta pyynnössä: latausvirhe palautetaan viestinä eikä funktio kaadu
    const { admin, ConfigError: CE } = await import("../lib/admin.js");
    ConfigError = CE;
    const { vapidKeys } = await import("../lib/vapid.js");
    const { publicKey } = await vapidKeys(admin().db);
    return send(res, 200, { publicKey }, "public, max-age=3600");
  } catch (e) {
    console.error("push-key:", e);
    return send(res, ConfigError && e instanceof ConfigError ? 503 : 500, { error: String(e.message || e) });
  }
}
