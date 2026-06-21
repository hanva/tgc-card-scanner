/**
 * Scrape all DM + GX episodes from Yu-Gi-Oh Fandom wiki
 * to build a complete character→cards mapping WITH episode info.
 *
 * Usage: npx tsx scripts/scrape-episodes.ts
 */

const FANDOM_API = "https://yugioh.fandom.com/api.php";
const YGOPRODECK = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

const CHAR_MAP: Record<string, { id: string; name: string; nameFr: string; series: "DM" | "GX" }> = {
  "yami yugi": { id: "yami-yugi", name: "Yami Yugi", nameFr: "Yami Yugi", series: "DM" },
  "yugi muto": { id: "yugi", name: "Yugi Muto", nameFr: "Yugi Muto", series: "DM" },
  "yugi": { id: "yugi", name: "Yugi Muto", nameFr: "Yugi Muto", series: "DM" },
  "seto kaiba": { id: "seto-kaiba", name: "Seto Kaiba", nameFr: "Seto Kaiba", series: "DM" },
  "kaiba": { id: "seto-kaiba", name: "Seto Kaiba", nameFr: "Seto Kaiba", series: "DM" },
  "joey wheeler": { id: "joey-wheeler", name: "Joey Wheeler", nameFr: "Joey Wheeler", series: "DM" },
  "joey": { id: "joey-wheeler", name: "Joey Wheeler", nameFr: "Joey Wheeler", series: "DM" },
  "mai valentine": { id: "mai-valentine", name: "Mai Valentine", nameFr: "Mai Valentine", series: "DM" },
  "mai": { id: "mai-valentine", name: "Mai Valentine", nameFr: "Mai Valentine", series: "DM" },
  "maximillion pegasus": { id: "pegasus", name: "Maximillion Pegasus", nameFr: "Maximillion Pegasus", series: "DM" },
  "pegasus": { id: "pegasus", name: "Maximillion Pegasus", nameFr: "Maximillion Pegasus", series: "DM" },
  "yami bakura": { id: "bakura", name: "Yami Bakura", nameFr: "Yami Bakura", series: "DM" },
  "bakura": { id: "bakura", name: "Yami Bakura", nameFr: "Yami Bakura", series: "DM" },
  "yami marik": { id: "yami-marik", name: "Yami Marik", nameFr: "Yami Marik", series: "DM" },
  "marik ishtar": { id: "yami-marik", name: "Yami Marik", nameFr: "Yami Marik", series: "DM" },
  "marik": { id: "yami-marik", name: "Yami Marik", nameFr: "Yami Marik", series: "DM" },
  "weevil underwood": { id: "weevil", name: "Weevil Underwood", nameFr: "Insector Haga", series: "DM" },
  "weevil": { id: "weevil", name: "Weevil Underwood", nameFr: "Insector Haga", series: "DM" },
  "rex raptor": { id: "rex", name: "Rex Raptor", nameFr: "Rex Raptor", series: "DM" },
  "rex": { id: "rex", name: "Rex Raptor", nameFr: "Rex Raptor", series: "DM" },
  "mako tsunami": { id: "mako", name: "Mako Tsunami", nameFr: "Mako Tsunami", series: "DM" },
  "mako": { id: "mako", name: "Mako Tsunami", nameFr: "Mako Tsunami", series: "DM" },
  "bandit keith": { id: "bandit-keith", name: "Bandit Keith", nameFr: "Bandit Keith", series: "DM" },
  "keith": { id: "bandit-keith", name: "Bandit Keith", nameFr: "Bandit Keith", series: "DM" },
  "ishizu ishtar": { id: "ishizu", name: "Ishizu Ishtar", nameFr: "Ishizu Ishtar", series: "DM" },
  "ishizu": { id: "ishizu", name: "Ishizu Ishtar", nameFr: "Ishizu Ishtar", series: "DM" },
  "odion": { id: "odion", name: "Odion", nameFr: "Odion", series: "DM" },
  "arkana": { id: "arkana", name: "Arkana", nameFr: "Arkana", series: "DM" },
  "téa gardner": { id: "tea-gardner", name: "Tea Gardner", nameFr: "Anzu Mazaki", series: "DM" },
  "tea gardner": { id: "tea-gardner", name: "Tea Gardner", nameFr: "Anzu Mazaki", series: "DM" },
  "téa": { id: "tea-gardner", name: "Tea Gardner", nameFr: "Anzu Mazaki", series: "DM" },
  "espa roba": { id: "espa-roba", name: "Espa Roba", nameFr: "Espa Roba", series: "DM" },
  "bonz": { id: "bonz", name: "Bonz", nameFr: "Bonz", series: "DM" },
  "dartz": { id: "dartz", name: "Dartz", nameFr: "Dartz", series: "DM" },
  "rafael": { id: "rafael", name: "Rafael", nameFr: "Rafael", series: "DM" },
  "valon": { id: "valon", name: "Valon", nameFr: "Valon", series: "DM" },
  "alister": { id: "alister", name: "Alister", nameFr: "Alister", series: "DM" },
  "zigfried von schroeder": { id: "zigfried", name: "Zigfried von Schroeder", nameFr: "Zigfried", series: "DM" },
  "zigfried": { id: "zigfried", name: "Zigfried von Schroeder", nameFr: "Zigfried", series: "DM" },
  "leon von schroeder": { id: "leon", name: "Leon von Schroeder", nameFr: "Leon", series: "DM" },
  "leon": { id: "leon", name: "Leon von Schroeder", nameFr: "Leon", series: "DM" },
  "duke devlin": { id: "duke-devlin", name: "Duke Devlin", nameFr: "Duke Devlin", series: "DM" },
  "jaden yuki": { id: "jaden-yuki", name: "Jaden Yuki", nameFr: "Jaden Yuki", series: "GX" },
  "jaden": { id: "jaden-yuki", name: "Jaden Yuki", nameFr: "Jaden Yuki", series: "GX" },
  "alexis rhodes": { id: "alexis-rhodes", name: "Alexis Rhodes", nameFr: "Alexia Rhodes", series: "GX" },
  "alexis": { id: "alexis-rhodes", name: "Alexis Rhodes", nameFr: "Alexia Rhodes", series: "GX" },
  "chazz princeton": { id: "chazz-princeton", name: "Chazz Princeton", nameFr: "Chazz Princeton", series: "GX" },
  "chazz": { id: "chazz-princeton", name: "Chazz Princeton", nameFr: "Chazz Princeton", series: "GX" },
  "zane truesdale": { id: "zane-truesdale", name: "Zane Truesdale", nameFr: "Zane Truesdale", series: "GX" },
  "zane": { id: "zane-truesdale", name: "Zane Truesdale", nameFr: "Zane Truesdale", series: "GX" },
  "syrus truesdale": { id: "syrus-truesdale", name: "Syrus Truesdale", nameFr: "Syrus Truesdale", series: "GX" },
  "syrus": { id: "syrus-truesdale", name: "Syrus Truesdale", nameFr: "Syrus Truesdale", series: "GX" },
  "bastion misawa": { id: "bastion-misawa", name: "Bastion Misawa", nameFr: "Bastion Misawa", series: "GX" },
  "bastion": { id: "bastion-misawa", name: "Bastion Misawa", nameFr: "Bastion Misawa", series: "GX" },
  "aster phoenix": { id: "aster-phoenix", name: "Aster Phoenix", nameFr: "Aster Phoenix", series: "GX" },
  "aster": { id: "aster-phoenix", name: "Aster Phoenix", nameFr: "Aster Phoenix", series: "GX" },
  "jesse anderson": { id: "jesse-anderson", name: "Jesse Anderson", nameFr: "Jesse Anderson", series: "GX" },
  "jesse": { id: "jesse-anderson", name: "Jesse Anderson", nameFr: "Jesse Anderson", series: "GX" },
  "axel brodie": { id: "axel-brodie", name: "Axel Brodie", nameFr: "Axel Brodie", series: "GX" },
  "axel": { id: "axel-brodie", name: "Axel Brodie", nameFr: "Axel Brodie", series: "GX" },
  "vellian crowler": { id: "crowler", name: "Dr. Vellian Crowler", nameFr: "Dr. Crowler", series: "GX" },
  "crowler": { id: "crowler", name: "Dr. Vellian Crowler", nameFr: "Dr. Crowler", series: "GX" },
  "dr. crowler": { id: "crowler", name: "Dr. Vellian Crowler", nameFr: "Dr. Crowler", series: "GX" },
  "tyranno hassleberry": { id: "tyranno-hassleberry", name: "Tyranno Hassleberry", nameFr: "Tyranno Hassleberry", series: "GX" },
  "hassleberry": { id: "tyranno-hassleberry", name: "Tyranno Hassleberry", nameFr: "Tyranno Hassleberry", series: "GX" },
  "chumley huffington": { id: "chumley", name: "Chumley Huffington", nameFr: "Chumley", series: "GX" },
  "chumley": { id: "chumley", name: "Chumley Huffington", nameFr: "Chumley", series: "GX" },
  "adrian gecko": { id: "adrian-gecko", name: "Adrian Gecko", nameFr: "Adrian Gecko", series: "GX" },
  "yubel": { id: "yubel", name: "Yubel", nameFr: "Yubel", series: "GX" },
  "sartorius": { id: "sartorius", name: "Sartorius", nameFr: "Sartorius", series: "GX" },
  "sartorius kumar": { id: "sartorius", name: "Sartorius", nameFr: "Sartorius", series: "GX" },
  "nightshroud": { id: "nightshroud", name: "Nightshroud", nameFr: "Nightshroud", series: "GX" },
  "camula": { id: "camula", name: "Camula", nameFr: "Camula", series: "GX" },
  "tania": { id: "tania", name: "Tania", nameFr: "Tania", series: "GX" },
  "don zaloog": { id: "don-zaloog", name: "Don Zaloog", nameFr: "Don Zaloog", series: "GX" },
  "titan": { id: "titan", name: "Titan", nameFr: "Titan", series: "GX" },
  "kagemaru": { id: "kagemaru", name: "Kagemaru", nameFr: "Kagemaru", series: "GX" },
  "amnael": { id: "amnael", name: "Amnael", nameFr: "Amnael", series: "GX" },
  "jim crocodile cook": { id: "jim-cook", name: "Jim Crocodile Cook", nameFr: "Jim Cook", series: "GX" },
  "jim": { id: "jim-cook", name: "Jim Crocodile Cook", nameFr: "Jim Cook", series: "GX" },
  "the supreme king": { id: "supreme-king", name: "The Supreme King", nameFr: "Le Roi Suprême", series: "GX" },
  "supreme king": { id: "supreme-king", name: "The Supreme King", nameFr: "Le Roi Suprême", series: "GX" },
};

const cardIdCache = new Map<string, number | null>();
async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

function cleanCardName(raw: string): string {
  return raw
    .replace(/\s*\(anime\)\s*/gi, "")
    .replace(/\s*\(later anime\)\s*/gi, "")
    .replace(/\s*\(second anime\)\s*/gi, "")
    .replace(/\s*\(Duel Links\)\s*/gi, "")
    .replace(/\s*\(card\)\s*/gi, "")
    .trim();
}

async function resolveCardId(name: string): Promise<number | null> {
  const cleaned = cleanCardName(name);
  if (cardIdCache.has(cleaned)) return cardIdCache.get(cleaned)!;
  try {
    const res = await fetch(`${YGOPRODECK}?name=${encodeURIComponent(cleaned)}`);
    if (!res.ok) { cardIdCache.set(cleaned, null); return null; }
    const json = await res.json();
    const id = json.data?.[0]?.id || null;
    cardIdCache.set(cleaned, id);
    return id;
  } catch { cardIdCache.set(cleaned, null); return null; }
}

interface EpisodeInfo {
  pageTitle: string;
  epNum: number;
  series: "DM" | "GX";
  title: string;
  url: string;
}

async function fetchEpisodeTitle(pageTitle: string): Promise<string> {
  const url = `${FANDOM_API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    const text: string = json?.parse?.wikitext?.["*"] || "";
    // Extract english title from {{Infobox episode or just the page title
    const match = text.match(/\|\s*(?:en_)?title\s*=\s*(.+?)[\n|]/);
    return match ? match[1].trim() : pageTitle.replace(/_/g, " ");
  } catch {
    return pageTitle.replace(/_/g, " ");
  }
}

function parseEpisode(wikitext: string): Map<string, Set<string>> {
  const result = new Map<string, Set<string>>();
  const fcMatch = wikitext.match(/==\s*Featured cards\s*==(.+?)(?:\n==|\Z)/s);
  if (!fcMatch) return result;
  const section = fcMatch[1];

  const decklistRegex = /\{\{Decklist\|([^}\n]+)/g;
  let match;
  const positions: { charName: string; start: number }[] = [];
  while ((match = decklistRegex.exec(section)) !== null) {
    positions.push({ charName: match[1].trim(), start: match.index });
  }

  for (let i = 0; i < positions.length; i++) {
    const { charName, start } = positions[i];
    const end = i + 1 < positions.length ? positions[i + 1].start : section.length;
    const block = section.substring(start, end);

    const charLower = charName.toLowerCase().replace(/'s deck.*$/i, "").replace(/'s duel disk.*$/i, "").trim();
    const charInfo = CHAR_MAP[charLower];
    if (!charInfo) continue;

    const cardRegex = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;
    let cardMatch;
    const cards = result.get(charInfo.id) || new Set<string>();
    while ((cardMatch = cardRegex.exec(block)) !== null) {
      const cardName = cardMatch[2] || cardMatch[1];
      const cleaned = cleanCardName(cardName);
      if (cleaned.length >= 3 && !cleaned.includes("Episode") && !cleaned.includes("TCG") && !cleaned.includes("OCG")) {
        cards.add(cleaned);
      }
    }
    result.set(charInfo.id, cards);
  }
  return result;
}

async function fetchEpisodeWikitext(pageTitle: string): Promise<string> {
  const url = `${FANDOM_API}?action=parse&page=${encodeURIComponent(pageTitle)}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url);
    const json = await res.json();
    return json?.parse?.wikitext?.["*"] || "";
  } catch { return ""; }
}

async function main() {
  console.log("🎴 Scraping Yu-Gi-Oh episode featured cards with episode info...\n");

  // charId → cardName → episodes[]
  const charCardEpisodes = new Map<string, Map<string, EpisodeInfo[]>>();
  // charId → Set<cardName>
  const charCards = new Map<string, Set<string>>();

  async function processEpisode(series: "DM" | "GX", epNum: number) {
    const prefix = series === "DM" ? "Yu-Gi-Oh!_-_Episode_" : "Yu-Gi-Oh!_GX_-_Episode_";
    const pageTitle = `${prefix}${String(epNum).padStart(3, "0")}`;
    const wikitext = await fetchEpisodeWikitext(pageTitle);

    // Get episode title
    const titleMatch = wikitext.match(/\|\s*(?:en_)?title\s*=\s*(.+?)[\n|]/);
    const epTitle = titleMatch ? titleMatch[1].trim().replace(/\[\[|\]\]/g, "") : `Episode ${epNum}`;
    const epUrl = `https://yugioh.fandom.com/wiki/${pageTitle}`;

    const episodeCards = parseEpisode(wikitext);

    for (const [charId, cards] of episodeCards) {
      const existing = charCards.get(charId) || new Set();
      cards.forEach(c => existing.add(c));
      charCards.set(charId, existing);

      // Store episode info per card
      const charEpMap = charCardEpisodes.get(charId) || new Map();
      for (const cardName of cards) {
        const eps = charEpMap.get(cardName) || [];
        eps.push({
          pageTitle,
          epNum,
          series,
          title: epTitle,
          url: epUrl,
        });
        charEpMap.set(cardName, eps);
      }
      charCardEpisodes.set(charId, charEpMap);
    }
  }

  // DM: 224 episodes
  console.log("=== Yu-Gi-Oh! Duel Monsters (224 episodes) ===");
  for (let ep = 1; ep <= 224; ep++) {
    await processEpisode("DM", ep);
    if (ep % 20 === 0) console.log(`  DM ep ${ep}/224`);
    await sleep(200);
  }

  // GX: 180 episodes
  console.log("\n=== Yu-Gi-Oh! GX (180 episodes) ===");
  for (let ep = 1; ep <= 180; ep++) {
    await processEpisode("GX", ep);
    if (ep % 20 === 0) console.log(`  GX ep ${ep}/180`);
    await sleep(200);
  }

  // Summary
  console.log("\n=== Card counts per character ===");
  for (const [charId, cards] of [...charCards.entries()].sort((a, b) => b[1].size - a[1].size)) {
    console.log(`  ${charId}: ${cards.size} unique cards`);
  }

  // Resolve card IDs
  console.log("\n=== Resolving card IDs ===");
  const allCardNames = new Set<string>();
  for (const cards of charCards.values()) cards.forEach(c => allCardNames.add(c));
  console.log(`Total unique card names: ${allCardNames.size}`);

  let resolved = 0, failed = 0;
  for (const name of allCardNames) {
    const id = await resolveCardId(name);
    if (id) resolved++; else failed++;
    await sleep(50);
    if ((resolved + failed) % 200 === 0) console.log(`  ${resolved + failed}/${allCardNames.size}`);
  }
  console.log(`  Done: ${resolved} resolved, ${failed} failed`);

  // Build character-cards.json
  const characters: any[] = [];
  const seenCharIds = new Set<string>();
  const mappings: any[] = [];

  for (const [charId, cardNames] of charCards) {
    const charInfo = Object.values(CHAR_MAP).find(c => c.id === charId);
    if (!charInfo) continue;
    if (!seenCharIds.has(charId)) {
      seenCharIds.add(charId);
      characters.push({ id: charInfo.id, name: charInfo.name, nameFr: charInfo.nameFr, series: charInfo.series });
    }

    const cardIds: number[] = [];
    const resolvedNames: string[] = [];
    for (const name of cardNames) {
      const id = cardIdCache.get(cleanCardName(name));
      if (id && !cardIds.includes(id)) {
        cardIds.push(id);
        resolvedNames.push(cleanCardName(name));
      }
    }

    if (cardIds.length > 0) {
      const existing = mappings.find((m: any) => m.characterId === charId);
      if (existing) {
        for (let i = 0; i < cardIds.length; i++) {
          if (!existing.cardIds.includes(cardIds[i])) {
            existing.cardIds.push(cardIds[i]);
            existing.cardNames.push(resolvedNames[i]);
          }
        }
      } else {
        mappings.push({ characterId: charId, cardIds, cardNames: resolvedNames, context: "anime" });
      }
    }
  }

  // Build card-episodes.json: cardId → { characterId, episodes[] }[]
  const cardEpisodes: Record<string, { characterId: string; episodes: { id: string; title: string; url: string; series: string }[] }[]> = {};

  for (const [charId, cardEpMap] of charCardEpisodes) {
    for (const [cardName, episodes] of cardEpMap) {
      const cardId = cardIdCache.get(cleanCardName(cardName));
      if (!cardId) continue;
      const key = String(cardId);

      if (!cardEpisodes[key]) cardEpisodes[key] = [];

      // Check if this character already has an entry for this card
      let charEntry = cardEpisodes[key].find(e => e.characterId === charId);
      if (!charEntry) {
        charEntry = { characterId: charId, episodes: [] };
        cardEpisodes[key].push(charEntry);
      }

      for (const ep of episodes) {
        const epId = `${ep.series}-${String(ep.epNum).padStart(3, "0")}`;
        if (!charEntry.episodes.some(e => e.id === epId)) {
          charEntry.episodes.push({
            id: epId,
            title: ep.title,
            url: ep.url,
            series: ep.series,
          });
        }
      }
    }
  }

  // Write files
  const fs = await import("fs");
  const path = await import("path");

  const cardsPath = path.join(process.cwd(), "src/data/character-cards.json");
  fs.writeFileSync(cardsPath, JSON.stringify({
    version: 6,
    lastUpdated: new Date().toISOString().split("T")[0],
    characters,
    mappings,
  }, null, 2));

  const episodesPath = path.join(process.cwd(), "src/data/card-episodes.json");
  fs.writeFileSync(episodesPath, JSON.stringify(cardEpisodes));

  const totalCards = mappings.reduce((s: number, m: any) => s + m.cardIds.length, 0);
  const totalEpEntries = Object.keys(cardEpisodes).length;
  console.log(`\n✅ Done!`);
  console.log(`  ${characters.length} characters, ${totalCards} card mappings`);
  console.log(`  ${totalEpEntries} cards with episode data`);
}

main().catch(console.error);
