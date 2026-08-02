import AsyncStorage from "@react-native-async-storage/async-storage";
import { YgoCard } from "../types/card";

/**
 * Base locale de cartes, persistée (AsyncStorage) et indexée par code de set.
 * Chaque carte croisée (scan, recherche, set, archétype) est sauvée avec ses codes
 * → taper "DUAD-FR" ressort les cartes déjà vues, même hors ligne.
 *
 * Les codes sont indexés SANS la langue ("DUAD-073") : DUAD-FR073 et DUAD-EN073
 * sont la même carte, seule l'impression change.
 */
const STORAGE_KEY = "cardDb.v1";

const store = new Map<string, YgoCard>(); // id → carte
const setIndex = new Map<string, Set<string>>(); // "DUAD-073" → ids

let hydrated = false;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** "DUAD-FR073" / "duad-en073" → "DUAD-073" ; "DUAD-FR" → "DUAD-" ; "DUAD" → "DUAD" */
export function normSetCode(raw: string): string {
  const up = (raw || "").toUpperCase().trim();
  const m = up.match(/^([A-Z0-9]{2,5})-([A-Z]{2})?([A-Z]?\d{1,3})?$/);
  if (!m) return up;
  const [, prefix, , num] = m;
  return num != null ? `${prefix}-${num}` : up.includes("-") ? `${prefix}-` : prefix;
}

function indexCard(card: YgoCard, extraCode?: string) {
  const codes = (card.card_sets || []).map((s) => s.set_code).filter(Boolean) as string[];
  if (extraCode) codes.push(extraCode);
  for (const c of codes) {
    const k = normSetCode(c);
    if (!/-\S*\d/.test(k)) continue;
    (setIndex.get(k) || setIndex.set(k, new Set()).get(k)!).add(String(card.id));
  }
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      const cards = [...store.values()];
      const extra: Record<string, string[]> = {};
      for (const [k, ids] of setIndex) extra[k] = [...ids];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ cards, setIndex: extra }));
    } catch {}
  }, 1500);
}

/** À appeler au boot (fire-and-forget) : recharge la base locale. */
export async function hydrateCardStore(): Promise<void> {
  if (hydrated) return;
  hydrated = true;
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw) as { cards: YgoCard[]; setIndex?: Record<string, string[]> };
    for (const c of data.cards || []) {
      if (!store.has(String(c.id))) {
        store.set(String(c.id), c);
        indexCard(c);
      }
    }
    for (const [k, ids] of Object.entries(data.setIndex || {})) {
      const set = setIndex.get(k) || setIndex.set(k, new Set()).get(k)!;
      for (const id of ids) set.add(id);
    }
  } catch {}
}

export function storeCard(card: YgoCard, extraSetCode?: string) {
  const prev = store.get(String(card.id));
  // Ne pas écraser une fiche riche (avec sets) par une fiche pauvre (ex: Yugipedia minimal)
  const merged: YgoCard = prev ? { ...prev, ...card, card_sets: card.card_sets || prev.card_sets } : card;
  store.set(String(card.id), merged);
  indexCard(merged, extraSetCode);
  // Une vraie fiche (id > 0) purge les doublons Yugipedia (id < 0) du même nom :
  // évite qu'une fiche minimale (image cassée) reste devant la bonne.
  if (merged.id > 0) {
    const key = (merged.name_en || merged.name || "").toLowerCase();
    for (const [id, c] of store) {
      if (c.id < 0 && (c.name_en || c.name || "").toLowerCase() === key) store.delete(id);
    }
  }
  scheduleSave();
}

export function getStoredCard(id: number): YgoCard | undefined {
  return store.get(String(id));
}

export function storedCardCount(): number {
  return store.size;
}

/**
 * Recherche locale par code de set, complet ou préfixe :
 * "DUAD-FR073" → la carte ; "DUAD-FR" / "DUAD" → toutes les cartes connues du set, triées par numéro.
 */
export function searchLocalBySetCode(query: string): YgoCard[] {
  const k = normSetCode(query);
  if (!k) return [];
  const ids: string[] = [];
  if (/-\S*\d/.test(k)) {
    for (const id of setIndex.get(k) || []) ids.push(id);
  } else {
    const prefix = k.endsWith("-") ? k : k + "-";
    const keys = [...setIndex.keys()].filter((key) => key.startsWith(prefix)).sort();
    const seen = new Set<string>();
    for (const key of keys) {
      for (const id of setIndex.get(key)!) {
        if (!seen.has(id)) { seen.add(id); ids.push(id); }
      }
    }
  }
  return ids.map((id) => store.get(id)!).filter(Boolean);
}

/** Recherche locale par nom (FR ou EN), pour le mode hors-ligne. */
export function searchLocalByName(query: string, limit = 20): YgoCard[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const out: YgoCard[] = [];
  for (const c of store.values()) {
    if (c.name?.toLowerCase().includes(q) || c.name_en?.toLowerCase().includes(q)) {
      out.push(c);
      if (out.length >= limit) break;
    }
  }
  return out;
}
