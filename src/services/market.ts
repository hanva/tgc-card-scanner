/**
 * Types + helpers du Market. Les datasets viennent du backend (API) qui matche côté serveur.
 * (Plus de table de matching ni de seed embarqués dans l'app.)
 */
import characterData from "../data/character-cards.json";

/** Normalisation de nom (pour la dédup à l'affichage). Identique au backend/snippet. */
export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface MarketCard {
  articleId: string;
  name: string;
  expansion: string;
  expansionCode: string;
  rarity: string;
  condition: string;
  conditionCode: string;
  language: string;
  price: number | null;
  amount: number | null;
  firstEd: boolean;
  offerUrl: string;
  image?: string;
  isMatched: boolean;
  matched: { archetypes: string[]; characters: string[] } | null;
  expansionSlice: string;
}

export interface MarketDataset {
  seller: string;
  source: string;
  scrapedAt?: string;
  partial?: boolean;
  editionsDone: number;
  editionsTotal?: number;
  total: number;
  totalMatched: number;
  byArchetype: Record<string, number>;
  byCharacter: Record<string, number>;
  cards: MarketCard[];
}

const charNames = new Map<string, string>();
for (const c of (characterData as { characters: { id: string; name: string; nameFr?: string }[] }).characters) {
  charNames.set(c.id, c.nameFr || c.name);
}
export function characterName(id: string): string {
  return charNames.get(id) || id;
}

export function archetypesSorted(d: MarketDataset): { name: string; count: number }[] {
  return Object.entries(d.byArchetype || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export function charactersSorted(d: MarketDataset): { id: string; name: string; count: number }[] {
  return Object.entries(d.byCharacter || {})
    .map(([id, count]) => ({ id, name: characterName(id), count }))
    .sort((a, b) => b.count - a.count);
}

