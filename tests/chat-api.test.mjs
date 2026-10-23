import test from "node:test";
import assert from "node:assert/strict";
import { notify } from "../api/chat-notify.js";
import { cleanup } from "../api/chat-cleanup.js";

// Pieni muistinvarainen korvike Admin SDK:n tietokannalle (ref/get/transaction/remove/update)
function fakeDb(initial) {
  const root = structuredClone(initial);
  const parts = path => path.split("/").filter(Boolean);
  const read = path => parts(path).reduce((n, k) => (n == null ? undefined : n[k]), root);
  const write = (path, value) => {
    const ks = parts(path);
    let node = root;
    ks.slice(0, -1).forEach(k => { node = node[k] ??= {}; });
    if (value === null || value === undefined) delete node[ks.at(-1)];
    else node[ks.at(-1)] = value;
  };
  const snap = v => ({ val: () => (v === undefined ? null : structuredClone(v)), exists: () => v !== undefined && v !== null });
  return {
    root,
    ref: path => ({
      get: async () => snap(read(path)),
      remove: async () => write(path, null),
      update: async obj => Object.entries(obj).forEach(([k, v]) => write(`${path}/${k}`, v)),
      transaction: async fn => {
        const next = fn(read(path) ?? null);
        if (next === undefined) return { committed: false, snapshot: snap(read(path)) };
        write(path, next);
        return { committed: true, snapshot: snap(next) };
      }
    })
  };
}

const NOW = Date.parse("2026-10-22T18:00:00Z");
const data = () => ({
  Players: { "Ryhmä 1": {
    pelaaja1: { nimi: "Virtanen Ville", nameKey: "ville virtanen" },
    pelaaja2: { nimi: "Korhonen Kalle", nameKey: "kalle korhonen" },
    pelaaja3: { nimi: "Mäki Matti", nameKey: "matti mäki" }
  } },
  NameIndex: { "ville virtanen": "uid-v", "kalle korhonen": "uid-k", "matti mäki": "uid-m" },
  Chats: { "2026-10": { "Ryhmä 1": { m1: { uid: "uid-v", nimi: "Virtanen Ville", teksti: "Ti 18?", aika: NOW - 1000 } } } },
  PushSubs: {
    "uid-k": { a: { endpoint: "https://push.example/k", p256dh: "p", auth: "a" } },
    "uid-m": { b: { endpoint: "https://push.example/gone", p256dh: "p", auth: "a" } },
    "uid-v": { c: { endpoint: "https://push.example/v", p256dh: "p", auth: "a" } }
  }
});
const auth = { verifyIdToken: async t => {
  if (t === "token-v") return { uid: "uid-v", firebase: { sign_in_provider: "password" } };
  if (t === "token-k") return { uid: "uid-k", firebase: { sign_in_provider: "password" } };
  if (t === "token-anon") return { uid: "anon", firebase: { sign_in_provider: "anonymous" } };
  throw new Error("bad token");
} };
const body = { kuukausi: "2026-10", ryhma: "Ryhmä 1", viesti: "m1" };

function pushRecorder() {
  const sent = [];
  const sendPush = async (sub, payload) => {
    if (sub.endpoint.endsWith("/gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
    sent.push({ endpoint: sub.endpoint, payload: JSON.parse(payload) });
  };
  return { sent, sendPush };
}

test("ilmoitus menee ryhmän muille, vanhentunut tilaus poistetaan, vain kerran", async () => {
  const db = fakeDb(data());
  const { sent, sendPush } = pushRecorder();
  const r = await notify({ db, auth, sendPush, idToken: "token-v", body, now: NOW });
  assert.equal(r.status, 200);
  assert.deepEqual(r.data, { sent: 1, failed: 0, removed: 1 });
  assert.deepEqual(sent.map(s => s.endpoint), ["https://push.example/k"]);   // ei lähettäjälle itselleen
  assert.equal(sent[0].payload.title, "Group 1: Virtanen Ville");
  assert.equal(sent[0].payload.body, "Ti 18?");
  assert.deepEqual(db.root.PushSubs["uid-m"] ?? {}, {});   // Firebase poistaa tyhjän solmun
  assert.equal(db.root.Chats["2026-10"]["Ryhmä 1"].m1.ilmoitettu, true);

  const again = await notify({ db, auth, sendPush, idToken: "token-v", body, now: NOW });
  assert.deepEqual(again.data, { sent: 0, already: true });
  assert.equal(sent.length, 1);
});

test("toisen viestistä, vanhasta viestistä tai ilman kirjautumista ei ilmoiteta", async () => {
  const { sent, sendPush } = pushRecorder();
  const call = (idToken, extra = {}) => notify({ db: fakeDb(data()), auth, sendPush, idToken, body: { ...body, ...extra }, now: NOW });
  assert.equal((await call("token-k")).status, 403);
  assert.equal((await call("token-anon")).status, 403);
  assert.equal((await call(null)).status, 401);
  assert.equal((await call("väärä")).status, 401);
  assert.equal((await call("token-v", { viesti: "puuttuu" })).status, 404);
  assert.equal((await call("token-v", { ryhma: "../Users" })).status, 400);
  assert.equal((await call("token-v", { kuukausi: "lokakuu" })).status, 400);
  const old = await notify({ db: fakeDb(data()), auth, sendPush, idToken: "token-v", body, now: NOW + 10 * 60 * 1000 });
  assert.equal(old.status, 409);
  assert.equal(sent.length, 0);
});

test("siivous poistaa edelliset kuukaudet", async () => {
  const db = fakeDb({ Chats: { "2026-09": { "Ryhmä 1": {} }, "2026-10": { "Ryhmä 1": { x: 1 } } } });
  // 1.11. klo 00.30 Suomen aikaa: lokakuu on jo vanha
  const r = await cleanup({ db, now: new Date("2026-10-31T22:30:00Z") });
  assert.deepEqual(r, { current: "2026-11", removed: ["2026-09", "2026-10"] });
  assert.deepEqual(db.root.Chats, {});
});
