// Generoi database.rules.json. Ajo: node tools/build-rules.mjs
//
// Ottelutuloksen saa kirjoittaa ylläpitäjä tai ottelun jompikumpi pelaaja.
// Ottelun avain on "i-j" (pelaaja(i+1) vastaan pelaaja(j+1)). Säännöissä ei voi
// pilkkoa merkkijonoa, joten jokaiselle pelaajapaikalle 0..MAX_PLAYERS-1
// generoidaan oma ehto: avain alkaa "i-" tai päättyy "-i", ja kyseisen paikan
// pelaajan nimiavain osoittaa NameIndexissä kirjoittajan uid:hen.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_PLAYERS = 16;
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const signedIn = "auth != null && auth.provider !== 'anonymous'";
const isAdmin = "auth != null && root.child('Config/AdminUids/' + auth.uid).val() === true";

const participantClauses = [];
for (let i = 0; i < MAX_PLAYERS; i++) {
  const keyPath = `data.parent().parent().child('pelaaja${i + 1}/nameKey')`;
  participantClauses.push(
    `(($match.beginsWith('${i}-') || $match.endsWith('-${i}')) && ${keyPath}.isString() && ` +
    `root.child('NameIndex/' + ${keyPath}.val()).val() === auth.uid)`
  );
}

const rules = {
  rules: {
    ".read": false,
    ".write": false,
    Players: {
      // Vierailijat (anonyymit) näkevät ryhmät ja tulokset
      ".read": "auth != null",
      ".write": isAdmin,
      $group: {
        ottelut: {
          $match: {
            // Pelaaja saa muuttaa vain olemassa olevaa ottelua, jossa hän itse pelaa
            ".write": `${signedIn} && data.exists() && newData.exists() && (${participantClauses.join(" || ")})`,
            ".validate": "newData.isString() && newData.val().matches(/^(TBD|3-0|3-1|3-2|0-3|1-3|2-3)$/)"
          }
        }
      }
    },
    Users: {
      ".read": isAdmin,
      ".write": isAdmin,
      $uid: {
        ".read": "auth != null && auth.uid === $uid",
        // Käyttäjä luo oman tietueensa kerran; nimen muuttaa sen jälkeen vain ylläpitäjä
        ".write": `${signedIn} && auth.uid === $uid && !data.exists()`,
        ".validate": `(${isAdmin}) || (newData.hasChildren(['nimi', 'nameKey']) && newData.child('nimi').isString() && ` +
          "newData.child('nimi').val().length >= 2 && newData.child('nimi').val().length <= 60 && " +
          "newData.parent().parent().child('NameIndex/' + newData.child('nameKey').val()).val() === $uid)",
        nimi: { ".validate": "newData.isString()" },
        nameKey: { ".validate": "newData.isString()" },
        rooli: { ".validate": "newData.val() === 'pelaaja'" },
        $other: { ".validate": false }
      }
    },
    NameIndex: {
      ".read": signedIn,
      ".write": isAdmin,
      $key: {
        // Kertakirjoitettava: nimen voi varata vain itselleen, vain yhdessä oman
        // Users-tietueen luonnin kanssa, eikä jo varattua nimeä voi ottaa
        ".write": `${signedIn} && !data.exists() && newData.val() === auth.uid && ` +
          "!root.child('Users/' + auth.uid).exists() && " +
          "newData.parent().parent().child('Users/' + auth.uid + '/nameKey').val() === $key",
        ".validate": "newData.isString()"
      }
    },
    Config: {
      ".read": signedIn,
      ".write": isAdmin,
      AdminUids: {
        $uid: { ".validate": "newData.val() === true" }
      }
    },
    Backup: {
      ".read": isAdmin,
      ".write": isAdmin
    }
  }
};

fs.writeFileSync(path.join(root, "database.rules.json"), JSON.stringify(rules, null, 2) + "\n");
console.log("database.rules.json written");
