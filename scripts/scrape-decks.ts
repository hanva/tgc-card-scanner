/**
 * Script to scrape all character decks from Yugipedia
 * and generate a complete character-cards.json
 *
 * Usage: npx tsx scripts/scrape-decks.ts
 */

const API_BASE = "https://yugipedia.com/api.php";
const YGOPRODECK_BASE = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

// All DM + GX characters and their Yugipedia page names for decks
const CHARACTERS: {
  id: string;
  name: string;
  nameFr: string;
  series: "DM" | "GX";
  wikiPages: string[]; // Yugipedia deck pages to scrape
}[] = [
  // DM
  {
    id: "yami-yugi",
    name: "Yami Yugi",
    nameFr: "Yami Yugi",
    series: "DM",
    wikiPages: ["Yami_Yugi's_Decks"],
  },
  {
    id: "yugi",
    name: "Yugi Muto",
    nameFr: "Yugi Muto",
    series: "DM",
    wikiPages: ["Yugi_Muto's_Decks"],
  },
  {
    id: "seto-kaiba",
    name: "Seto Kaiba",
    nameFr: "Seto Kaiba",
    series: "DM",
    wikiPages: ["Seto_Kaiba's_Decks"],
  },
  {
    id: "joey-wheeler",
    name: "Joey Wheeler",
    nameFr: "Joey Wheeler",
    series: "DM",
    wikiPages: ["Joey_Wheeler's_Decks"],
  },
  {
    id: "mai-valentine",
    name: "Mai Valentine",
    nameFr: "Mai Valentine",
    series: "DM",
    wikiPages: ["Mai_Valentine's_Decks"],
  },
  {
    id: "pegasus",
    name: "Maximillion Pegasus",
    nameFr: "Maximillion Pegasus",
    series: "DM",
    wikiPages: ["Maximillion_Pegasus's_Decks"],
  },
  {
    id: "bakura",
    name: "Yami Bakura",
    nameFr: "Yami Bakura",
    series: "DM",
    wikiPages: ["Yami_Bakura's_Decks"],
  },
  {
    id: "yami-marik",
    name: "Yami Marik",
    nameFr: "Yami Marik",
    series: "DM",
    wikiPages: ["Yami_Marik's_Decks"],
  },
  {
    id: "weevil",
    name: "Weevil Underwood",
    nameFr: "Insector Haga",
    series: "DM",
    wikiPages: ["Weevil_Underwood's_Decks"],
  },
  {
    id: "rex",
    name: "Rex Raptor",
    nameFr: "Rex Raptor",
    series: "DM",
    wikiPages: ["Rex_Raptor's_Decks"],
  },
  {
    id: "mako",
    name: "Mako Tsunami",
    nameFr: "Mako Tsunami",
    series: "DM",
    wikiPages: ["Mako_Tsunami's_Decks"],
  },
  {
    id: "bandit-keith",
    name: "Bandit Keith",
    nameFr: "Bandit Keith",
    series: "DM",
    wikiPages: ["Bandit_Keith's_Decks"],
  },
  {
    id: "ishizu",
    name: "Ishizu Ishtar",
    nameFr: "Ishizu Ishtar",
    series: "DM",
    wikiPages: ["Ishizu_Ishtar's_Decks"],
  },
  {
    id: "odion",
    name: "Odion",
    nameFr: "Odion",
    series: "DM",
    wikiPages: ["Odion's_Decks"],
  },
  {
    id: "arkana",
    name: "Arkana",
    nameFr: "Arkana",
    series: "DM",
    wikiPages: ["Arkana's_Decks"],
  },
  {
    id: "tea-gardner",
    name: "Tea Gardner",
    nameFr: "Anzu Mazaki",
    series: "DM",
    wikiPages: ["Téa_Gardner's_Decks"],
  },
  // GX
  {
    id: "jaden-yuki",
    name: "Jaden Yuki",
    nameFr: "Jaden Yuki",
    series: "GX",
    wikiPages: ["Jaden_Yuki's_Decks"],
  },
  {
    id: "alexis-rhodes",
    name: "Alexis Rhodes",
    nameFr: "Alexia Rhodes",
    series: "GX",
    wikiPages: ["Alexis_Rhodes's_Decks"],
  },
  {
    id: "chazz-princeton",
    name: "Chazz Princeton",
    nameFr: "Chazz Princeton",
    series: "GX",
    wikiPages: ["Chazz_Princeton's_Decks"],
  },
  {
    id: "zane-truesdale",
    name: "Zane Truesdale",
    nameFr: "Zane Truesdale",
    series: "GX",
    wikiPages: ["Zane_Truesdale's_Decks"],
  },
  {
    id: "syrus-truesdale",
    name: "Syrus Truesdale",
    nameFr: "Syrus Truesdale",
    series: "GX",
    wikiPages: ["Syrus_Truesdale's_Decks"],
  },
  {
    id: "bastion-misawa",
    name: "Bastion Misawa",
    nameFr: "Bastion Misawa",
    series: "GX",
    wikiPages: ["Bastion_Misawa's_Decks"],
  },
  {
    id: "aster-phoenix",
    name: "Aster Phoenix",
    nameFr: "Aster Phoenix",
    series: "GX",
    wikiPages: ["Aster_Phoenix's_Decks"],
  },
  {
    id: "jesse-anderson",
    name: "Jesse Anderson",
    nameFr: "Jesse Anderson",
    series: "GX",
    wikiPages: ["Jesse_Anderson's_Decks"],
  },
  {
    id: "axel-brodie",
    name: "Axel Brodie",
    nameFr: "Axel Brodie",
    series: "GX",
    wikiPages: ["Axel_Brodie's_Decks"],
  },
  {
    id: "crowler",
    name: "Dr. Vellian Crowler",
    nameFr: "Dr. Crowler",
    series: "GX",
    wikiPages: ["Vellian_Crowler's_Decks"],
  },
  {
    id: "yubel",
    name: "Yubel",
    nameFr: "Yubel",
    series: "GX",
    wikiPages: ["Yubel_(character)'s_Decks"],
  },
  {
    id: "sartorius",
    name: "Sartorius",
    nameFr: "Sartorius",
    series: "GX",
    wikiPages: ["Sartorius's_Decks"],
  },
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Fetch a Yugipedia deck page and extract card names
 */
async function fetchDeckPage(pageName: string): Promise<string[]> {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    if (json.error) {
      console.log(`  Page not found: ${pageName}`);
      return [];
    }
    const wikitext: string = json.parse?.wikitext?.["*"] || "";

    // Extract card names from wiki links like [[Dark Magician]]
    const cardNames = new Set<string>();
    const linkRegex = /\[\[([^\]|]+?)(?:\|[^\]]+?)?\]\]/g;
    let match;
    while ((match = linkRegex.exec(wikitext)) !== null) {
      const name = match[1].trim();
      // Filter out non-card links
      if (
        name.includes("Deck") ||
        name.includes("Category") ||
        name.includes("Episode") ||
        name.includes("File:") ||
        name.includes("Image:") ||
        name.includes("Yu-Gi-Oh!") ||
        name.includes("'s ") ||
        name.startsWith("#") ||
        name.length < 3
      ) {
        continue;
      }
      cardNames.add(name);
    }

    return [...cardNames];
  } catch (e) {
    console.error(`Error fetching ${pageName}:`, e);
    return [];
  }
}

/**
 * Look up a card name on YGOProDeck to get its ID
 */
async function lookupCardId(
  cardName: string
): Promise<{ id: number; name: string } | null> {
  const url = `${YGOPRODECK_BASE}?name=${encodeURIComponent(cardName)}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const card = json.data?.[0];
    if (!card) return null;
    return { id: card.id, name: card.name };
  } catch {
    return null;
  }
}

async function main() {
  console.log("🎴 Scraping Yu-Gi-Oh character decks from Yugipedia...\n");

  const allCharacters: typeof CHARACTERS = [];
  const allMappings: {
    characterId: string;
    cardIds: number[];
    cardNames: string[];
    context: string;
  }[] = [];

  for (const char of CHARACTERS) {
    console.log(`\n=== ${char.name} (${char.series}) ===`);
    allCharacters.push(char);

    const allCardNames = new Set<string>();

    for (const page of char.wikiPages) {
      const names = await fetchDeckPage(page);
      console.log(`  ${page}: ${names.length} card links found`);
      names.forEach((n) => allCardNames.add(n));
      await sleep(500); // Be nice to the API
    }

    // Resolve card IDs
    const cardIds: number[] = [];
    const resolvedNames: string[] = [];
    let resolved = 0;
    let failed = 0;

    for (const name of allCardNames) {
      const result = await lookupCardId(name);
      if (result) {
        if (!cardIds.includes(result.id)) {
          cardIds.push(result.id);
          resolvedNames.push(result.name);
          resolved++;
        }
      } else {
        failed++;
      }
      // Rate limit: ~10 req/s
      await sleep(100);
    }

    console.log(
      `  Resolved: ${resolved} cards, Failed: ${failed} lookups`
    );

    if (cardIds.length > 0) {
      allMappings.push({
        characterId: char.id,
        cardIds,
        cardNames: resolvedNames,
        context: "anime",
      });
    }
  }

  // Output JSON
  const output = {
    version: 4,
    lastUpdated: new Date().toISOString().split("T")[0],
    characters: allCharacters.map((c) => ({
      id: c.id,
      name: c.name,
      nameFr: c.nameFr,
      series: c.series,
    })),
    mappings: allMappings,
  };

  const fs = await import("fs");
  const path = await import("path");
  const outPath = path.resolve(__dirname, "../src/data/character-cards.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(
    `\n✅ Done! Written ${allCharacters.length} characters with ${allMappings.reduce((s, m) => s + m.cardIds.length, 0)} total card mappings`
  );
  console.log(`Output: src/data/character-cards.json`);
}

main().catch(console.error);
