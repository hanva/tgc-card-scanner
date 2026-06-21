import AsyncStorage from "@react-native-async-storage/async-storage";
import { YgoCard } from "../types/card";

const COLLECTION_KEY = "ygo_collection";

export interface CollectionEntry {
  cardId: number;
  cardName: string;
  cardNameEn?: string;
  imageUrl?: string;
  archetype?: string;
  cardType?: string;
  race?: string;
  addedAt: string;
  scanCount: number;
}

async function getCollection(): Promise<Record<string, CollectionEntry>> {
  try {
    const raw = await AsyncStorage.getItem(COLLECTION_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function saveCollection(
  collection: Record<string, CollectionEntry>
): Promise<void> {
  await AsyncStorage.setItem(COLLECTION_KEY, JSON.stringify(collection));
}

export async function addToCollection(card: YgoCard): Promise<void> {
  const collection = await getCollection();
  const key = String(card.id);
  const existing = collection[key];

  // If card has no FR name (name === name_en), keep the existing FR name from collection
  const hasNoFrName = !card.name_en || card.name === card.name_en;
  const cardName = hasNoFrName && existing?.cardName ? existing.cardName : card.name;
  const cardNameEn = card.name_en || card.name;

  collection[key] = {
    cardId: card.id,
    cardName,
    cardNameEn,
    imageUrl: card.card_images?.[0]?.image_url_small,
    archetype: card.archetype,
    cardType: card.type,
    race: card.race,
    addedAt: existing?.addedAt || new Date().toISOString(),
    scanCount: (existing?.scanCount || 0) + 1,
  };

  await saveCollection(collection);
}

export async function isInCollection(cardId: number): Promise<boolean> {
  const collection = await getCollection();
  return String(cardId) in collection;
}

/**
 * Update card info (name, image, archetype) without changing scanCount.
 */
export async function updateCollectionEntry(card: YgoCard): Promise<void> {
  const collection = await getCollection();
  const key = String(card.id);
  const existing = collection[key];
  if (!existing) return;

  // Only update if we have better data (FR name vs EN name)
  const hasNewFrName = card.name_en && card.name !== card.name_en;
  const existingIsEn = !existing.cardNameEn || existing.cardName === existing.cardNameEn;

  if (hasNewFrName || existingIsEn) {
    existing.cardName = card.name;
    existing.cardNameEn = card.name_en || card.name;
  }
  existing.imageUrl = card.card_images?.[0]?.image_url_small || existing.imageUrl;
  existing.archetype = card.archetype || existing.archetype;
  existing.cardType = card.type || existing.cardType;
  existing.race = card.race || existing.race;

  await saveCollection(collection);
}

export async function getCollectionEntries(): Promise<CollectionEntry[]> {
  const collection = await getCollection();
  return Object.values(collection).sort(
    (a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime()
  );
}

/**
 * Backfill missing archetype/type data for old collection entries.
 * Processes max 20 cards per call to avoid blocking.
 * Calls onDone when at least one entry was updated.
 */
export async function backfillCollection(onDone: () => void): Promise<void> {
  const collection = await getCollection();
  const toFill = Object.values(collection)
    .filter((e) => !e.archetype && e.cardId > 0)
    .slice(0, 20); // Max 20 per batch

  if (toFill.length === 0) return;

  let updated = false;
  for (const entry of toFill) {
    try {
      const res = await fetch(
        `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${entry.cardId}`
      );
      if (res.ok) {
        const json = await res.json();
        const card = json.data?.[0];
        if (card) {
          entry.archetype = card.archetype || undefined;
          entry.cardType = card.type;
          entry.race = card.race;
          // Mark as backfilled even if no archetype, so we don't retry
          if (!entry.archetype) entry.archetype = "_none";
          collection[String(entry.cardId)] = entry;
          updated = true;
        }
      }
    } catch {
      // Skip
    }
  }

  if (updated) {
    await saveCollection(collection);
    onDone();
  }
}

/**
 * Decrement scan count by 1. Removes the card when count reaches 0.
 * Returns the new count (0 means deleted).
 */
export async function decrementFromCollection(cardId: number): Promise<number> {
  const collection = await getCollection();
  const key = String(cardId);
  const entry = collection[key];
  if (!entry) return 0;

  if (entry.scanCount <= 1) {
    delete collection[key];
    await saveCollection(collection);
    return 0;
  }

  entry.scanCount -= 1;
  await saveCollection(collection);
  return entry.scanCount;
}

export async function removeFromCollection(cardId: number): Promise<void> {
  const collection = await getCollection();
  delete collection[String(cardId)];
  await saveCollection(collection);
}

export async function getCollectionCount(): Promise<number> {
  const collection = await getCollection();
  return Object.keys(collection).length;
}
