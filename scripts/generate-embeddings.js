/**
 * generate-embeddings.js
 *
 * Reads content/chunks.json (produced by chunk-modules.js), calls the
 * Voyage AI embeddings API for each chunk, and writes content/embeddings.json
 * — the file your serverless RAG endpoint loads at query time.
 *
 * Requires: VOYAGE_API_KEY environment variable
 * (get one free at https://dash.voyageai.com)
 *
 * Run: VOYAGE_API_KEY=your_key node scripts/generate-embeddings.js
 * Output: content/embeddings.json
 *
 * Cost note: voyage-3-lite is cheap and plenty for ~13 modules worth of
 * chunks (likely under a few hundred short chunks). Batches of 100 per
 * request keep this to a small handful of API calls total.
 */

const fs = require("fs");
const path = require("path");

const CHUNKS_PATH = path.join(__dirname, "..", "content", "chunks.json");
const OUTPUT_PATH = path.join(__dirname, "..", "content", "embeddings.json");
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY;
const MODEL = "voyage-4-lite";
const BATCH_SIZE = 10; // small batches to stay under the 10K TPM cap that applies with no payment method on file
const DELAY_MS = 15000; // ~15s between batches

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function embedBatch(texts, attempt = 1) {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: texts,
      model: MODEL,
      input_type: "document",
    }),
  });

  if (response.status === 429 && attempt <= 5) {
    const waitMs = DELAY_MS * attempt; // back off a bit more each retry
    console.log(`Rate limited, waiting ${waitMs / 1000}s before retry ${attempt}...`);
    await sleep(waitMs);
    return embedBatch(texts, attempt + 1);
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Voyage API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.data.map((d) => d.embedding);
}

async function main() {
  if (!VOYAGE_API_KEY) {
    console.error("Missing VOYAGE_API_KEY environment variable.");
    process.exit(1);
  }
  if (!fs.existsSync(CHUNKS_PATH)) {
    console.error(`chunks.json not found at ${CHUNKS_PATH}. Run chunk-modules.js first.`);
    process.exit(1);
  }

  const chunks = JSON.parse(fs.readFileSync(CHUNKS_PATH, "utf8"));
  const results = [];

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    console.log(`Embedding chunks ${i + 1}-${i + batch.length} of ${chunks.length}...`);
    const embeddings = await embedBatch(batch.map((c) => c.text));

    batch.forEach((chunk, idx) => {
      results.push({ ...chunk, embedding: embeddings[idx] });
    });

    if (i + BATCH_SIZE < chunks.length) {
      await sleep(DELAY_MS);
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results));
  console.log(`Wrote ${results.length} embedded chunks to ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
