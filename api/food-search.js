// Vercel serverless function — proxies USDA FoodData Central search
// so the API key never reaches the browser.
//
// Deploy path: /api/food-search
// Env var required in Vercel project settings: USDA_API_KEY

export default async function handler(req, res) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const query = req.query.q;
  if (!query || query.trim().length < 2) {
    return res.status(400).json({ error: 'Query must be at least 2 characters' });
  }

  const apiKey = process.env.USDA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Server misconfigured — missing API key' });
  }

  try {
    const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${apiKey}` +
      `&query=${encodeURIComponent(query)}` +
      `&pageSize=15` +
      `&dataType=Foundation,SR%20Legacy`; // prioritize whole/generic foods over branded

    const usdaRes = await fetch(url);

    if (!usdaRes.ok) {
      return res.status(usdaRes.status).json({ error: 'USDA API request failed' });
    }

    const data = await usdaRes.json();

    // Normalize into the shape the frontend expects
    const results = (data.foods || []).map(food => {
      const nutrients = {};
      (food.foodNutrients || []).forEach(n => {
        // USDA nutrient IDs: 1008=calories, 1003=protein, 1005=carbs, 1004=fat
        if (n.nutrientId === 1008) nutrients.cal = n.value;
        if (n.nutrientId === 1003) nutrients.prot = n.value;
        if (n.nutrientId === 1005) nutrients.carb = n.value;
        if (n.nutrientId === 1004) nutrients.fat = n.value;
      });

      return {
        name: food.description,
        cal: Math.round(nutrients.cal || 0),
        prot: Math.round((nutrients.prot || 0) * 10) / 10,
        carb: Math.round((nutrients.carb || 0) * 10) / 10,
        fat: Math.round((nutrients.fat || 0) * 10) / 10,
        unit: '100g', // USDA base values are per 100g
        source: 'usda',
        fdcId: food.fdcId
      };
    }).filter(f => f.cal > 0); // drop entries with no calorie data

    // Cache for 1 hour at the edge — food data doesn't change often
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    return res.status(200).json({ results });

  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch food data' });
  }
}
