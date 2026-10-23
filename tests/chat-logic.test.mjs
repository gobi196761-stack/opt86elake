import test from "node:test";
import assert from "node:assert/strict";
import { monthKey, oldMonths, memberNameKeys, recipientUids, notificationPayload, groupLabel } from "../lib/chat-logic.js";

test("kuukausi vaihtuu Suomen ajassa", () => {
  // 31.10. klo 23.30 UTC = 1.11. klo 01.30 Suomessa (talviaika)
  assert.equal(monthKey(new Date("2026-10-31T23:30:00Z")), "2026-11");
  assert.equal(monthKey(new Date("2026-10-31T21:59:00Z")), "2026-10");
  // kesäaika: 30.6. klo 21.30 UTC = 1.7. klo 00.30
  assert.equal(monthKey(new Date("2026-06-30T21:30:00Z")), "2026-07");
  assert.equal(monthKey(new Date("2026-12-31T22:00:00Z")), "2027-01");
});

test("vanhat kuukaudet poistetaan, nykyinen ja tulevat jäävät", () => {
  assert.deepEqual(oldMonths(["2026-08", "2026-09", "2026-10", "2026-11", "roska"], "2026-10"), ["2026-08", "2026-09"]);
  assert.deepEqual(oldMonths(["2025-12"], "2026-01"), ["2025-12"]);
  assert.deepEqual(oldMonths([], "2026-01"), []);
});

const ryhma = {
  pelaaja1: { nimi: "Virtanen Ville", nameKey: "ville virtanen" },
  pelaaja2: { nimi: "Korhonen Kalle", nameKey: "kalle korhonen" },
  pelaaja3: { nimi: "Uusi Pelaaja", nameKey: "pelaaja uusi" },   // ei tunnusta
  pelaaja4: { nimi: "Vanha", rating: 1200 },                       // ei nimiavainta
  ottelut: { "0-1": "TBD" }
};

test("ilmoituksen saajat: ryhmän tunnukselliset pelaajat ilman lähettäjää", () => {
  assert.deepEqual(memberNameKeys(ryhma), ["ville virtanen", "kalle korhonen", "pelaaja uusi"]);
  const index = { "ville virtanen": "uid-v", "kalle korhonen": "uid-k" };
  assert.deepEqual(recipientUids(ryhma, index, "uid-v"), ["uid-k"]);
  assert.deepEqual(recipientUids(ryhma, index, "joku-muu"), ["uid-v", "uid-k"]);
  assert.deepEqual(recipientUids({}, index, "uid-v"), []);
});

test("ilmoituksen sisältö", () => {
  const p = notificationPayload({ group: "Ryhmä 2", name: "Virtanen Ville", text: "x".repeat(200) });
  assert.equal(p.title, "Group 2: Virtanen Ville");
  assert.equal(p.body.length, 140);
  assert.ok(p.body.endsWith("…"));
  assert.equal(p.url, "/dashboard.html?chat=Ryhm%C3%A4%202");
  assert.equal(p.tag, "chat-Ryhmä 2");
  assert.equal(groupLabel("Ryhmä 1"), "Group 1");
});
