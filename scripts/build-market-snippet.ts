/**
 * Génère le snippet de scraping marketplace (console / WebView) à partir de NOS données.
 * Le matching est 100% local via une map cible normalisée injectée dans le snippet.
 *
 * Usage:
 *   npx tsx scripts/build-market-snippet.ts            # → scripts/output/cardmarket-snippet.js
 *   npx tsx scripts/build-market-snippet.ts --site cardmarket
 */
import * as fs from "fs";
import * as path from "path";
import { ADAPTERS, MarketAdapter } from "./market/adapters";
import { buildSnippet } from "./market/snippet-template";
import { buildTargetMap } from "./market/targets";

const ROOT = path.join(__dirname, "..");
const OUTPUT_DIR = path.join(__dirname, "output");

function main() {
  const siteArg = process.argv.indexOf("--site");
  const siteId = siteArg !== -1 ? process.argv[siteArg + 1] : "cardmarket";
  const adapter: MarketAdapter | undefined = ADAPTERS.find((a) => a.id === siteId);
  if (!adapter) {
    console.error(`Adapter inconnu: "${siteId}". Dispo: ${ADAPTERS.map((a) => a.id).join(", ")}`);
    process.exit(1);
  }

  const { target, stats } = buildTargetMap(ROOT);
  const snippet = buildSnippet({ adapter, target });
  const banner =
    `/* Snippet marketplace généré — site: ${adapter.id}\n` +
    ` * Cible: ${stats.size} noms de cartes normalisés ` +
    `(${stats.archetypes} archétypes, ${stats.characters} personnages).\n` +
    ` * Stratégie: crawl par édition (idExpansion) + matching local, locale forcée /en/.\n` +
    ` *\n` +
    ` * CALIBRAGE : window.__MARKET_DEBUG__ = true;  puis colle ce fichier (valide 1 édition).\n` +
    ` * TEST      : window.__MARKET_HOST__ = { limit: 3 };  puis colle ce fichier.\n` +
    ` * RUN       : colle ce fichier tel quel → un JSON se télécharge (reprise auto via localStorage).\n` +
    ` * RESET     : window.__MARKET_RESET__ = true;  pour repartir de zéro.\n` +
    ` */\n`;

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${adapter.id}-snippet.js`);
  fs.writeFileSync(outPath, banner + snippet, "utf-8");

  // Asset importable par l'app mobile (injecté dans la WebView) — JSON gère l'échappement.
  const assetPath = path.join(ROOT, "src/data/market-snippet.json");
  fs.writeFileSync(assetPath, JSON.stringify({ adapter: adapter.id, snippet }), "utf-8");

  // Table de matching brute pour re-matcher en local dans l'app (sans re-scraper).
  const targetsPath = path.join(ROOT, "src/data/market-targets.json");
  fs.writeFileSync(targetsPath, JSON.stringify(target), "utf-8");

  console.log(`✓ Snippet écrit : ${path.relative(ROOT, outPath)}`);
  console.log(`✓ Asset app    : ${path.relative(ROOT, assetPath)}`);
  console.log(`  ${stats.size} noms cibles normalisés`);
  console.log(`  (archétypes: ${stats.archCardEntries} entrées, personnages: ${stats.charCardEntries} entrées avant fusion)`);
}

main();
