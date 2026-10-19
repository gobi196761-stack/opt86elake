const https = require('https');

const initialData = {
  "Ryhmä A": {
    "pelaaja1": { "nimi": "Ågren Pekka", "rating": 2207, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Slesar Tomas", "rating": 2143, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Debazac Florent", "rating": 2042, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Seppälä Marko", "rating": 1851, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Vimpari Lasse", "rating": 1833, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  },
  "Ryhmä B": {
    "pelaaja1": { "nimi": "Niemelä Konsta", "rating": 1916, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Koponen Saku", "rating": 1746, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Vuoste Hannu", "rating": 1701, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Halavaara Kari", "rating": 1561, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Trofimov Vitali", "rating": 1339, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  },
  "Ryhmä C": {
    "pelaaja1": { "nimi": "Honkavaara Oskari", "rating": 1561, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Zhu Ning", "rating": 1428, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Salminen Jukka-Pekka", "rating": 1349, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Tuuttila Tapio", "rating": 1295, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Mikkola Pekka", "rating": 1273, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  },
  "Ryhmä D": {
    "pelaaja1": { "nimi": "Trofimov Dennis", "rating": 1335, "pisteet": 0, "sijoitus": 1 },
    "pelaaja2": { "nimi": "Hiltunen Teijo", "rating": 1200, "pisteet": 0, "sijoitus": 2 },
    "pelaaja3": { "nimi": "Sammalneva Virpi", "rating": 1195, "pisteet": 0, "sijoitus": 3 },
    "pelaaja4": { "nimi": "Kääriäinen Juha", "rating": 925, "pisteet": 0, "sijoitus": 4 },
    "pelaaja5": { "nimi": "Montin Aapo", "rating": 900, "pisteet": 0, "sijoitus": 5 },
    "ottelut": { "0-1": "TBD", "0-2": "TBD", "0-3": "TBD", "0-4": "TBD", "1-0": "TBD", "1-2": "TBD", "1-3": "TBD", "1-4": "TBD", "2-0": "TBD", "2-1": "TBD", "2-3": "TBD", "2-4": "TBD", "3-0": "TBD", "3-1": "TBD", "3-2": "TBD", "3-4": "TBD", "4-0": "TBD", "4-1": "TBD", "4-2": "TBD", "4-3": "TBD" }
  }
};

const data = JSON.stringify(initialData);

const options = {
  hostname: 'opt86elake-default-rtdb.europe-west1.firebasedatabase.app',
  path: '/Players.json',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data)
  }
};

console.log("Lähetetään tietoja Firebaseen...");

const req = https.request(options, (res) => {
  console.log('Status:', res.statusCode);
  let body = '';
  res.on('data', (d) => body += d);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log("Hätäpalautus onnistui!");
    } else {
      console.error("Virhe:", body);
    }
  });
});

req.on('error', (e) => {
  console.error("Verkkovirhe:", e);
});

req.write(data);
req.end();
