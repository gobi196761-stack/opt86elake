// Tulokset kuvasta: tulostettujen ryhmälomakkeiden numerointi ja kuvasta luettujen
// tulosten vertailu tulostaulukkoon. Käytetään sekä selaimessa että palvelimella.

export const SCORES = ["3-0", "3-1", "3-2", "0-3", "1-3", "2-3"];

// Ryhmälomakkeen pelaajat tulostusjärjestyksessä (rating laskevasti); numero = indeksi + 1.
// idx on pelaajaN-avaimen numero - 1, eli sama kuin ottelut-avaimissa.
export function sheetOrder(groupData) {
  return Object.keys(groupData || {})
    .filter(key => key.startsWith("pelaaja"))
    .map(key => ({ ...groupData[key], id: key, idx: parseInt(key.replace("pelaaja", ""), 10) - 1 }))
    .sort((a, b) => b.rating - a.rating);
}

// Ryhmän kirjain lomakkeella ("Ryhmä A" -> "A")
export const groupLetter = groupKey => String(groupKey).split(" ")[1] || "A";

// Ryhmät ja pelaajat numeroineen tekstinä Claudelle (kuten lomakkeella)
export function rosterText(data) {
  return Object.keys(data || {}).sort().map(groupKey => {
    const players = sheetOrder(data[groupKey]).map((p, i) => `  ${i + 1}. ${p.nimi}`).join("\n");
    return `GROUP ${groupLetter(groupKey)}\n${players}`;
  }).join("\n\n");
}

const nameKey = name => String(name || "").trim().toLowerCase().replace(/\s+/g, " ").split(" ").sort().join(" ");

// Vertaa kuvasta luettuja tuloksia tulostaulukkoon.
// sheets: [{ group, players: [{ number, name }], results: [{ match: "1-3", score: "3-1" }], unclear: [{ match, note }] }]
// Palauttaa rivit { groupKey, a, b, nameA, nameB, key, reverseKey, photo, table, status }
// (status: "new" = taulukossa ei tulosta, "same" = sama, "conflict" = eri tulos)
// sekä varoitukset (tuntematon ryhmä, väärä ottelu, eri nimi lomakkeella) ja epäselvät kohdat.
export function compareSheetResults(data, sheets) {
  const rows = [], warnings = [], unclear = [];
  for (const sheet of sheets || []) {
    const letter = String(sheet.group || "").trim().toUpperCase();
    const groupKey = Object.keys(data || {}).find(k => groupLetter(k).toUpperCase() === letter);
    if (!groupKey) {
      warnings.push({ type: "group", group: letter });
      continue;
    }
    const players = sheetOrder(data[groupKey]);
    const ottelut = data[groupKey].ottelut || {};

    for (const p of sheet.players || []) {
      const expected = players[p.number - 1];
      if (expected && nameKey(p.name) !== nameKey(expected.nimi)) {
        warnings.push({ type: "name", groupKey, number: p.number, sheetName: p.name, tableName: expected.nimi });
      }
    }
    for (const u of sheet.unclear || []) unclear.push({ groupKey, match: u.match, note: u.note });

    for (const r of sheet.results || []) {
      const [a, b] = String(r.match).split("-").map(n => parseInt(n, 10));
      const pa = players[a - 1], pb = players[b - 1];
      if (!pa || !pb || a === b || !SCORES.includes(r.score)) {
        warnings.push({ type: "match", groupKey, match: r.match, score: r.score });
        continue;
      }
      const key = `${pa.idx}-${pb.idx}`;
      const table = ottelut[key] || "TBD";
      rows.push({
        groupKey, a, b, nameA: pa.nimi, nameB: pb.nimi,
        key, reverseKey: `${pb.idx}-${pa.idx}`,
        photo: r.score, table,
        status: table === "TBD" ? "new" : table === r.score ? "same" : "conflict",
      });
    }
  }
  return { rows, warnings, unclear };
}

// Tallennettavat päivitykset valituista riveistä: { "Players/<ryhmä>/ottelut/<i-j>": tulos, ... }
// (tulos molempiin suuntiin, kuten taulukossa syötettäessä)
export function resultUpdates(rows) {
  const updates = {};
  for (const r of rows) {
    updates[`Players/${r.groupKey}/ottelut/${r.key}`] = r.photo;
    updates[`Players/${r.groupKey}/ottelut/${r.reverseKey}`] = r.photo.split("-").reverse().join("-");
  }
  return updates;
}
