import { YgoCard, YgoApiResponse } from "../types/card";
import { searchYugipedia } from "./yugipedia";

const BASE_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

const cache = new Map<string, YgoCard>();

function cacheCard(card: YgoCard) {
  cache.set(String(card.id), card);
}

/**
 * Check if a string looks like a set code (e.g. SGX3-FRS16, SBCB-FR001)
 * and search by it.
 */
function fixSetCodePrefix(raw: string): string {
  const upper = raw.toUpperCase();
  const dashIdx = upper.indexOf("-");
  if (dashIdx === -1) return upper;
  let prefix = upper.substring(0, dashIdx);
  prefix = prefix.replace(/O(?=\d)/g, "0").replace(/(?<=\d)O/g, "0");
  const suffix = upper.substring(dashIdx + 1);
  const lang = suffix.substring(0, 2);
  const numPart = suffix.substring(2).replace(/O/g, "0").replace(/I/g, "1");
  return `${prefix}-${lang}${numPart}`;
}

async function searchBySetCode(code: string): Promise<YgoCard[]> {
  const raw = code.toUpperCase();
  const fixed = fixSetCodePrefix(code);
  // Replace any language code with EN: -FR, -KR, -DE, -IT, -SP, -PT, -JP, -JA, -TC, -AE
  const toEn = (s: string) => s.replace(/-(FR|KR|DE|IT|SP|PT|JP|JA|TC|AE|OC)/, "-EN");
  const candidates = [toEn(raw)];
  const fixedEn = toEn(fixed);
  if (fixedEn !== candidates[0]) candidates.push(fixedEn);

  let res: Response | null = null;
  for (const enCode of candidates) {
    try {
      const r = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardsetsinfo.php?setcode=${encodeURIComponent(enCode)}`
      );
      if (r.ok) { res = r; break; }
    } catch {}
  }
  try {
    if (!res?.ok) return [];
    const json = await res.json();
    const cardId = json?.id;
    if (!cardId) return [];

    // Step 2: Get full card data — try FR, fallback EN
    const frUrl = `${BASE_URL}?id=${cardId}&language=fr`;
    const frRes = await fetch(frUrl);
    if (frRes.ok) {
      const frJson: YgoApiResponse = await frRes.json();
      if (frJson.data?.[0]) {
        cacheCard(frJson.data[0]);
        return [frJson.data[0]];
      }
    }

    // FR failed — try EN then enrich with FR name from Yugipedia
    const enUrl = `${BASE_URL}?id=${cardId}`;
    const enRes = await fetch(enUrl);
    if (enRes.ok) {
      const enJson: YgoApiResponse = await enRes.json();
      const card = enJson.data?.[0];
      if (card) {
        // Try to get FR name from Yugipedia
        try {
          const wikiRes = await fetch(
            `https://yugipedia.com/api.php?action=parse&page=${encodeURIComponent(card.name.replace(/\s+/g, "_"))}&prop=wikitext&format=json`
          );
          if (wikiRes.ok) {
            const wikiJson = await wikiRes.json();
            const wikitext = wikiJson?.parse?.wikitext?.["*"] || "";
            const frMatch = wikitext.match(/fr_name\s*=\s*(.+)/);
            if (frMatch) {
              card.name_en = card.name;
              card.name = frMatch[1].trim();
            }
          }
        } catch {
          // Keep EN name
        }
        cacheCard(card);
        return [card];
      }
    }

    return [];
  } catch {
    return [];
  }
}

export async function searchCards(
  query: string,
  lang: string = "fr"
): Promise<YgoCard[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // 0. Check if query looks like a set code (e.g. SGX3-FRS16, SBCB-FR001, AGOV-FRO66)
  const setCodeMatch = trimmed.match(/[A-Z0-9]{2,5}-[A-Z]{2}[A-Z0-9]?[0-9O]{2,3}/i);
  if (setCodeMatch) {
    // Fix OCR errors: O→0 in numeric part
    const fixed = setCodeMatch[0].toUpperCase().replace(
      /(-[A-Z]{2})(.+)/,
      (_, lang, num) => lang + num.replace(/O/g, "0").replace(/I/g, "1")
    );
    const setResults = await searchBySetCode(fixed);
    if (setResults.length > 0) return setResults;
  }

  // 1. Try fuzzy search in French
  const frResults = await fetchCards(
    `${BASE_URL}?fname=${encodeURIComponent(trimmed)}&language=${lang}&num=20&offset=0`
  );
  if (frResults.length > 0) return frResults;

  // 2. Fallback: search Yugipedia FIRST (for Skill Cards and cards missing from YGOProDeck)
  // This catches cards like "Ciel Nuageux de Gris" that have no FR translation in YGOProDeck
  try {
    const yugipediaResults = await searchYugipedia(trimmed);
    if (yugipediaResults.length > 0) return yugipediaResults;
  } catch {
    // Silently fail
  }

  // 3. Fallback: try with each word (longest first) to handle OCR typos
  const words = trimmed.split(/\s+/).filter((w) => w.length >= 3);
  if (words.length > 1) {
    const sorted = [...words].sort((a, b) => b.length - a.length);
    for (const word of sorted) {
      const wordResults = await fetchCards(
        `${BASE_URL}?fname=${encodeURIComponent(word)}&language=${lang}&num=20&offset=0`
      );
      // Only return if few enough results to be relevant
      if (wordResults.length > 0 && wordResults.length <= 10) return wordResults;
    }
  }

  // 4. Fallback: try English search (full query)
  const enResults = await fetchCards(
    `${BASE_URL}?fname=${encodeURIComponent(trimmed)}&num=20&offset=0`
  );
  if (enResults.length > 0) return enResults;

  // 5. Fallback: try each word in EN with truncation
  // Many FR/EN words share a root: jurassique→jurassi→matches jurassic
  if (words.length > 0) {
    const sorted = [...words].sort((a, b) => b.length - a.length);
    for (const word of sorted) {
      // Try full word first
      const wordEnResults = await fetchCards(
        `${BASE_URL}?fname=${encodeURIComponent(word)}&num=20&offset=0`
      );
      if (wordEnResults.length > 0 && wordEnResults.length <= 10)
        return wordEnResults;
      // Try truncated (remove common FR suffixes to get shared root)
      if (word.length >= 6) {
        const truncated = word.slice(0, -3); // jurassique → jurassi, volcanique → volcan
        const truncResults = await fetchCards(
          `${BASE_URL}?fname=${encodeURIComponent(truncated)}&num=20&offset=0`
        );
        if (truncResults.length > 0 && truncResults.length <= 10)
          return truncResults;
      }
    }
  }

  return [];
}

async function fetchCards(url: string): Promise<YgoCard[]> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const json: YgoApiResponse = await res.json();
    const cards = json.data || [];
    cards.forEach(cacheCard);
    return cards;
  } catch {
    return [];
  }
}

export async function getCardById(
  id: number,
  lang: string = "fr"
): Promise<YgoCard | null> {
  const cached = cache.get(String(id));
  if (cached) return cached;

  // Try requested language first
  const url = `${BASE_URL}?id=${id}&language=${lang}`;
  try {
    const res = await fetch(url);
    if (res.ok) {
      const json: YgoApiResponse = await res.json();
      const card = json.data?.[0] || null;
      if (card) { cacheCard(card); return card; }
    }
    // Fallback to EN if FR failed, then enrich with FR name from Yugipedia
    if (lang !== "en") {
      const enRes = await fetch(`${BASE_URL}?id=${id}`);
      if (enRes.ok) {
        const enJson: YgoApiResponse = await enRes.json();
        const card = enJson.data?.[0] || null;
        if (card) {
          try {
            const wikiRes = await fetch(
              `https://yugipedia.com/api.php?action=parse&page=${encodeURIComponent(card.name.replace(/\s+/g, "_"))}&prop=wikitext&format=json`
            );
            if (wikiRes.ok) {
              const wikiJson = await wikiRes.json();
              const wikitext = wikiJson?.parse?.wikitext?.["*"] || "";
              const frMatch = wikitext.match(/fr_name\s*=\s*(.+)/);
              if (frMatch) {
                card.name_en = card.name;
                card.name = frMatch[1].trim();
              }
            }
          } catch { /* Keep EN name */ }
          cacheCard(card);
          return card;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCardsByArchetype(
  archetype: string,
  lang: string = "fr"
): Promise<YgoCard[]> {
  // FR returns a subset (cards with FR translations); EN is the complete list.
  // We merge them so cards without FR translation (e.g. First Penguin) still appear,
  // while keeping FR names for the cards that have them.
  const enUrl = `${BASE_URL}?archetype=${encodeURIComponent(archetype)}`;
  if (lang === "en") return fetchCards(enUrl);

  const frUrl = `${BASE_URL}?archetype=${encodeURIComponent(archetype)}&language=${lang}`;
  const [frCards, enCards] = await Promise.all([fetchCards(frUrl), fetchCards(enUrl)]);

  const merged = new Map<number, YgoCard>();
  for (const c of enCards) merged.set(c.id, c);
  for (const c of frCards) merged.set(c.id, c); // FR overrides EN when available
  return [...merged.values()];
}

export async function getCardByExactName(
  name: string,
  lang: string = "fr"
): Promise<YgoCard | null> {
  const url = `${BASE_URL}?name=${encodeURIComponent(name)}&language=${lang}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json: YgoApiResponse = await res.json();
    const card = json.data?.[0] || null;
    if (card) cacheCard(card);
    return card;
  } catch {
    return null;
  }
}
