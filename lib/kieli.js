// Käyttöliittymän kielet: suomi (oletus) ja englanti (?kieli=en), kuten melontasivuilla.
//
// Sovelluksen tekstit ovat lähdekoodissa englanniksi; suomenkielinen sivu kääntää ne
// esitysvaiheessa: kiinteät tekstit sanakirjasta ja muuttujia sisältävät lauseet
// säännöllisillä lausekkeilla. Pelaajien nimet ja chat-viestit jäävät ennalleen.

export const KIELET = ["fi", "en"];
export const OLETUSKIELI = "fi";

const KUUKAUDET_EN = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const KUUKAUDET_FI = ["tammikuu", "helmikuu", "maaliskuu", "huhtikuu", "toukokuu", "kesäkuu",
  "heinäkuu", "elokuu", "syyskuu", "lokakuu", "marraskuu", "joulukuu"];

// Kiinteät tekstit: englanti -> suomi
export const SANAT = {
  // sivujen otsikot
  "OPT-86 Senior Games": "OPT-86 eläkekisat",
  "OPT-86 Senior Games – Log in": "OPT-86 eläkekisat – Kirjautuminen",
  "OPT-86 Senior Games – Dashboard": "OPT-86 eläkekisat – Tulokset",
  "Log in": "Kirjautuminen",
  "Dashboard": "Tulokset",
  "Senior Games - Results": "Eläkekisat - tulokset",
  // kirjautuminen
  "Email:": "Sähköposti:",
  "Password:": "Salasana:",
  "Sign in": "Kirjaudu sisään",
  "Forgot your password?": "Unohditko salasanasi?",
  "Sign in as visitor": "Kirjaudu vierailijana",
  "Don't have an account?": "Eikö sinulla ole tiliä?",
  "Register here": "Rekisteröidy tästä",
  "Player name:": "Pelaajan nimi:",
  "Lastname Firstname": "Sukunimi Etunimi",
  "Create account": "Luo tili",
  "Already have an account?": "Onko sinulla jo tili?",
  // tulostaulukko
  "Log out": "Kirjaudu ulos",
  "Contact the administrator to change your name.": "Pyydä ylläpitäjää vaihtamaan nimesi.",
  "No players or groups found.": "Pelaajia tai ryhmiä ei löytynyt.",
  "Name": "Nimi",
  "Points": "Pisteet",
  "Position": "Sijoitus",
  "Rating": "Rating",
  "The number under a rating is the estimated rating change from this month's group matches (SPTL rating formula, +1 bonus point per win). Official ratings are calculated by SPTL.":
    "Ratingin alla oleva luku on arvioitu rating-muutos tämän kuun ryhmäotteluista (SPTL:n rating-kaava, +1 bonuspiste voitosta). Viralliset ratingit laskee SPTL.",
  "No rating for this player or the opponents – change cannot be calculated":
    "Pelaajalla tai vastustajilla ei ole ratingia – muutosta ei voi laskea",
  // ylläpitäjän napit ja ikkunat
  "Update ratings": "Päivitä ratingit",
  "Fetching...": "Haetaan...",
  "Generate new groups": "Luo uudet ryhmät",
  "Restore previous draw": "Palauta edellinen arvonta",
  "Print group sheets": "Tulosta ryhmälomakkeet",
  "Manage users": "Hallitse käyttäjiä",
  "Run data migration": "Aja tietojen siirto",
  "Users": "Käyttäjät",
  "A player can enter results for matches where the group list name matches their own name. \"Release\" removes the user's name so that they choose it again at their next sign-in.":
    "Pelaaja voi syöttää tuloksia otteluihin, joissa ryhmälistan nimi vastaa hänen omaa nimeään. \"Vapauta\" poistaa käyttäjän nimen, jolloin hän valitsee sen uudelleen seuraavalla kirjautumisella.",
  "Admin": "Ylläpitäjä",
  "(no name)": "(ei nimeä)",
  "Rename": "Nimeä uudelleen",
  "Release": "Vapauta",
  "Close": "Sulje",
  "Players moving up and down:": "Nousijoita ja putoajia:",
  "This fetches the latest ratings and lets you edit the groups before saving.":
    "Tämä hakee uusimmat ratingit, ja voit muokata ryhmiä ennen tallennusta.",
  "Cancel": "Peruuta",
  "Start": "Aloita",
  "Edit groups and limits": "Muokkaa ryhmiä ja rajoja",
  "Drag players between groups with the mouse. When you are done, press \"Confirm and save\".":
    "Raahaa pelaajia ryhmästä toiseen hiirellä. Kun olet valmis, paina \"Vahvista ja tallenna\".",
  "New player name": "Uuden pelaajan nimi",
  "Add player": "Lisää pelaaja",
  "Add new group": "Lisää uusi ryhmä",
  "Confirm and save new groups": "Vahvista ja tallenna uudet ryhmät",
  // chat
  "🔕 Notifications off": "🔕 Ilmoitukset pois",
  "🔔 Notifications on": "🔔 Ilmoitukset päällä",
  "Close chat": "Sulje chat",
  "Propose a match time": "Ehdota peliaikaa",
  "Write a message (Ctrl+Enter sends)": "Kirjoita viesti (Ctrl+Enter lähettää)",
  "Message": "Viesti",
  "Send": "Lähetä",
  "💬 Chat – new messages": "💬 Chat – uusia viestejä",
  "No messages this month yet. Agree on your match times here – the chat starts fresh every month.":
    "Tässä kuussa ei vielä viestejä. Sopikaa peliajoista täällä – chat alkaa alusta joka kuukausi.",
  "Delete message": "Poista viesti",
  "Delete this message?": "Poistetaanko viesti?",
  "On iPhone, notifications work in the installed app: tap Share → Add to Home Screen, open the app from the Home Screen and turn notifications on there.":
    "iPhonessa ilmoitukset toimivat asennetussa sovelluksessa: napauta Jaa → Lisää Koti-valikkoon, avaa sovellus Koti-valikosta ja laita ilmoitukset päälle siellä.",
  "This browser does not support notifications.": "Tämä selain ei tue ilmoituksia.",
  "Notifications are blocked. Allow notifications for this site in your browser or phone settings.":
    "Ilmoitukset on estetty. Salli ilmoitukset tälle sivustolle selaimen tai puhelimen asetuksista.",
  "Notifications are not available on the server yet. Try again later.":
    "Ilmoitukset eivät ole vielä käytössä palvelimella. Yritä myöhemmin uudelleen.",
  // ilmoitukset ja kysymykset (alert / confirm / prompt)
  "Enter your email address in the email field first.": "Kirjoita ensin sähköpostiosoitteesi sähköpostikenttään.",
  "A reset link has been sent to your email.": "Palautuslinkki on lähetetty sähköpostiisi.",
  "Enter your player name.": "Kirjoita pelaajanimesi.",
  "This name is already in use by another user. Choose a different name or contact the administrator.":
    "Tämä nimi on jo toisen käyttäjän käytössä. Valitse toinen nimi tai ota yhteyttä ylläpitäjään.",
  "Your player name is missing. Enter your name in the form 'Lastname Firstname':":
    "Pelaajanimesi puuttuu. Kirjoita nimesi muodossa 'Sukunimi Etunimi':",
  "This name is already in use by another user. Contact the administrator.":
    "Tämä nimi on jo toisen käyttäjän käytössä. Ota yhteyttä ylläpitäjään.",
  "New name in the form 'Lastname Firstname':": "Uusi nimi muodossa 'Sukunimi Etunimi':",
  "This name is already in use by another user.": "Tämä nimi on jo toisen käyttäjän käytössä.",
  "You cannot release your own name.": "Et voi vapauttaa omaa nimeäsi.",
  "Run the one-time data migration now?": "Ajetaanko kertaluonteinen tietojen siirto nyt?",
  "Are you sure you want to restore the previous group draw and results?":
    "Haluatko varmasti palauttaa edellisen ryhmäarvonnan ja tulokset?",
  "No backup found.": "Varmuuskopiota ei löytynyt.",
  "Restored successfully!": "Palautus onnistui!",
  "Ratings were fetched, but none of the players on the list were found in the SPTL registry. Check the spelling of the names.":
    "Ratingit haettiin, mutta yhtäkään listan pelaajaa ei löytynyt SPTL:n rekisteristä. Tarkista nimien kirjoitusasu.",
  "Are you sure you want to cancel? Changes will not be saved.": "Haluatko varmasti peruuttaa? Muutoksia ei tallenneta.",
  "Do you want to save these groups and start a new month? This will reset all results.":
    "Tallennetaanko nämä ryhmät ja aloitetaan uusi kuukausi? Kaikki tulokset nollataan.",
  "Error: No groups to save. Add at least one group and one player.":
    "Virhe: Ei tallennettavia ryhmiä. Lisää vähintään yksi ryhmä ja yksi pelaaja.",
  "New groups saved successfully!": "Uudet ryhmät tallennettu!",
  // tulostettavat ryhmälomakkeet
  "OPT-86 Printout": "OPT-86 tuloste",
  "SENIOR GAMES": "ELÄKEKISAT",
  "MONTHLY MATCHES": "KUUKAUSIKISAT",
  "GROUP": "RYHMÄ",
  "NAME": "NIMI",
  "RATING": "RATING",
  "MATCH": "OTTELU",
  "RESULT": "TULOS",
  "Mark only sets, for example 3-2": "Merkitse vain erät, esimerkiksi 3-2",
};

// Muuttujia sisältävät lauseet: [lauseke, korvaus]
const LAUSEET = [
  [/^Version (.+)$/, "Versio $1"],
  [/^Group (\S+)$/, "Ryhmä $1"],
  [/^Group (\S+) chat$/, "Ryhmä $1 – chat"],
  [/^Signed in: Unknown$/, "Kirjautunut: Tuntematon"],
  [/^Signed in: (.+)$/, "Kirjautunut: $1"],
  [/^Propose a match time to (.+)$/, "Ehdota peliaikaa pelaajalle $1"],
  [/^(.+) \(not migrated\)$/, "$1 (ei siirretty)"],
  [/^No administrators yet\. Your user ID is (\S+) – add it in the Firebase Console as (\S+) = true\.$/,
    "Ylläpitäjiä ei ole vielä. Käyttäjätunnuksesi on $1 – lisää se Firebase-konsolissa muodossa $2 = true."],
  [/^Estimated rating change from (\d+) group match(?:es)? \((\d+) W, (\d+) L\): (\S+) rating \+ (\S+) bonus\. SPTL formula; the official rating is calculated by SPTL\.(?: (\d+) match\(es\) without a rating not counted\.)?$/,
    (_, n, v, h, perus, bonus, ohi) =>
      `Arvioitu rating-muutos ${n} ryhmäottelusta (${v} V, ${h} H): ${perus} ratingia + ${bonus} bonus. ` +
      "SPTL:n kaava; virallisen ratingin laskee SPTL." + (ohi ? ` ${ohi} ottelua ilman ratingia jätetty laskematta.` : "")],
  [/^Monthly games - (\w+) results$/, (_, kk) => {
    const i = KUUKAUDET_EN.indexOf(kk);
    return i < 0 ? null : `Kuukausikisat - ${KUUKAUDET_FI[i].replace(/u$/, "un")} tulokset`;
  }],
  [/^(\w+) (\d{4})$/, (_, kk, vuosi) => {
    const i = KUUKAUDET_EN.map(k => k.toUpperCase()).indexOf(kk);
    return i < 0 ? null : `${KUUKAUDET_FI[i].toUpperCase()} ${vuosi}`;
  }],
  [/^(.+) – (.+): would ___ at ___ suit you\?$/, "$1 – $2: sopisiko ___ klo ___?"],
  [/^Send a password reset link to (.+)\?$/, "Lähetetäänkö salasanan palautuslinkki osoitteeseen $1?"],
  [/^Login error: (.*)$/s, "Kirjautumisvirhe: $1"],
  [/^Registration error: (.*)$/s, "Rekisteröintivirhe: $1"],
  [/^Visitor login failed: (.*)$/s, "Vierailijakirjautuminen epäonnistui: $1"],
  [/^Could not save the result: (.*)$/s, "Tulosta ei voitu tallentaa: $1"],
  [/^Release the name "(.*)"\? The user will be asked for a name at the next sign-in\.$/s,
    "Vapautetaanko nimi \"$1\"? Käyttäjältä kysytään nimeä seuraavalla kirjautumisella."],
  [/^Migration completed\.\nDuplicate names, fix these in "Manage users": (.*)$/s,
    "Tietojen siirto valmis.\nPäällekkäiset nimet, korjaa nämä kohdassa \"Hallitse käyttäjiä\": $1"],
  [/^Migration completed\.$/, "Tietojen siirto valmis."],
  [/^Migration error: (.*)$/s, "Siirtovirhe: $1"],
  [/^Player "(.*)" was not found in SPTL\. Enter the rating manually:$/s,
    "Pelaajaa \"$1\" ei löytynyt SPTL:stä. Syötä rating käsin:"],
  [/^Error during restore: (.*)$/s, "Virhe palautuksessa: $1"],
  [/^Updated ratings for (\d+) players!$/, "Päivitettiin $1 pelaajan rating!"],
  [/^Could not load messages: (.*)$/s, "Viestejä ei voitu ladata: $1"],
  [/^Could not delete the message: (.*)$/s, "Viestiä ei voitu poistaa: $1"],
  [/^The message is too long \(max (\d+) characters\)\.$/, "Viesti on liian pitkä (enintään $1 merkkiä)."],
  [/^Could not send the message: (.*)$/s, "Viestiä ei voitu lähettää: $1"],
  [/^Could not change notifications: (.*)$/s, "Ilmoituksia ei voitu muuttaa: $1"],
  [/^Error: (.*)$/s, "Virhe: $1"],
];

// Kääntää englanninkielisen tekstin valitulle kielelle; tuntematon teksti palautetaan sellaisenaan.
export function kaanna(teksti, kieli) {
  if (kieli !== "fi" || typeof teksti !== "string") return teksti;
  const sisus = teksti.trim();
  if (!sisus) return teksti;
  // Säilytetään ympäröivät välilyönnit (tekstisolmut HTML:ssä)
  const [alku, loppu] = [teksti.slice(0, teksti.indexOf(sisus)), teksti.slice(teksti.indexOf(sisus) + sisus.length)];
  const avain = sisus.replace(/\s+/g, " ");
  if (Object.hasOwn(SANAT, avain)) return alku + SANAT[avain] + loppu;
  for (const [lauseke, korvaus] of LAUSEET) {
    const osuma = sisus.match(lauseke);
    if (!osuma) continue;
    const tulos = typeof korvaus === "function" ? korvaus(...osuma) : sisus.replace(lauseke, korvaus);
    if (tulos != null) return alku + tulos + loppu;
  }
  return teksti;
}

// Kieli osoitteen ?kieli=-parametrista, muuten tallennettu valinta, muuten suomi.
export function valitseKieli(haku, tallennettu) {
  const parametri = new URLSearchParams(haku || "").get("kieli");
  if (KIELET.includes(parametri)) return parametri;
  return KIELET.includes(tallennettu) ? tallennettu : OLETUSKIELI;
}
