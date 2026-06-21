import { YgoCard } from "../types/card";
import {
  Character,
  CharacterResult,
  EpisodeAppearance,
  Series,
} from "../types/character";
import characterData from "../data/character-cards.json";
import archetypeData from "../data/archetype-characters.json";
import archetypeCardsData from "../data/archetype-cards.json";
import cardEpisodesRaw from "../data/card-episodes.json";

// Build reverse index: cardName → archetype (for cards without API archetype)
const cardNameToArchetype = new Map<string, string>();
for (const [archetype, cardNames] of Object.entries(
  archetypeCardsData as Record<string, string[]>
)) {
  for (const name of cardNames) {
    cardNameToArchetype.set(name.toLowerCase(), archetype);
  }
}

const cardEpisodesData = cardEpisodesRaw as Record<
  string,
  { characterId: string; episodes: EpisodeAppearance[] }[]
>;

// Build reverse index: cardId -> characterIds
const cardToCharacters = new Map<number, string[]>();
for (const mapping of characterData.mappings) {
  for (const cardId of mapping.cardIds) {
    const existing = cardToCharacters.get(cardId) || [];
    existing.push(mapping.characterId);
    cardToCharacters.set(cardId, existing);
  }
}

const archetypeMap = archetypeData.archetypeMap as Record<
  string,
  Array<{ characterId: string; context: string }>
>;

function findCharacter(id: string): Character | undefined {
  const c = characterData.characters.find((ch) => ch.id === id);
  if (!c) return undefined;
  return { ...c, series: c.series as Series };
}

function findMapping(characterId: string) {
  return characterData.mappings.find((m) => m.characterId === characterId);
}

interface ArchetypeMatch {
  characterId: string;
  count: number;
  sampleCardName?: string;
  curatedIdx: number;
}

function findArchetypeMatches(
  candidates: Set<string>,
  archetype: string
): ArchetypeMatch[] {
  // Substring matching on cardNames — tracks "characters who play cards with the
  // archetype name in them." Matches the user's mental model better than the official
  // Konami archetype list (e.g. for "Goblin", Joey's "Goblin Attack Force" counts).
  const archLower = archetype.toLowerCase();
  const curatedOrder = (archetypeMap[archetype] || []).map((e) => e.characterId);

  const matches: ArchetypeMatch[] = [];

  for (const charId of candidates) {
    const mapping = findMapping(charId);
    if (!mapping) continue;

    let count = 0;
    let sample: string | undefined;
    for (const name of mapping.cardNames) {
      if (name.toLowerCase().includes(archLower)) {
        count++;
        if (!sample) sample = name;
      }
    }

    const curatedIdx = curatedOrder.indexOf(charId);
    // Curated characters are kept even with count 0 (manual signal of intent).
    // Non-curated characters need at least one substring match.
    if (count === 0 && curatedIdx === -1) continue;

    matches.push({ characterId: charId, count, sampleCardName: sample, curatedIdx });
  }

  // Sort by: (1) higher count first, (2) curated before non-curated,
  // (3) curated order, (4) alphabetical characterId
  matches.sort((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    const aCurated = a.curatedIdx !== -1;
    const bCurated = b.curatedIdx !== -1;
    if (aCurated !== bCurated) return aCurated ? -1 : 1;
    if (aCurated && bCurated) return a.curatedIdx - b.curatedIdx;
    return a.characterId.localeCompare(b.characterId);
  });

  return matches;
}

function getEpisodesForCard(
  cardId: number,
  characterId: string
): EpisodeAppearance[] {
  const entries = cardEpisodesData[String(cardId)];
  if (!entries) return [];
  const charEntry = entries.find((e) => e.characterId === characterId);
  return charEntry?.episodes || [];
}

const SKILL_CARD_NAMES: Record<string, string> = {
  "Yami Yugi": "yami-yugi",
  Yugi: "yugi",
  "Seto Kaiba": "seto-kaiba",
  Kaiba: "seto-kaiba",
  Joey: "joey-wheeler",
  "Joey Wheeler": "joey-wheeler",
  Mai: "mai-valentine",
  "Mai Valentine": "mai-valentine",
  Pegasus: "pegasus",
  "Maximillion Pegasus": "pegasus",
  "Yami Marik": "yami-marik",
  Marik: "yami-marik",
  Bakura: "bakura",
  "Yami Bakura": "bakura",
  Weevil: "weevil",
  Rex: "rex",
  Mako: "mako",
  Keith: "bandit-keith",
  Ishizu: "ishizu",
  "Ishizu Ishtar": "ishizu",
  Odion: "odion",
  Arkana: "arkana",
  "Espa Roba": "espa-roba",
  Bonz: "bonz",
  "Tea Gardner": "tea-gardner",
  "Paradox Broth": "paradox-brothers",
  "Lumis Umbra": "lumis-umbra",
  "Lumis and Umb": "lumis-umbra",
  "Jaden Yuki": "jaden-yuki",
  "The Supreme K": "supreme-king",
  "Alexis Rhodes": "alexis-rhodes",
  "Chazz Princet": "chazz-princeton",
  "Chazz Princeton": "chazz-princeton",
  "Zane Truesdal": "zane-truesdale",
  "Zane Truesdale": "zane-truesdale",
  "Syrus Truesda": "syrus-truesdale",
  "Syrus Truesdale": "syrus-truesdale",
  "Bastion Misaw": "bastion-misawa",
  "Bastion Misawa": "bastion-misawa",
  "Aster Phoenix": "aster-phoenix",
  "Jesse Anderso": "jesse-anderson",
  "Jesse Anderson": "jesse-anderson",
  "Axel Brodie": "axel-brodie",
  "Dr. Vellian C": "crowler",
  "Tyranno Hassl": "tyranno-hassleberry",
  "Chumley Huffi": "chumley",
  "Adrian Gecko": "adrian-gecko",
  Yubel: "yubel",
  "Thelonious Vi": "sartorius",
  Nightshroud: "nightshroud",
  Camula: "camula",
  Tania: "tania",
  "Don Zaloog": "don-zaloog",
  Titan: "titan",
  Kagemaru: "kagemaru",
  Amnael: "amnael",
  "Abidos the Th": "abidos",
  David: "david",
  Andrew: "andrew",
  Christine: "christine",
  Emma: "emma",
};

export function getCharactersForCard(card: YgoCard): CharacterResult[] {
  const results: CharacterResult[] = [];
  const seenCharacterIds = new Set<string>();

  // 1. Skill Cards → direct
  if (card.type === "Skill Card" && card.race) {
    const charId = SKILL_CARD_NAMES[card.race];
    const character = charId ? findCharacter(charId) : undefined;
    const id = character?.id || card.race.toLowerCase().replace(/\s+/g, "-");
    seenCharacterIds.add(id);
    results.push({
      character: character || { id, name: card.race, series: "DM" as Series },
      context: "Skill Card",
      source: "skill-card",
      strength: "direct",
    });
  }

  // 2. Exact card ID match → direct
  const charIds = cardToCharacters.get(card.id) || [];
  for (const charId of charIds) {
    if (seenCharacterIds.has(charId)) continue;
    const character = findCharacter(charId);
    if (!character) continue;
    seenCharacterIds.add(charId);

    const mapping = findMapping(charId);
    const context =
      mapping?.context === "anime"
        ? "Anime"
        : mapping?.context === "videogame"
          ? "Jeu vidéo"
          : "Anime & Jeu vidéo";

    const episodes = getEpisodesForCard(card.id, charId);
    results.push({ character, context, source: "database", strength: "direct", episodes });
  }

  // 2b. Fallback: if no archetype from API, look up in local archetype-cards.json
  const effectiveArchetype =
    card.archetype ||
    cardNameToArchetype.get(card.name.toLowerCase()) ||
    (card.name_en ? cardNameToArchetype.get(card.name_en.toLowerCase()) : undefined);

  // 3. Archetype match → only when no direct card-id match exists.
  //    Rule: if any character has the card via direct cardId mapping, archetype-based
  //    association is suppressed entirely. Otherwise, surface every character who has
  //    at least one card of that archetype (curated or substring-matched).
  const hasDirectCardIdMatch = charIds.length > 0;
  if (!hasDirectCardIdMatch && effectiveArchetype) {
    const candidates = new Set<string>();
    for (const e of archetypeMap[effectiveArchetype] || []) {
      candidates.add(e.characterId);
    }
    const archLower = effectiveArchetype.toLowerCase();
    for (const m of characterData.mappings) {
      if (m.cardNames.some((n) => n.toLowerCase().includes(archLower))) {
        candidates.add(m.characterId);
      }
    }

    const matches = findArchetypeMatches(candidates, effectiveArchetype);
    // Pick a unique dominant when one character has a strictly higher count than the
    // rest. If the top is tied (no clear dominant), fall back to listing every match.
    let toShow: ArchetypeMatch[];
    if (matches.length === 0) {
      toShow = [];
    } else {
      const topCount = matches[0].count;
      const tiedAtTop = matches.filter((m) => m.count === topCount);
      toShow = tiedAtTop.length === 1 ? [matches[0]] : matches;
    }

    for (const match of toShow) {
      if (seenCharacterIds.has(match.characterId)) continue;
      const character = findCharacter(match.characterId);
      if (!character) continue;
      seenCharacterIds.add(match.characterId);
      const curatedEntry = (archetypeMap[effectiveArchetype] || []).find(
        (e) => e.characterId === match.characterId
      );
      results.push({
        character,
        context: curatedEntry?.context || `Archétype ${effectiveArchetype}`,
        source: "database",
        strength: "archetype",
        archetypeInfo: {
          name: effectiveArchetype,
          linkedCard: match.sampleCardName,
        },
      });
    }
  }

  // 4. Set name match (strict)
  if (results.length === 0 && card.card_sets) {
    const SET_KEYWORDS: Record<string, string> = {
      "yugi's world": "yami-yugi",
      "starter deck: yugi": "yami-yugi",
      "yugi reloaded": "yami-yugi",
      "kaiba's": "seto-kaiba",
      "starter deck: kaiba": "seto-kaiba",
      "joey's": "joey-wheeler",
      "starter deck: joey": "joey-wheeler",
      "starter deck: pegasus": "pegasus",
      "slifer the sky dragon": "yami-yugi",
      "egyptian god deck: slifer": "yami-yugi",
      "egyptian god deck: obelisk": "seto-kaiba",
    };

    for (const set of card.card_sets) {
      const setLower = set.set_name.toLowerCase();
      for (const [keyword, charId] of Object.entries(SET_KEYWORDS)) {
        if (setLower.includes(keyword) && !seenCharacterIds.has(charId)) {
          const character = findCharacter(charId);
          if (character) {
            seenCharacterIds.add(charId);
            results.push({
              character,
              context: `Set: ${set.set_name}`,
              source: "database",
              strength: "loose",
            });
          }
        }
      }
    }
  }

  return results;
}
