import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { sheetOrder, rosterText, compareSheetResults, resultUpdates } from "../lib/tulokset-kuvasta.js";
import { readSheetPhoto, MODEL } from "../lib/lue-tulokset.js";
import { readSheet } from "../api/read-sheet.js";

// Tietokannassa pelaajat eri järjestyksessä kuin lomakkeella (lomake: rating laskevasti)
const data = {
  "Ryhmä A": {
    pelaaja1: { nimi: "Slesar Tomas", rating: 2132 },
    pelaaja2: { nimi: "Ågren Pekka", rating: 2203 },
    pelaaja3: { nimi: "Debazac Florent", rating: 2042 },
    ottelut: { "1-0": "TBD", "0-1": "TBD", "1-2": "3-0", "2-1": "0-3", "0-2": "3-2", "2-0": "2-3" },
  },
  "Ryhmä B": { pelaaja1: { nimi: "Zhu Ning", rating: 1422 } },
};

test("sheetOrder: lomakkeen numerointi rating-järjestyksessä, idx tietokannan avaimesta", () => {
  assert.deepEqual(sheetOrder(data["Ryhmä A"]).map(p => [p.nimi, p.idx]),
    [["Ågren Pekka", 1], ["Slesar Tomas", 0], ["Debazac Florent", 2]]);
  assert.match(rosterText(data), /GROUP A\n  1\. Ågren Pekka\n  2\. Slesar Tomas\n  3\. Debazac Florent/);
});

test("compareSheetResults: uusi, sama ja ristiriitainen tulos sekä varoitukset", () => {
  const { rows, warnings, unclear } = compareSheetResults(data, [{
    group: "a",
    players: [{ number: 1, name: "Ågren Pekka" }, { number: 2, name: "Slesar Tomas" }, { number: 3, name: "Hiltunen Teijo" }],
    results: [
      { match: "1-2", score: "3-1" },   // Ågren (idx 1) - Slesar (idx 0): taulukossa TBD
      { match: "1-3", score: "3-0" },   // Ågren - Debazac: taulukossa 3-0 -> sama
      { match: "2-3", score: "3-1" },   // Slesar - Debazac: taulukossa 3-2 -> ristiriita
      { match: "1-4", score: "3-0" },   // ei pelaajaa 4
    ],
    unclear: [{ match: "2-3", note: "scribbled" }],
  }, { group: "Q", players: [], results: [], unclear: [] }]);

  assert.deepEqual(rows.map(r => [r.key, r.photo, r.table, r.status]), [
    ["1-0", "3-1", "TBD", "new"],
    ["1-2", "3-0", "3-0", "same"],
    ["0-2", "3-1", "3-2", "conflict"],
  ]);
  assert.deepEqual(warnings.map(w => w.type).sort(), ["group", "match", "name"]);
  assert.equal(warnings.find(w => w.type === "name").tableName, "Debazac Florent");
  assert.deepEqual(unclear, [{ groupKey: "Ryhmä A", match: "2-3", note: "scribbled" }]);

  assert.deepEqual(resultUpdates([rows[0], rows[2]]), {
    "Players/Ryhmä A/ottelut/1-0": "3-1", "Players/Ryhmä A/ottelut/0-1": "1-3",
    "Players/Ryhmä A/ottelut/0-2": "3-1", "Players/Ryhmä A/ottelut/2-0": "1-3",
  });
});

test("readSheetPhoto: kuva, ryhmät ja jäsennelty vastaus Claudelta", async () => {
  const reading = { sheets: [{ group: "A", players: [], results: [{ match: "1-2", score: "3-1" }], unclear: [] }] };
  let request;
  const client = new Anthropic({
    apiKey: "test",
    fetch: async (url, init) => {
      request = { url: String(url), headers: init.headers, body: JSON.parse(init.body) };
      return new Response(JSON.stringify({
        id: "msg_1", type: "message", role: "assistant", model: MODEL, stop_reason: "end_turn", stop_sequence: null,
        content: [{ type: "text", text: JSON.stringify(reading) }],
        usage: { input_tokens: 1, output_tokens: 1 },
      }), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  const out = await readSheetPhoto({ client, image: "aGVsbG8=", mediaType: "image/jpeg", data });
  assert.deepEqual(out, reading);
  assert.equal(request.body.model, "claude-opus-5-5");
  assert.equal(request.body.fallbacks, "default");
  assert.equal(request.body.output_config.format.type, "json_schema");
  assert.equal(request.body.messages[0].content[0].source.data, "aGVsbG8=");
  assert.match(request.body.messages[0].content[1].text, /GROUP A/);
  const beta = request.headers instanceof Headers ? request.headers.get("anthropic-beta") : request.headers["anthropic-beta"];
  assert.match(String(beta), /server-side-fallback-2026-07-01/);
});

test("readSheet: vain ylläpitäjälle, kuva tarkistetaan", async () => {
  const db = { ref: path => ({ get: async () => ({ val: () => (path === "Config/AdminUids/admin" ? true : path === "Players" ? data : null) }) }) };
  const auth = { verifyIdToken: async t => { if (t === "bad") throw new Error("bad"); return { uid: t }; } };
  const read = async ({ data: d }) => ({ sheets: [], groups: Object.keys(d) });
  const body = { image: "aGVsbG8=", mediaType: "image/jpeg" };
  assert.equal((await readSheet({ db, auth, read, idToken: null, body })).status, 401);
  assert.equal((await readSheet({ db, auth, read, idToken: "bad", body })).status, 401);
  assert.equal((await readSheet({ db, auth, read, idToken: "player", body })).status, 403);
  assert.equal((await readSheet({ db, auth, read, idToken: "admin", body: { image: "x", mediaType: "text/html" } })).status, 400);
  const ok = await readSheet({ db, auth, read, idToken: "admin", body });
  assert.deepEqual(ok, { status: 200, data: { sheets: [], groups: ["Ryhmä A", "Ryhmä B"] } });
});
