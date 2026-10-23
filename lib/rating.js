// Laskennallinen rating-muutos ryhmän otteluista SPTL:n rating-manuaalin (versio 8.0,
// 14.8.2024) mukaan: https://www.sptl.fi/sptl_uudet/wp-content/uploads/SPTL_Rating-manuaali_V8.0.pdf
// Käytetään selaimessa (script.js); ei riippuvuuksia.

export const DAILY_CAP = 60;          // yli 60 pisteen muutoksesta ylimenevä osa puolitetaan
export const MIN_BASE_RATING = 700;   // perusratingin minimi

// Yhden ottelun pisteet (positiivinen luku) pelaajien ratingien erosta (tarkka ero)
export function matchPoints(winnerRating, loserRating) {
  const diff = Math.abs(winnerRating - loserRating);
  if (winnerRating >= loserRating) {
    // Korkeammalle reitattu voittaa: (ero * -0,028) + 8; voittaja min 0, häviäjä min 1
    const points = diff * -0.028 + 8;
    return { winner: Math.max(0, points), loser: Math.max(1, points) };
  }
  // Alemmaksi reitattu voittaa: (ero * 0,17) + 8; voittaja max 50, häviäjä max 25
  const points = diff * 0.17 + 8;
  return { winner: Math.min(50, points), loser: Math.min(25, points) };
}

// Muutoksen leikkuri: 60 pistettä + 50 % ylimenevästä osasta, suuntaan tai toiseen
export function capChange(change) {
  const abs = Math.abs(change);
  if (abs <= DAILY_CAP) return change;
  return Math.sign(change) * (DAILY_CAP + 0.5 * (abs - DAILY_CAP));
}

// Pelaajan laskennallinen muutos ryhmän pelatuista otteluista.
// players: [{ idx, rating }], ottelut: { "i-j": "3-1" | "TBD" ... } pelaajan i näkökulmasta.
// Palauttaa { matches, wins, losses, base, bonus, total } tai null, jos pelattuja otteluita ei ole.
// Ottelut, joissa jommallakummalla ei ole ratingia (0 tai puuttuu), jätetään pois (skipped).
export function ratingChange(player, players, ottelut) {
  let base = 0, wins = 0, losses = 0, skipped = 0;
  for (const opponent of players) {
    if (opponent.idx === player.idx) continue;
    const result = (ottelut || {})[`${player.idx}-${opponent.idx}`];
    if (!result || result === "TBD") continue;
    const [own, other] = result.split("-").map(Number);
    if (!(own >= 0 && other >= 0) || own === other) continue;
    const mine = Number(player.rating), theirs = Number(opponent.rating);
    if (!(mine > 0 && theirs > 0)) { skipped++; continue; }
    if (own > other) {
      base += matchPoints(mine, theirs).winner;
      wins++;
    } else {
      base -= matchPoints(theirs, mine).loser;
      losses++;
    }
  }
  if (wins + losses === 0) return skipped ? { matches: 0, wins: 0, losses: 0, base: 0, bonus: 0, total: 0, skipped } : null;
  base = capChange(base);
  // Perusrating ei laske alle 700:n
  if (Number(player.rating) + base < MIN_BASE_RATING) base = Math.min(0, MIN_BASE_RATING - Number(player.rating));
  const bonus = wins;   // jokainen voitto = 1 bonuspiste
  return { matches: wins + losses, wins, losses, base, bonus, total: base + bonus, skipped };
}

// Näytettävä luku: kokonaisluku etumerkillä ("+12", "−5", "±0")
export function formatChange(total) {
  const rounded = Math.round(total);
  if (rounded === 0) return "±0";
  return rounded > 0 ? `+${rounded}` : `−${Math.abs(rounded)}`;
}
