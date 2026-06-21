/**
 * Script to build a local mapping of archetype → card names.
 *
 * Primary source: YGOProDeck API (has archetype data for most archetypes)
 * Fallback: Yu-Gi-Oh Fandom wiki scraping for archetypes not in YGOProDeck
 *
 * Usage: npx tsx scripts/scrape-archetype-cards.ts
 */

import * as fs from "fs";
import * as path from "path";

const YGOPRODECK_API =
  "https://db.ygoprodeck.com/api/v7/cardinfo.php?archetype=";
const ARCHETYPES_LIST_API = "https://db.ygoprodeck.com/api/v7/archetypes.php";
const FNAME_API = "https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=";
const FANDOM_API =
  "https://yugioh.fandom.com/api.php?action=parse&prop=wikitext&format=json&page=";

// Archétypes curés liés à nos persos (toujours inclus) + extras hors liste officielle.
const archetypeCharsPath = path.join(
  __dirname,
  "../src/data/archetype-characters.json"
);
const archetypeChars = JSON.parse(fs.readFileSync(archetypeCharsPath, "utf-8"));
const curatedArchetypes = Object.keys(archetypeChars.archetypeMap);
const extraArchetypes = [
  "Destruction Sword",
  "Fossil",
  "Slime",
  "Face Card Knights",
];

/**
 * Groupes NON reconnus comme archétypes par YGOProDeck mais qu'on veut quand même matcher.
 * `names` = liste explicite ; `fname` = recherche par sous-chaîne de nom.
 */
const NON_OFFICIAL_GROUPS: Record<string, { names?: string[]; fname?: string }> = {
  "Aitsu/Koitsu": { names: ["Aitsu", "Koitsu", "Soitsu", "Doitsu"] },
};

/** Récupère la liste complète des archétypes officiels depuis YGOProDeck. */
async function fetchAllArchetypeNames(): Promise<string[]> {
  try {
    const res = await fetch(ARCHETYPES_LIST_API);
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map((x: { archetype_name: string }) => x.archetype_name);
  } catch {
    return [];
  }
}

async function fetchByFname(term: string): Promise<string[]> {
  try {
    const res = await fetch(`${FNAME_API}${encodeURIComponent(term)}`);
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error) return [];
    return (data.data || []).map((c: { name: string }) => c.name);
  } catch {
    return [];
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── YGOProDeck API ──────────────────────────────────────────────────────────

async function fetchFromYGOProDeck(archetype: string): Promise<string[]> {
  const url = `${YGOPRODECK_API}${encodeURIComponent(archetype)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return [];

    const data = await response.json();
    if (data.error) return [];

    const cards: string[] = (data.data || []).map(
      (card: { name: string }) => card.name
    );
    return cards;
  } catch {
    return [];
  }
}

// ─── Fandom Wiki Fallback ────────────────────────────────────────────────────

/**
 * Extract card names from wikitext.
 * Looks for cards in Decklist templates and [[Card Name]] links in relevant sections.
 */
function extractCardNamesFromWikitext(wikitext: string): string[] {
  const cards = new Set<string>();

  // Extract from Decklist templates and general content
  const linkRegex = /\[\[([^\]|#]+)(?:\|[^\]]+)?\]\]/g;
  let match;

  // Track if we're in a relevant section
  const lines = wikitext.split("\n");
  let inRelevantSection = false;
  let sectionDepth = 0;

  for (const line of lines) {
    // Detect section headings
    const headingMatch = line.match(/^(={2,})\s*(.+?)\s*={2,}/);
    if (headingMatch) {
      const depth = headingMatch[1].length;
      const title = headingMatch[2]
        .replace(/\[\[|\]\]/g, "")
        .replace(/'''/g, "")
        .toLowerCase();

      // Relevant sections for card names
      const relevantTitles = [
        "members",
        "support",
        "recommended cards",
        "playing style",
        "official deck",
        "card list",
      ];

      if (relevantTitles.some((t) => title.includes(t))) {
        inRelevantSection = true;
        sectionDepth = depth;
      } else if (depth <= sectionDepth) {
        inRelevantSection = false;
      }
      continue;
    }

    // Also always extract from Decklist template lines
    const isDecklistLine =
      line.includes("|") &&
      (line.includes("monsters") ||
        line.includes("spells") ||
        line.includes("traps") ||
        line.includes("ritual") ||
        line.includes("fusion") ||
        line.includes("synchro") ||
        line.includes("xyz") ||
        line.includes("link") ||
        line.includes("pendulum"));

    if (inRelevantSection || isDecklistLine || line.startsWith("*")) {
      while ((match = linkRegex.exec(line)) !== null) {
        const cardName = match[1].trim();
        if (isValidCardName(cardName)) {
          cards.add(cardName);
        }
      }
    }
  }

  return [...cards];
}

function isValidCardName(name: string): boolean {
  if (name.length <= 1) return false;
  const invalidPrefixes = [
    "Category:",
    "File:",
    ":",
    "List of",
    "w:",
    "wikipedia:",
  ];
  const invalidContents = [
    "(archetype)",
    "(series)",
    "Deck",
    "Booster",
    "Structure Deck",
    "archseries",
    "Card Gallery",
    "Card Appearances",
    "Card Tips",
    "Card Trivia",
    "Card Lores",
    "Card Rulings",
    "Card Names",
    "Card Artworks",
  ];

  for (const prefix of invalidPrefixes) {
    if (name.toLowerCase().startsWith(prefix.toLowerCase())) return false;
  }
  for (const content of invalidContents) {
    if (name.includes(content)) return false;
  }
  return true;
}

async function fetchFromFandom(archetype: string): Promise<string[]> {
  const pageName = archetype.replace(/ /g, "_");
  const pagesToTry = [pageName, `${pageName}_(archetype)`];

  for (const page of pagesToTry) {
    const url = `${FANDOM_API}${encodeURIComponent(page)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;

      const data = await response.json();
      if (data.error) continue;

      const wikitext = data.parse?.wikitext?.["*"] || "";
      const cards = extractCardNamesFromWikitext(wikitext);

      if (cards.length > 0) {
        return cards;
      }
    } catch {
      // Try next page
    }
    await delay(200);
  }

  return [];
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // UNIQUEMENT les archétypes officiels YGOProDeck (aucune fabrication par nom / wiki).
  const allArchetypes = await fetchAllArchetypeNames();
  console.log(`Building archetype card mapping for ${allArchetypes.length} archétypes officiels...\n`);

  const result: Record<string, string[]> = {};
  const failedArchetypes: string[] = [];

  for (const archetype of allArchetypes) {
    process.stdout.write(`Processing: ${archetype}...`);
    const cards = await fetchFromYGOProDeck(archetype); // source officielle uniquement
    await delay(150);
    if (cards.length > 0) {
      console.log(` ${cards.length} cards`);
      result[archetype] = cards.sort();
    } else {
      console.log(` NO CARDS`);
      failedArchetypes.push(archetype);
    }
  }

  // Write the result
  const outputPath = path.join(__dirname, "../src/data/archetype-cards.json");
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n", "utf-8");

  console.log(
    `\nDone! Wrote ${Object.keys(result).length} archetypes to ${outputPath}`
  );

  const totalCards = Object.values(result).reduce(
    (sum, cards) => sum + cards.length,
    0
  );
  console.log(`Total cards across all archetypes: ${totalCards}`);

  if (failedArchetypes.length > 0) {
    console.log(`\nArchetypes with no cards found (${failedArchetypes.length}):`);
    failedArchetypes.forEach((a) => console.log(`  - ${a}`));
  }
}

main().catch(console.error);
