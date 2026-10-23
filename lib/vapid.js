// Web push -ilmoitusten VAPID-avainpari. Luodaan ensimmäisellä kerralla ja tallennetaan
// tietokantaan polkuun Secrets/vapid, jota säännöt eivät anna selaimille luettavaksi.
import webpush from "web-push";

export async function vapidKeys(db) {
  const ref = db.ref("Secrets/vapid");
  const snap = await ref.get();
  if (snap.exists()) return snap.val();
  const fresh = webpush.generateVAPIDKeys();
  // Transaktio: jos kaksi kutsua luo avaimet yhtä aikaa, kumpikin käyttää samaa paria
  const { snapshot } = await ref.transaction(current => current || fresh);
  return snapshot.val();
}
