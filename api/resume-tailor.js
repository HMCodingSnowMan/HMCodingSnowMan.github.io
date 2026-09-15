// api/resume-tailor.js
//
// Resume Tailoring Agent — a 4-step agentic chain over the Anthropic API.
// Each step is a separate Claude call, orchestrated server-side, with
// state (the job posting's requirements, the comparison result) passed
// forward from one step to the next.
//
// BYO API key pattern: the key is sent from the client per-request and
// is never stored or logged server-side.

const MODEL = "claude-sonnet-4-6";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";

async function callClaude(apiKey, systemPrompt, userContent, maxTokens = 1024) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${errBody}`);
  }

  const data = await res.json();
  const textBlock = data.content.find((b) => b.type === "text");
  return {
    text: textBlock ? textBlock.text : "",
    usage: data.usage || null,
  };
}

function extractJson(text) {
  // Models sometimes wrap JSON in ```json fences despite instructions — strip them.
  const cleaned = text.replace(/```json\s*|\s*```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Failed to parse model output as JSON: " + cleaned.slice(0, 300));
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { apiKey, jobPosting, resume } = req.body || {};

  if (!apiKey || !jobPosting || !resume) {
    return res.status(400).json({
      error: "Missing required fields: apiKey, jobPosting, resume",
    });
  }

  const usageTotals = { input_tokens: 0, output_tokens: 0 };
  const trackUsage = (u) => {
    if (!u) return;
    usageTotals.input_tokens += u.input_tokens || 0;
    usageTotals.output_tokens += u.output_tokens || 0;
  };

  try {
    // ---- Step 1: Extract structured requirements from the job posting ----
    const step1 = await callClaude(
      apiKey,
      `You extract structured requirements from job postings. Respond with ONLY valid JSON, no markdown fences, no preamble. Schema:
{
  "role_title": string,
  "must_have_keywords": string[],
  "nice_to_have_keywords": string[],
  "core_responsibilities": string[]
}`,
      `Job posting:\n\n${jobPosting}`,
      1024
    );
    trackUsage(step1.usage);
    const requirements = extractJson(step1.text);

    // ---- Step 2: Compare requirements against the resume ----
    const step2 = await callClaude(
      apiKey,
      `You compare a resume against a job posting's requirements. Respond with ONLY valid JSON, no markdown fences, no preamble. Schema:
{
  "covered": string[],
  "weak": [{ "requirement": string, "why_weak": string }],
  "missing": string[]
}
"weak" means the resume touches on it but doesn't make it clear or quantified. "missing" means it's genuinely absent. Do not invent resume content — base this only on what's actually written.`,
      `Requirements:\n${JSON.stringify(requirements, null, 2)}\n\nResume:\n\n${resume}`,
      1024
    );
    trackUsage(step2.usage);
    const comparison = extractJson(step2.text);

    // ---- Step 3: Suggest truthful bullet point rewrites ----
    const step3 = await callClaude(
      apiKey,
      `You rewrite resume bullet points to better align with a job posting's requirements. Hard rule: you may only rephrase, reorder, or emphasize things that are ALREADY TRUE in the original resume. Never invent skills, tools, metrics, or experience that aren't already present. If a requirement is genuinely missing from the resume, do not fabricate a bullet for it — instead note it in "unresolvable_gaps".

Respond with ONLY valid JSON, no markdown fences, no preamble. Schema:
{
  "rewrites": [
    { "original": string, "revised": string, "targets": string[] }
  ],
  "unresolvable_gaps": string[]
}`,
      `Requirements:\n${JSON.stringify(requirements, null, 2)}\n\nGap analysis:\n${JSON.stringify(comparison, null, 2)}\n\nOriginal resume:\n\n${resume}`,
      1536
    );
    trackUsage(step3.usage);
    const rewrites = extractJson(step3.text);

    // ---- Step 4: Short rationale for each change ----
    const step4 = await callClaude(
      apiKey,
      `You write brief, plain-language rationales explaining why each resume bullet rewrite was made, referencing which job requirement it addresses. One to two sentences per rewrite, no fluff. Respond with ONLY valid JSON, no markdown fences, no preamble. Schema:
{
  "rationales": [ { "revised": string, "rationale": string } ]
}`,
      `Rewrites:\n${JSON.stringify(rewrites.rewrites, null, 2)}\n\nRequirements they should map to:\n${JSON.stringify(requirements, null, 2)}`,
      1024
    );
    trackUsage(step4.usage);
    const rationales = extractJson(step4.text);

    return res.status(200).json({
      requirements,
      comparison,
      rewrites: rewrites.rewrites,
      unresolvable_gaps: rewrites.unresolvable_gaps,
      rationales: rationales.rationales,
      usage: usageTotals,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
