// Trovai · build-agent-skills.mjs
// Houdt de sha256-digests in /.well-known/agent-skills/index.json in sync met
// de daadwerkelijke SKILL.md-bestanden (Agent Skills Discovery RFC v0.2.0:
// digest-formaat "sha256:{hex}"). Draait als tweede stap in de Netlify-build,
// na build-listings.mjs. Faalt bewust nooit: een digest-mismatch mag een
// deploy niet blokkeren — dit script herstelt hem juist.

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const INDEX = join(ROOT, ".well-known", "agent-skills", "index.json");
const SITE = "https://trovai.nl";

try {
  const index = JSON.parse(readFileSync(INDEX, "utf8"));
  let changed = 0;
  for (const skill of index.skills || []) {
    if (!skill.url || !skill.url.startsWith(SITE + "/")) continue;
    const relPath = skill.url.slice(SITE.length + 1); // bv. .well-known/agent-skills/trovai-listings/SKILL.md
    let bytes;
    try {
      bytes = readFileSync(join(ROOT, ...relPath.split("/")));
    } catch {
      console.warn(`  ⚠ agent-skills: bestand ontbreekt voor ${skill.name} (${relPath})`);
      continue;
    }
    const digest = "sha256:" + createHash("sha256").update(bytes).digest("hex");
    if (skill.digest !== digest) {
      skill.digest = digest;
      changed++;
    }
  }
  if (changed > 0) {
    writeFileSync(INDEX, JSON.stringify(index, null, 2) + "\n");
    console.log(`agent-skills: ${changed} digest(s) bijgewerkt in index.json`);
  } else {
    console.log("agent-skills: digests al in sync");
  }
} catch (err) {
  console.warn("agent-skills: overgeslagen —", err.message);
}
process.exit(0);
