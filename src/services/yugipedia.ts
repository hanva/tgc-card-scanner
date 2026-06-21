import { YgoCard } from "../types/card";

const API_BASE = "https://yugipedia.com/api.php";

// Common French→English word mappings for Yu-Gi-Oh card names
const FR_EN_WORDS: Record<string, string[]> = {
  sorcellerie: ["wizardry", "sorcery", "magic"],
  ultime: ["ultimate"],
  magicien: ["magician"],
  sombre: ["dark"],
  chevalier: ["knight"],
  dragon: ["dragon"],
  guerrier: ["warrior"],
  rituel: ["ritual"],
  maîtrise: ["mastery"],
  noire: ["black", "dark"],
  blanc: ["white"],
  puissance: ["power"],
  pouvoir: ["power"],
  force: ["force", "power"],
  lumière: ["light"],
  ténèbres: ["darkness", "dark"],
  cyber: ["cyber"],
  élémentaire: ["elemental"],
  héros: ["hero"],
  ange: ["angel"],
  fusion: ["fusion"],
  appel: ["call"],
  invocation: ["summon"],
  piège: ["trap"],
  magie: ["spell", "magic"],
  monstre: ["monster"],
  roi: ["king"],
  reine: ["queen"],
  ancien: ["ancient"],
  machine: ["machine", "gear"],
  cristal: ["crystal"],
  bête: ["beast"],
  sacré: ["sacred"],
  volcan: ["volcanic"],
  armé: ["armed"],
  destinée: ["destiny"],
  vision: ["vision"],
  masqué: ["masked"],
  ciel: ["sky", "skies"],
  nuageux: ["cloudy"],
  gris: ["grey", "gray"],
  rouge: ["red"],
  bleu: ["blue"],
  vert: ["green"],
  jaune: ["yellow"],
  noir: ["black", "dark"],
  aile: ["wing", "winged"],
  ailes: ["wings"],
  feu: ["fire", "flame"],
  eau: ["water"],
  terre: ["earth"],
  vent: ["wind"],
  tonnerre: ["thunder"],
  glace: ["ice"],
  ombre: ["shadow"],
  etoile: ["star"],
  lune: ["moon"],
  soleil: ["sun"],
  temps: ["time"],
  epee: ["sword"],
  bouclier: ["shield"],
  couronne: ["crown"],
  collection: ["collection"],
  arc: ["rainbow", "arc"],
  secret: ["secret"],
  interdit: ["forbidden"],
  eternel: ["eternal"],
  supreme: ["supreme"],
  divin: ["divine"],
  celeste: ["celestial"],
  infernal: ["infernal"],
  demoniaque: ["demonic", "fiend"],
  sacre: ["sacred", "holy"],
  maudit: ["cursed"],
  gardien: ["guardian"],
  chasseur: ["hunter"],
  vengeur: ["avenger"],
  destructeur: ["destroyer"],
  createur: ["creator"],
  invocateur: ["summoner"],
  ascension: ["ascension", "rise"],
  chute: ["fall"],
  eveil: ["awakening"],
  renaissance: ["rebirth", "reborn"],
  tempete: ["storm", "tempest"],
  explosion: ["burst", "explosion"],
  flamme: ["flame"],
  eclair: ["lightning"],
  tornade: ["tornado"],
  tsunami: ["tsunami"],
};

/**
 * Attempt to translate a French card name to English guesses.
 */
function guessEnglishNames(frName: string): string[] {
  const words = frName.toLowerCase().split(/\s+/);
  const guesses: string[] = [];

  // Try translating each word
  const translated = words.map((w) => {
    const clean = w
      .replace(/['']/g, "'")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return FR_EN_WORDS[clean] || FR_EN_WORDS[w] || [w];
  });

  const firstTranslations = translated.map((t) => t[0]);

  // Normal order: "sorcellerie ultime" → "wizardry ultimate"
  guesses.push(firstTranslations.join(" "));

  // Reversed order: "wizardry ultimate" → "ultimate wizardry"
  guesses.push([...firstTranslations].reverse().join(" "));

  // Title case both orders
  const toTitle = (ws: string[]) =>
    ws.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  guesses.push(toTitle(firstTranslations));
  guesses.push(toTitle([...firstTranslations].reverse()));

  // Also try all alternative translations in both orders
  for (const translations of translated) {
    for (const alt of translations.slice(1)) {
      const others = firstTranslations.filter((_, i) => i !== translated.indexOf(translations));
      guesses.push([alt, ...others].join(" "));
      guesses.push([...others, alt].join(" "));
      guesses.push(toTitle([alt, ...others]));
      guesses.push(toTitle([...others, alt]));
    }
  }

  return [...new Set(guesses)];
}

/**
 * Parse wikitext from Yugipedia CardTable2 template.
 */
function parseWikitext(wikitext: string): {
  name: string;
  nameFr?: string;
  character?: string;
  desc?: string;
  descFr?: string;
  type: string;
  imageUrl?: string;
} | null {
  const get = (field: string): string | undefined => {
    const match = wikitext.match(
      new RegExp(`\\|\\s*${field}\\s*=\\s*(.+?)\\s*$`, "m")
    );
    return match ? match[1].replace(/\[\[|\]\]/g, "").trim() : undefined;
  };

  const pageName = get("en_name") || "";
  const frName = get("fr_name");
  const character = get("character");
  const desc = get("text");
  const descFr = get("fr_text") || get("fr_skill_text");
  const types = get("types") || "";
  const image = get("image");

  if (!pageName && !frName) return null;

  return {
    name: pageName || frName || "",
    nameFr: frName,
    character,
    desc: desc?.replace(/\[\[|\]\]/g, ""),
    descFr: descFr?.replace(/\[\[|\]\]/g, ""),
    type: types.includes("Skill") ? "Skill Card" : "Card",
    imageUrl: image
      ? `https://ms.yugipedia.com/thumb/${encodeURIComponent(image)}/300px-${encodeURIComponent(image)}`
      : undefined,
  };
}

/**
 * Fetch and parse a Yugipedia card page.
 */
async function fetchCardPage(pageName: string) {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(pageName)}&prop=wikitext&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    if (json.error) return null;
    const wikitext = json?.parse?.wikitext?.["*"];
    if (!wikitext || !wikitext.includes("CardTable2")) return null;
    return parseWikitext(wikitext);
  } catch {
    return null;
  }
}

/**
 * Search Yugipedia page titles.
 */
async function searchPages(query: string): Promise<string[]> {
  const url = `${API_BASE}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=10&format=json`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json = await res.json();
    return (json?.query?.search || []).map((r: { title: string }) => r.title);
  } catch {
    return [];
  }
}

/**
 * Convert parsed card data to YgoCard format.
 * Uses negative IDs to distinguish from YGOProDeck cards.
 */
function toYgoCard(
  data: NonNullable<ReturnType<typeof parseWikitext>>,
  fakeId: number
): YgoCard {
  return {
    id: fakeId,
    name: data.nameFr || data.name,
    name_en: data.name,
    type: data.type,
    humanReadableCardType: data.character
      ? `${data.type} - ${data.character}`
      : data.type,
    frameType: data.type === "Skill Card" ? "skill" : "effect",
    desc: data.descFr || data.desc || "",
    race: data.character || "",
    card_images: data.imageUrl
      ? [
          {
            id: fakeId,
            image_url: data.imageUrl,
            image_url_small: data.imageUrl,
            image_url_cropped: data.imageUrl,
          },
        ]
      : [],
  };
}

/**
 * Search Yugipedia for a card. Handles French names by:
 * 1. Trying direct page lookup
 * 2. Guessing English translations
 * 3. Searching page titles with English guesses
 * 4. Searching page titles with original query
 */
export async function searchYugipedia(query: string): Promise<YgoCard[]> {
  let fakeId = -100;
  const queryLower = query.toLowerCase();

  // 1. Direct page lookup (works if query is an English name)
  const direct = await fetchCardPage(query.replace(/\s+/g, "_"));
  if (direct) return [toYgoCard(direct, fakeId--)];

  // 2. Translate FR words to EN — only first translation per word to keep search focused
  const words = query.toLowerCase().split(/\s+/);
  const firstEnWords: string[] = [];
  for (const w of words) {
    const clean = w
      .replace(/['']/g, "'")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const translations = FR_EN_WORDS[clean] || FR_EN_WORDS[w];
    if (translations) {
      firstEnWords.push(translations[0]);
    } else if (w.length >= 3) {
      firstEnWords.push(w);
    }
  }
  const allEnWords = new Set(firstEnWords);

  // 3. Search Yugipedia with all translated words (order doesn't matter for search)
  if (allEnWords.size > 0) {
    const searchQuery = [...allEnWords].join(" ");
    const pages = await searchPages(searchQuery);
    for (const page of pages.slice(0, 5)) {
      const data = await fetchCardPage(page);
      if (!data) continue;
      // Verify: FR name should match original query
      const frLower = data.nameFr?.toLowerCase() || "";
      if (
        frLower === queryLower ||
        frLower.includes(queryLower) ||
        queryLower.includes(frLower)
      ) {
        return [toYgoCard(data, fakeId--)];
      }
      // Also accept if most translated words appear in the EN name
      const enLower = data.name.toLowerCase();
      const matchCount = [...allEnWords].filter((w) =>
        enLower.includes(w)
      ).length;
      if (matchCount >= Math.ceil(allEnWords.size * 0.5)) {
        return [toYgoCard(data, fakeId--)];
      }
    }
  }

  // 4. Try direct page with each guess combination
  const guesses = guessEnglishNames(query);
  for (const guess of guesses.slice(0, 4)) {
    const data = await fetchCardPage(guess.replace(/\s+/g, "_"));
    if (data) return [toYgoCard(data, fakeId--)];
  }

  return [];
}
