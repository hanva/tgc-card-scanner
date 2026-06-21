export type Series = "DM" | "GX" | "VideoGame";

export interface Character {
  id: string;
  name: string;
  nameFr?: string;
  series: Series;
}

export interface EpisodeAppearance {
  id: string;
  title: string;
  url: string;
  series: "DM" | "GX";
}

export interface CharacterCardMapping {
  characterId: string;
  cardIds: number[];
  cardNames: string[];
  context: "anime" | "videogame" | "both";
}

export interface CardEpisodeEntry {
  characterId: string;
  episodes: EpisodeAppearance[];
}

export interface CharacterCardsData {
  version: number;
  lastUpdated: string;
  characters: Character[];
  mappings: CharacterCardMapping[];
}

export type MatchStrength = "direct" | "archetype" | "loose";

export interface ArchetypeInfo {
  name: string;
  linkedCard?: string; // The card the character actually uses in this archetype
}

export interface CharacterResult {
  character: Character;
  context: string;
  source: "skill-card" | "database";
  strength: MatchStrength;
  episodes?: EpisodeAppearance[];
  archetypeInfo?: ArchetypeInfo;
}
