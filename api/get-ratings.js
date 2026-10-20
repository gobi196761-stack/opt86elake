// Vercel Serverless Function: get-ratings
// Hakee ratingit Suomen Pöytätennisliiton (SPTL) järjestelmästä
// ja palauttaa ne muodossa [{ nimi, rating }, ...]

const SPTL_API = "https://proxy6.pingisliitto.fi/api/v1/rating/published-list?date=latest&view=ranking";
// Token tulee ympäristömuuttujasta (Vercel: Settings -> Environment Variables)
const SPTL_BEARER_TOKEN = process.env.SPTL_BEARER_TOKEN;

export default async function handler(request, response) {
  console.log("Vercel function started: get-ratings");

  if (!SPTL_BEARER_TOKEN) {
    return response.status(500).json({ error: "SPTL_BEARER_TOKEN environment variable is not set" });
  }
  
  try {
    const sptlResponse = await fetch(SPTL_API, {
      headers: {
        'Authorization': `Bearer ${SPTL_BEARER_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Vercel-Function'
      },
    });

    if (!sptlResponse.ok) {
      const errorText = await sptlResponse.text();
      console.error("SPTL API error:", sptlResponse.status, errorText);
      return response.status(sptlResponse.status).json({ 
        error: `SPTL API returned status ${sptlResponse.status}`, 
        details: errorText 
      });
    }

    const data = await sptlResponse.json();
    console.log("Data fetched from SPTL, length:", Array.isArray(data) ? data.length : "not an array");
    
    // API saattaa palauttaa datan eri muodoissa
    const players = Array.isArray(data) ? data : (data?.data || data?.ranking || []);

    if (players.length === 0) {
      console.warn("Warning: The player list is empty.");
    }

    const ratings = players
      .filter((p) => p && p.last_name && p.first_name && (typeof p.rate_points === "number" || typeof p.rate_points === "string"))
      .map((p) => ({
        nimi: `${p.last_name} ${p.first_name}`.trim(),
        rating: parseInt(p.rate_points) || 0,
      }));

    console.log("Processed ratings:", ratings.length);

    response.setHeader('Access-Control-Allow-Origin', '*');
    return response.status(200).json(ratings);
  } catch (error) {
    console.error("Function error:", error);
    return response.status(500).json({ error: "Server error: " + error.message });
  }
}
