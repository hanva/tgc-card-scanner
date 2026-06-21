/**
 * Génère le dataset embarqué dans l'app (src/data/market-<seller>.json) depuis l'état du
 * scraper (scripts/output/cardmarket-<seller>-state.json). À relancer après chaque session de
 * scraping pour rafraîchir ce que l'app affiche.
 *
 * Usage: npx tsx scripts/build-market-data.ts [seller=Cobaltia]
 */
import * as fs from "fs";
import * as path from "path";

const seller = process.argv[2] || "Cobaltia";
const ROOT = path.join(__dirname, "..");
const statePath = path.join(ROOT, `scripts/output/cardmarket-${seller}-state.json`);

if (!fs.existsSync(statePath)) {
  console.error(`État introuvable: ${path.relative(ROOT, statePath)} (lance d'abord le scraper).`);
  process.exit(1);
}

const s = JSON.parse(fs.readFileSync(statePath, "utf-8")) as {
  doneIds: string[];
  cards: { isMatched: boolean; matched: { archetypes: string[]; characters: string[] } | null }[];
};

const byArchetype: Record<string, number> = {};
const byCharacter: Record<string, number> = {};
for (const c of s.cards) {
  if (!c.matched) continue;
  for (const a of c.matched.archetypes || []) byArchetype[a] = (byArchetype[a] || 0) + 1;
  for (const ch of c.matched.characters || []) byCharacter[ch] = (byCharacter[ch] || 0) + 1;
}

const out = {
  seller,
  source: "cardmarket",
  partial: true,
  editionsDone: s.doneIds.length,
  total: s.cards.length,
  totalMatched: s.cards.filter((c) => c.isMatched).length,
  byArchetype,
  byCharacter,
  cards: s.cards,
};

const outPath = path.join(ROOT, `src/data/market-${seller.toLowerCase()}.json`);
fs.writeFileSync(outPath, JSON.stringify(out), "utf-8");
console.log(`✓ ${path.relative(ROOT, outPath)} — ${out.total} cartes, ${out.totalMatched} matchées, ${Object.keys(byArchetype).length} archétypes, ${out.editionsDone} éditions`);
