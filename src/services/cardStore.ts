import { YgoCard } from "../types/card";

/**
 * Simple in-memory store for passing card data between screens.
 * Avoids re-fetching cards that were already loaded in search results.
 */
const store = new Map<string, YgoCard>();

export function storeCard(card: YgoCard) {
  store.set(String(card.id), card);
}

export function getStoredCard(id: number): YgoCard | undefined {
  return store.get(String(id));
}
