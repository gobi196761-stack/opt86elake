// Netlify Function: get-ratings
// Hakee ratingit Suomen Pöytätennisliiton (SPTL) järjestelmästä
// ja palauttaa ne muodossa [{ nimi, rating }, ...]

const SPTL_API = "https://proxy6.pingisliitto.fi/api/v1/rating/published-list?date=latest&view=ranking";
// Token tulee ympäristömuuttujasta (Vercel: Settings -> Environment Variables)
const SPTL_BEARER_TOKEN = process.env.SPTL_BEARER_TOKEN;

exports.handler = async function(event, context) {
  console.log("Netlify function started: get-ratings");
  
  try {
    const response = await fetch(SPTL_API, {
      headers: {
        'Authorization': `Bearer ${SPTL_BEARER_TOKEN}`,
        'Accept': 'application/json',
        'User-Agent': 'Netlify-Function'
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SPTL API error:", response.status, errorText);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: `SPTL API returned status ${response.status}`, details: errorText }),
      };
    }

    const data = await response.json();
    console.log("Data fetched from SPTL, length:", Array.isArray(data) ? data.length : "not an array");
    
    // API saattaa palauttaa datan eri muodoissa
    const players = Array.isArray(data) ? data : (data?.data || data?.ranking || []);

    if (players.length === 0) {
      console.warn("Warning: The player list is empty. API response:", JSON.stringify(data).substring(0, 200));
    }

    const ratings = players
      .filter((p) => p && p.last_name && p.first_name && (typeof p.rate_points === "number" || typeof p.rate_points === "string"))
      .map((p) => ({
        nimi: `${p.last_name} ${p.first_name}`.trim(),
        rating: parseInt(p.rate_points) || 0,
      }));

    console.log("Processed ratings:", ratings.length);

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow calls from anywhere
      },
      body: JSON.stringify(ratings),
    };
  } catch (error) {
    console.error("Function error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server error: " + error.message }),
    };
  }
};
