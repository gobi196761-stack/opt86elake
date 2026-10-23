// Tietokannan sääntöjen testit Firebase-emulaattoria vasten (REST).
// Ajo: npm run test:rules   (käynnistää emulaattorin firebase.jsonin mukaan)
import test from "node:test";
import assert from "node:assert/strict";

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
const NS = "demo-opt86-default-rtdb";

// Emulaattori hyväksyy allekirjoittamattomat tunnukset
function token(uid, provider = "password") {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  return `${b64({ alg: "none", typ: "JWT" })}.${b64({
    iss: "https://securetoken.google.com/demo-opt86", aud: "demo-opt86", iat: now, exp: now + 3600,
    auth_time: now, sub: uid, user_id: uid, firebase: { sign_in_provider: provider, identities: {} }
  })}.`;
}

// Käyttäjän tunnus annetaan auth-parametrina (Bearer-otsake on emulaattorissa ylläpitäjän oikeus)
async function call(who, method, path, body) {
  const headers = { "Content-Type": "application/json" };
  let auth = "";
  if (who === "owner") headers.Authorization = "Bearer owner";
  else if (who === "anon") auth = `&auth=${token("anon-1", "anonymous")}`;
  else if (who) auth = `&auth=${token(who)}`;
  const res = await fetch(`http://${HOST}/${encodeURI(path)}.json?ns=${NS}${auth}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body)
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) };
}
const allowed = async (p, msg) => { const r = await p; assert.ok(r.ok, `${msg}: ${r.status} ${JSON.stringify(r.data)}`); return r; };
const denied = async (p, msg) => { const r = await p; assert.ok(!r.ok, `${msg}: odotettiin estoa, saatiin ${r.status}`); };

const G1 = "Chats/2026-10/Ryhmä 1";
const msg = (uid, nimi, extra = {}) => ({ uid, nimi, teksti: "Sopisiko ti 18?", aika: { ".sv": "timestamp" }, ...extra });

test.beforeEach(async () => {
  await allowed(call("owner", "PUT", "", {
    Config: { AdminUids: { "uid-a": true } },
    Users: {
      "uid-v": { nimi: "Virtanen Ville", nameKey: "ville virtanen", rooli: "pelaaja" },
      "uid-k": { nimi: "Korhonen Kalle", nameKey: "kalle korhonen", rooli: "pelaaja" },
      "uid-m": { nimi: "Mäki Matti", nameKey: "matti mäki", rooli: "pelaaja" },
      "uid-a": { nimi: "Admin Anna", nameKey: "admin anna", rooli: "pelaaja" }
    },
    NameIndex: { "ville virtanen": "uid-v", "kalle korhonen": "uid-k", "matti mäki": "uid-m", "admin anna": "uid-a" },
    Players: {
      "Ryhmä 1": { pelaaja1: { nimi: "Virtanen Ville", nameKey: "ville virtanen" },
                   pelaaja2: { nimi: "Korhonen Kalle", nameKey: "kalle korhonen" },
                   ottelut: { "0-1": "TBD", "1-0": "TBD" } },
      "Ryhmä 2": { pelaaja1: { nimi: "Mäki Matti", nameKey: "matti mäki" }, ottelut: {} }
    },
    Chats: {
      "2026-09": { "Ryhmä 1": { vanha: { uid: "uid-v", nimi: "Virtanen Ville", teksti: "syyskuu", aika: 1 } } },
      "2026-10": { "Ryhmä 1": { k1: { uid: "uid-k", nimi: "Korhonen Kalle", teksti: "Moi", aika: 1 } } }
    },
    PushSubs: { "uid-k": { s1: { endpoint: "https://push.example/k", p256dh: "p", auth: "a", luotu: 1 } } },
    Secrets: { vapid: { publicKey: "pub", privateKey: "priv" } }
  }), "alustus");
});

test("chatin lukeminen: vain ryhmän pelaajat ja ylläpitäjä", async () => {
  await allowed(call("uid-v", "GET", G1), "oma ryhmä");
  await allowed(call("uid-a", "GET", G1), "ylläpitäjä");
  await allowed(call("uid-a", "GET", "Chats"), "ylläpitäjä kaikki");
  await denied(call("uid-m", "GET", G1), "toisen ryhmän pelaaja");
  await denied(call("anon", "GET", G1), "vierailija");
  await denied(call(null, "GET", G1), "kirjautumaton");
  await denied(call("uid-v", "GET", "Chats"), "pelaaja kaikki chatit");
  await denied(call("uid-v", "GET", "Chats/2026-10"), "pelaaja kuukauden kaikki ryhmät");
});

test("viestin lähettäminen ja sen tarkistukset", async () => {
  const r = await allowed(call("uid-v", "POST", G1, msg("uid-v", "Virtanen Ville")), "oma viesti");
  const saved = await call("uid-v", "GET", `${G1}/${r.data.name}`);
  assert.equal(typeof saved.data.aika, "number");
  await denied(call("uid-m", "POST", G1, msg("uid-m", "Mäki Matti")), "toisen ryhmän pelaaja");
  await denied(call("anon", "POST", G1, msg("anon-1", "Vieras")), "vierailija");
  await denied(call("uid-v", "POST", G1, msg("uid-k", "Virtanen Ville")), "toisen uid");
  await denied(call("uid-v", "POST", G1, msg("uid-v", "Korhonen Kalle")), "toisen nimi");
  await denied(call("uid-v", "POST", G1, msg("uid-v", "Virtanen Ville", { teksti: "" })), "tyhjä");
  await denied(call("uid-v", "POST", G1, msg("uid-v", "Virtanen Ville", { teksti: "x".repeat(501) })), "liian pitkä");
  await allowed(call("uid-v", "POST", G1, msg("uid-v", "Virtanen Ville", { teksti: "x".repeat(500) })), "500 merkkiä");
  await denied(call("uid-v", "POST", G1, msg("uid-v", "Virtanen Ville", { aika: 123 })), "keksitty aika");
  await denied(call("uid-v", "POST", G1, msg("uid-v", "Virtanen Ville", { ilmoitettu: true })), "ylimääräinen kenttä");
  await denied(call("uid-v", "POST", "Chats/lokakuu/Ryhmä 1", msg("uid-v", "Virtanen Ville")), "väärä kuukausiavain");
  await denied(call("uid-v", "POST", "Chats/2026-10/Ryhmä 3", msg("uid-v", "Virtanen Ville")), "olematon ryhmä");
});

test("muokkaus ja poisto", async () => {
  await denied(call("uid-k", "PUT", `${G1}/k1`, msg("uid-k", "Korhonen Kalle", { teksti: "muokattu" })), "oman muokkaus");
  await denied(call("uid-v", "DELETE", `${G1}/k1`), "toisen viestin poisto");
  await allowed(call("uid-k", "DELETE", `${G1}/k1`), "oman viestin poisto");
  await allowed(call("owner", "PUT", `${G1}/k2`, { uid: "uid-k", nimi: "Korhonen Kalle", teksti: "x", aika: 1 }), "alustus");
  await allowed(call("uid-a", "DELETE", `${G1}/k2`), "ylläpitäjä poistaa");
  await denied(call("uid-v", "DELETE", "Chats/2026-09"), "pelaaja poistaa kuukauden");
  await allowed(call("uid-a", "DELETE", "Chats/2026-09"), "ylläpitäjä poistaa vanhan kuukauden");
});

test("push-tilaukset: vain omat", async () => {
  const sub = { endpoint: "https://push.example/v", p256dh: "p", auth: "a", luotu: { ".sv": "timestamp" } };
  await allowed(call("uid-v", "PUT", "PushSubs/uid-v/s1", sub), "oma tilaus");
  await allowed(call("uid-v", "GET", "PushSubs/uid-v"), "omat tilaukset");
  await denied(call("uid-v", "GET", "PushSubs/uid-k"), "toisen tilaukset");
  await denied(call("uid-v", "PUT", "PushSubs/uid-k/s2", sub), "toisen nimiin");
  await denied(call("uid-v", "DELETE", "PushSubs/uid-k/s1"), "toisen poisto");
  await denied(call("uid-v", "PUT", "PushSubs/uid-v/s2", { ...sub, endpoint: "http://push.example/v" }), "ei https");
  await denied(call("uid-v", "PUT", "PushSubs/uid-v/s3", { ...sub, muuta: 1 }), "ylimääräinen kenttä");
  await denied(call("anon", "PUT", "PushSubs/anon-1/s1", sub), "vierailija");
  await denied(call("uid-a", "GET", "PushSubs"), "ylläpitäjäkään ei lue kaikkia");
  await allowed(call("uid-v", "DELETE", "PushSubs/uid-v/s1"), "oman poisto");
});

test("VAPID-avaimet eivät näy kenellekään selaimesta", async () => {
  await denied(call("uid-v", "GET", "Secrets/vapid"), "pelaaja");
  await denied(call("uid-a", "GET", "Secrets/vapid"), "ylläpitäjä");
});

test("vanhat säännöt toimivat edelleen (oma ottelutulos)", async () => {
  await allowed(call("uid-v", "PATCH", "Players/Ryhmä 1/ottelut", { "0-1": "3-1", "1-0": "1-3" }), "oma ottelu");
  await denied(call("uid-m", "PATCH", "Players/Ryhmä 1/ottelut", { "0-1": "3-0" }), "toisen ryhmän ottelu");
});
