/**
 * Construction de la "cible" de matching à partir de NOS données
 * (archetype-cards.json + character-cards.json), partagée par :
 *  - le générateur de snippet navigateur (build-market-snippet.ts)
 *  - le scraper Playwright (scrape-playwright.ts)
 *
 * `norm` DOIT rester identique à la version embarquée dans le snippet (snippet-template.ts).
 */
import * as fs from "fs";
import * as path from "path";

/** normName → { a: archetypes[], c: characterIds[], n: displayName } */
export type TargetMap = Record<string, { a: string[]; c: string[]; n: string }>;

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

export interface TargetStats {
  size: number;
  archetypes: number;
  characters: number;
  archCardEntries: number;
  charCardEntries: number;
}

export function buildTargetMap(root: string): { target: TargetMap; stats: TargetStats } {
  const load = <T>(rel: string): T =>
    JSON.parse(fs.readFileSync(path.join(root, rel), "utf-8")) as T;

  const target: TargetMap = {};
  const add = (rawName: string, kind: "a" | "c", val: string) => {
    const key = norm(rawName);
    if (!key) return;
    const e = (target[key] ||= { a: [], c: [], n: rawName });
    const arr = kind === "a" ? e.a : e.c;
    if (!arr.includes(val)) arr.push(val);
  };

  const archetypeCards = load<Record<string, string[]>>("src/data/archetype-cards.json");
  let archCardEntries = 0;
  for (const [archetype, names] of Object.entries(archetypeCards)) {
    for (const n of names) { add(n, "a", archetype); archCardEntries++; }
  }

  const characterData = load<{ mappings: { characterId: string; cardNames: string[] }[] }>(
    "src/data/character-cards.json"
  );
  let charCardEntries = 0;
  for (const m of characterData.mappings) {
    for (const n of m.cardNames) { add(n, "c", m.characterId); charCardEntries++; }
  }

  return {
    target,
    stats: {
      size: Object.keys(target).length,
      archetypes: Object.keys(archetypeCards).length,
      characters: characterData.mappings.length,
      archCardEntries,
      charCardEntries,
    },
  };
}
