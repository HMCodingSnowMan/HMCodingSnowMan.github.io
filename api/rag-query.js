/**
 * api/rag-query.js
 *
 * Vercel serverless function (Node runtime). POST { question: string }
 * -> { answer: string, sources: [{ moduleTitle, sectionTitle }] }
 *
 * Flow:
 *   1. Embed the incoming question with Voyage AI.
 *   2. Brute-force cosine similarity against the pre-computed embeddings
 *      in content/embeddings.json (fine at this scale — a few hundred
 *      chunks, no vector DB needed).
 *   3. Take the top K chunks, stuff them into a Claude API call as
 *      grounding context, and return the answer plus which modules it
 *      drew from.
 *
 * Env vars needed in Vercel project settings:
 *   VOYAGE_API_KEY
 *   ANTHROPIC_API_KEY
 */

const fs = require("fs");
const path = require("path");

const EMBEDDINGS_PATH = path.join(process.cwd(), "content", "embeddings.json");
const TOP_K = 5;
const VOYAGE_MODEL = "voyage-4-lite";
const CLAUDE_MODEL = "claude-sonnet-4-6";

let cachedEmbeddings = null;
function loadEmbeddings() {
  if (!cachedEmbeddings) {
    cachedEmbeddings = JSON.parse(fs.readFileSync(EMBEDDINGS_PATH, "utf8"));
  }
  return cachedEmbeddings;
}

function cosineSimilarity(a, b) {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function embedQuery(question) {
  const response = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      input: [question],
      model: VOYAGE_MODEL,
      input_type: "query",
    }),
  });
  if (!response.ok) throw new Error(`Voyage embed error: ${await response.text()}`);
  const data = await response.json();
  return data.data[0].embedding;
}

async function askClaude(question, contextChunks, apiKey) {
  const contextBlock = contextChunks
    .map((c, i) => `[${i + 1}] (${c.moduleTitle} — ${c.sectionTitle})\n${c.text}`)
    .join("\n\n");

  const systemPrompt = `You answer questions about the "Learn Claude" module series using ONLY the excerpts provided below. If the excerpts don't contain the answer, say so plainly rather than guessing. Cite which module each part of your answer comes from.

EXCERPTS:
${contextBlock}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error: ${await response.text()}`);
  const data = await response.json();
  return data.content.map((block) => (block.type === "text" ? block.text : "")).join("\n");
}

// Fallback used when no visitor-supplied key is present: no Claude call,
// just the raw retrieved excerpts, lightly formatted. Costs nothing.
function buildExcerptFallback(contextChunks) {
  const body = contextChunks
    .map((c, i) => `${i + 1}. From "${c.moduleTitle}" (${c.sectionTitle}):\n${c.text}`)
    .join("\n\n");
  return `Here are the closest matching passages (add your own Anthropic API key above for a synthesized answer instead):\n\n${body}`;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  const { question, apiKey } = req.body || {};
  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "Missing 'question' string in request body" });
    return;
  }

  // A visitor-supplied key is used only for this single request and is
  // never logged, stored, or written anywhere.
  const usingVisitorKey = typeof apiKey === "string" && apiKey.trim().length > 0;

  try {
    const embeddings = loadEmbeddings();
    const queryVector = await embedQuery(question);

    const scored = embeddings
      .map((chunk) => ({ chunk, score: cosineSimilarity(queryVector, chunk.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);

    const topChunks = scored.map((s) => s.chunk);

    let answer;
    if (usingVisitorKey) {
      answer = await askClaude(question, topChunks, apiKey.trim());
    } else {
      answer = buildExcerptFallback(topChunks);
    }

    const sources = [...new Map(
      topChunks.map((c) => [c.moduleTitle, { moduleTitle: c.moduleTitle, sectionTitle: c.sectionTitle }])
    ).values()];

    res.status(200).json({ answer, sources, mode: usingVisitorKey ? "generated" : "excerpts" });
  } catch (err) {
    console.error(err);
    // If a bad visitor key caused the failure, fall back to excerpts rather
    // than a bare error.
    if (usingVisitorKey) {
      try {
        const embeddings = loadEmbeddings();
        const queryVector = await embedQuery(question);
        const topChunks = embeddings
          .map((chunk) => ({ chunk, score: cosineSimilarity(queryVector, chunk.embedding) }))
          .sort((a, b) => b.score - a.score)
          .slice(0, TOP_K)
          .map((s) => s.chunk);
        res.status(200).json({
          answer: `Your API key didn't work, so here are the closest matching excerpts instead:\n\n${buildExcerptFallback(topChunks)}`,
          sources: [],
          mode: "excerpts",
        });
        return;
      } catch (_) {
        // fall through to generic error below
      }
    }
    res.status(500).json({ error: "Something went wrong answering that question." });
  }
};
