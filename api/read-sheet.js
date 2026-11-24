// Vercel Serverless Function: read-sheet
// Lukee käsin kirjoitetut tulokset ryhmälomakkeiden valokuvasta (Claude, lib/lue-tulokset.js).
// Kutsuja: ylläpitäjän selain, POST { image: base64, mediaType }, Authorization: Bearer <Firebase ID token>.
// Palauttaa luetut tulokset; vertailu tulostaulukkoon ja tallennus tehdään selaimessa ylläpitäjän valintojen mukaan.
import { bearerToken, readJson, send } from "../lib/http.js";

const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_LENGTH = 4_000_000;   // base64-merkkiä (Vercelin pyyntöraja on 4,5 Mt)

export async function readSheet({ db, auth, read, idToken, body }) {
  if (!idToken) return { status: 401, data: { error: "Missing ID token" } };
  let user;
  try {
    user = await auth.verifyIdToken(idToken);
  } catch {
    return { status: 401, data: { error: "Invalid ID token" } };
  }
  if ((await db.ref(`Config/AdminUids/${user.uid}`).get()).val() !== true) {
    return { status: 403, data: { error: "Administrators only" } };
  }
  const { image, mediaType } = body || {};
  if (typeof image !== "string" || !image || image.length > MAX_IMAGE_LENGTH || !MEDIA_TYPES.includes(mediaType)) {
    return { status: 400, data: { error: "Invalid image" } };
  }
  const data = (await db.ref("Players").get()).val() || {};
  return { status: 200, data: await read({ image, mediaType, data }) };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });
  if (!process.env.ANTHROPIC_API_KEY) {
    return send(res, 503, { error: "Reading photos is not set up: ANTHROPIC_API_KEY is not set" });
  }
  let ConfigError = null;
  try {
    const { admin, ConfigError: CE } = await import("../lib/admin.js");
    ConfigError = CE;
    const { readSheetPhoto } = await import("../lib/lue-tulokset.js");
    const { db, auth } = admin();
    const { status, data } = await readSheet({ db, auth, read: readSheetPhoto, idToken: bearerToken(req), body: await readJson(req) });
    return send(res, status, data);
  } catch (e) {
    console.error("read-sheet:", e);
    return send(res, ConfigError && e instanceof ConfigError ? 503 : 500, { error: String(e.message || e) });
  }
}
