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

// ─── Groupement partagé (Marché + Wishlist) ───

export interface Section {
  key: string;
  title: string;
  cards: MarketCard[];
}

/** Une carte = une vignette, même si plusieurs offres (raretés/éditions) → on garde la moins chère. */
export function dedupeByName(cards: MarketCard[]): MarketCard[] {
  const by = new Map<string, MarketCard>();
  for (const c of cards) {
    const k = norm(c.name); // collapse les variantes/raretés (ex "(V.1 - Ultra Rare)")
    const ex = by.get(k);
    if (!ex) by.set(k, c);
    else if ((c.price ?? Infinity) < (ex.price ?? Infinity)) by.set(k, c);
  }
  return [...by.values()];
}

export interface BuildSectionsOpts {
  mode: "archetype" | "character";
  filterValue: string | null;
  query: string;
  matchFilter: "matched" | "unmatched" | "all";
  showDups: boolean;
}

/** Construit les sections groupées (archétype ou perso) d'un dataset. Identique Marché ↔ Wishlist. */
export function buildSections(dataset: MarketDataset, opts: BuildSectionsOpts): Section[] {
  const { mode, filterValue, query, matchFilter, showDups } = opts;
  const q = query.trim().toLowerCase();
  const pass = (c: MarketCard) => !q || c.name.toLowerCase().includes(q);
  const matched = dataset.cards.filter((c) => c.isMatched && pass(c));
  const out: Section[] = [];
  const dd = (arr: MarketCard[]) => (showDups ? arr : dedupeByName(arr));

  if (matchFilter !== "unmatched") {
    if (mode === "archetype") {
      for (const a of archetypesSorted(dataset)) {
        if (filterValue && filterValue !== a.name) continue;
        const cards = dd(matched.filter((c) => c.matched!.archetypes.includes(a.name)));
        if (cards.length) out.push({ key: "a:" + a.name, title: a.name, cards });
      }
    } else {
      for (const ch of charactersSorted(dataset)) {
        if (filterValue && filterValue !== ch.id) continue;
        const cards = dd(matched.filter((c) => c.matched!.characters.includes(ch.id)));
        if (cards.length) out.push({ key: "c:" + ch.id, title: ch.name, cards });
      }
    }
  }
  if (matchFilter !== "matched" && !filterValue) {
    const unmatched = dd(dataset.cards.filter((c) => !c.isMatched && pass(c)));
    if (unmatched.length) out.push({ key: "unmatched", title: "Non liées", cards: unmatched });
  }
  return out;
}

/** Noms uniques prêts pour l'import cardmarket "Add Deck List", découpés en blocs de `chunk`. */
export function exportBlocks(cards: MarketCard[], chunk = 150): string[][] {
  const clean = (n: string) => (n || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const names = [...new Set(cards.map((c) => clean(c.name)).filter(Boolean))];
  const blocks: string[][] = [];
  for (let i = 0; i < names.length; i += chunk) blocks.push(names.slice(i, i + chunk));
  return blocks;
}

