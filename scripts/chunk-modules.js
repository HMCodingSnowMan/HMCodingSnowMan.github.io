/**
 * chunk-modules.js
 *
 * Reads every .md file in content/learn-claude-modules/, splits each one
 * into chunks by heading section (## Lesson, ## Try It, etc.), and writes
 * a single chunks.json file that the embedding script consumes.
 *
 * Expected module file format (front matter + markdown):
 *
 *   ---
 *   id: 101
 *   title: What Are Hallucinations
 *   ---
 *
 *   ## Lesson
 *   ...text...
 *
 *   ## Try It
 *   ...text...
 *
 * Run: node scripts/chunk-modules.js
 * Output: content/chunks.json
 */

const fs = require("fs");
const path = require("path");

const MODULES_DIR = path.join(__dirname, "..", "content", "learn-claude-modules");
const OUTPUT_PATH = path.join(__dirname, "..", "content", "chunks.json");

// Naive front-matter parser: pulls out `---\nkey: value\n---` block.
function parseFrontMatter(raw) {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta = {};
  for (const line of match[1].split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }
  return { meta, body: match[2] };
}

// Splits a module body into chunks at each "## Heading" boundary.
// Chunks longer than MAX_CHARS are further split on paragraph breaks.
const MAX_CHARS = 1200;

function splitIntoSections(body) {
  const parts = body.split(/\n(?=## )/g).map((s) => s.trim()).filter(Boolean);
  return parts;
}

function splitLongSection(text) {
  if (text.length <= MAX_CHARS) return [text];
  const paragraphs = text.split(/\n\n+/);
  const chunks = [];
  let current = "";
  for (const p of paragraphs) {
    if ((current + "\n\n" + p).length > MAX_CHARS && current) {
      chunks.push(current.trim());
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current.trim());
  return chunks;
}

function main() {
  if (!fs.existsSync(MODULES_DIR)) {
    console.error(`Modules directory not found: ${MODULES_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(MODULES_DIR).filter((f) => f.endsWith(".md"));
  if (files.length === 0) {
    console.error(`No .md files found in ${MODULES_DIR}`);
    process.exit(1);
  }

  const chunks = [];
  let chunkCounter = 0;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(MODULES_DIR, file), "utf8");
    const { meta, body } = parseFrontMatter(raw);
    const moduleId = meta.id || file.replace(".md", "");
    const moduleTitle = meta.title || file.replace(".md", "");

    const sections = splitIntoSections(body);
    for (const section of sections) {
      const headingMatch = section.match(/^##\s+(.+)/);
      const sectionTitle = headingMatch ? headingMatch[1].trim() : "Intro";
      const sectionText = section.replace(/^##\s+.+\n?/, "").trim();
      if (!sectionText) continue;

      for (const piece of splitLongSection(sectionText)) {
        chunkCounter += 1;
        chunks.push({
          chunkId: `${moduleId}-${chunkCounter}`,
          moduleId,
          moduleTitle,
          sectionTitle,
          text: piece,
        });
      }
    }
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(chunks, null, 2));
  console.log(`Wrote ${chunks.length} chunks from ${files.length} modules to ${OUTPUT_PATH}`);
}

main();
