// --- SCRIPT.JS (PUHDAS VERSIO) ---
// ... (tähän kopioit koko aiemman script.js -tiedostosi, mutta vaihdat updateGroupsin tähän:)

window.updateGroups = async function () {
  const moveCountStr = prompt("How many players move up and down?\n\n1 = 1 player\n2 = 2 players", "1");
  if (moveCountStr === null) return;
  
  const moveCount = parseInt(moveCountStr);
  if (isNaN(moveCount) || moveCount < 1 || moveCount > 2) {
      alert("Please choose 1 or 2.");
      return;
  }

  if (!confirm(`Start generating new groups (${moveCount} players move up/down)? This fetches the latest ratings and lets you edit the groups before saving.`)) {
    return;
  }

  try {
    console.log("Fetching the latest ratings...");
    const res = await fetch("/api/get-ratings");
    const latestRatings = await res.json();
    const ratingLookup = latestRatings.reduce((acc, p) => {
        if (p?.nimi) acc[p.nimi.trim().toLowerCase()] = p.rating;
        return acc;
    }, {});

    const groupsRef = ref(db, "Players");
    const snapshot = await get(groupsRef);
    const originalData = snapshot.val();
    if (!originalData) return;

    let allGroups = [];
    Object.entries(originalData).forEach(([gKey, group]) => {
        const playerKeys = Object.keys(group).filter(k => k.startsWith("pelaaja"));
        const matches = group.ottelut || {};
        
        const players = playerKeys.map(pKey => {
            const p = group[pKey];
            const rowIndex = parseInt(pKey.replace('pelaaja', '')) - 1;
            let pointsWithPenalties = 0;

            playerKeys.forEach(oKey => {
                const opponentIndex = parseInt(oKey.replace('pelaaja', '')) - 1;
                if (rowIndex === opponentIndex) return;
                const result = matches[`${rowIndex}-${opponentIndex}`] || "TBD";
                if (result === "TBD") {
                    pointsWithPenalties -= 3;
                } else {
                    const [a] = result.split('-').map(Number);
                    pointsWithPenalties += a;
                }
            });

            const cleanName = p.nimi.trim().toLowerCase();
            return {
                ...p,
                rating: ratingLookup[cleanName] || p.rating,
                oldPisteet: pointsWithPenalties
            };
        });
        
        players.sort((a, b) => (b.oldPisteet - a.oldPisteet) || (a.rating - b.rating));
        allGroups.push({ key: gKey, players });
    });

    allGroups.sort((a, b) => a.key.localeCompare(b.key));
    renderEditGroups(allGroups);
  } catch (error) {
      console.error("Error generating groups:", error);
      alert("Error: " + error.message);
  }
};
