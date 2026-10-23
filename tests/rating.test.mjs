import test from "node:test";
import assert from "node:assert/strict";
import { matchPoints, capChange, ratingChange, formatChange } from "../lib/rating.js";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("manuaalin esimerkit", () => {
  // Esimerkki 1: 1230 voittaa 1150:n, ero 80 -> 5,76 molemmille
  const e1 = matchPoints(1230, 1150);
  near(e1.winner, 5.76); near(e1.loser, 5.76);
  // Esimerkki 2: 1150 voittaa 1230:n, ero 80 -> 21,6 molemmille
  const e2 = matchPoints(1150, 1230);
  near(e2.winner, 21.6); near(e2.loser, 21.6);
});

test("manuaalin taulukko (erot 0–250)", () => {
  // [ero, korkeampi voittaa, alempi voittaa, korkeampi häviää, alempi häviää]
  const table = [
    [0, 8, 8, 8, 8], [25, 7.3, 12.25, 12.25, 7.3], [50, 6.6, 16.5, 16.5, 6.6], [100, 5.2, 25, 25, 5.2],
    [125, 4.5, 29.25, 25, 4.5], [200, 2.4, 42, 25, 2.4], [250, 1, 50, 25, 1]
  ];
  for (const [d, hiWins, loWins, hiLoses, loLoses] of table) {
    const high = 1500 + d, low = 1500;
    near(matchPoints(high, low).winner, hiWins);
    near(matchPoints(high, low).loser, loLoses);
    near(matchPoints(low, high).winner, loWins);
    near(matchPoints(low, high).loser, hiLoses);
  }
  // Rajat: korkeampi voittaa min 0 (n. 286 p), alempi häviää min 1, alempi voittaa max 50
  assert.equal(matchPoints(1900, 1500).winner, 0);
  assert.equal(matchPoints(1900, 1500).loser, 1);
  assert.equal(matchPoints(1500, 1900).winner, 50);
  assert.equal(matchPoints(1500, 1900).loser, 25);
});

test("60 pisteen leikkuri", () => {
  assert.equal(capChange(100), 80);    // manuaalin esimerkki: 60 + 0,5 * 40
  assert.equal(capChange(-100), -80);
  assert.equal(capChange(60), 60);
  assert.equal(capChange(-12.5), -12.5);
});

const players = [{ idx: 0, rating: 1230 }, { idx: 1, rating: 1150 }, { idx: 2, rating: 1500 }, { idx: 3, rating: 0 }];

test("ryhmän otteluista laskettu muutos ja bonus", () => {
  const ottelut = { "0-1": "3-1", "1-0": "1-3", "0-2": "2-3", "2-0": "3-2", "1-2": "TBD", "2-1": "TBD", "0-3": "3-0", "3-0": "0-3" };
  const p0 = ratingChange(players[0], players, ottelut);
  // voitto 1150:stä +5,76, tappio 1500:lle (korkeampi voittaa, ero 270) -> max(1, 0,44) = 1; ratingiton ohitetaan
  near(p0.base, 5.76 - 1);
  assert.deepEqual([p0.matches, p0.wins, p0.losses, p0.bonus, p0.skipped], [2, 1, 1, 1, 1]);
  near(p0.total, 5.76 - 1 + 1);
  assert.equal(formatChange(p0.total), "+6");
  const p1 = ratingChange(players[1], players, ottelut);
  near(p1.total, -5.76);
  assert.equal(formatChange(p1.total), "−6");
  assert.equal(ratingChange(players[1], players, { "1-0": "TBD" }), null);   // ei pelattuja
});

test("leikkuri ja 700 pisteen minimi ryhmän summaan", () => {
  const ps = [{ idx: 0, rating: 1000 }, { idx: 1, rating: 1300 }, { idx: 2, rating: 1300 }, { idx: 3, rating: 1300 }];
  const wins = { "0-1": "3-0", "0-2": "3-0", "0-3": "3-0" };   // 3 * 50 = 150 -> 60 + 45 = 105
  const r = ratingChange(ps[0], ps, wins);
  near(r.base, 105);
  assert.equal(r.total, 108);
  const low = [{ idx: 0, rating: 705 }, { idx: 1, rating: 705 }, { idx: 2, rating: 705 }];
  const r2 = ratingChange(low[0], low, { "0-1": "0-3", "0-2": "1-3" });   // -16 -> rajataan -5:een
  assert.equal(r2.base, -5);
  assert.equal(formatChange(0.4), "±0");
});
