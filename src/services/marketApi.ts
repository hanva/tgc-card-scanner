/**
 * Client de l'API Marché (backend tgc-market-api). Remplace le stockage local (marketStore).
 * Le backend stocke les cartes, matche côté serveur (639 archétypes), et sert les datasets.
 *
 * ⚠️ En dev : pointe sur le backend local (machine sur le même WiFi que le tél).
 *    En prod : remplacer par https://api.tran-nicolas.fr et renseigner API_KEY.
 */
import { MarketDataset, MarketCard } from "./market";

// Config via .env (EXPO_PUBLIC_*, non commité) → la clé API ne part PAS dans git.
// Fallback : URL de prod / clé vide. Dev local : EXPO_PUBLIC_MARKET_API_BASE=http://192.168.1.21:8787
export const API_BASE: string = process.env.EXPO_PUBLIC_MARKET_API_BASE || "https://ygo-api.tran-nicolas.com";
export const API_KEY: string = process.env.EXPO_PUBLIC_MARKET_API_KEY || "";

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (API_KEY) h["X-API-Key"] = API_KEY;
  return h;
}

export interface SellerSummary {
  seller: string;
  total: number;
  totalMatched: number;
  editionsDone: number;
  editionsTotal: number | null;
  updatedAt?: string | null;
}

export async function listSellers(): Promise<SellerSummary[]> {
  try {
    const r = await fetch(`${API_BASE}/sellers`, { headers: headers() });
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

/** Dataset complet matché d'un vendeur (forme MarketDataset, prête pour l'UI existante). */
export async function getDataset(seller: string): Promise<MarketDataset | null> {
  try {
    const r = await fetch(`${API_BASE}/sellers/${encodeURIComponent(seller)}/full`, { headers: headers() });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export interface SellerState {
  doneIds: string[];
  editionsDone: number;
  editionsTotal: number | null;
  total: number;
  totalMatched: number;
}
export async function getSellerState(seller: string): Promise<SellerState> {
  try {
    const r = await fetch(`${API_BASE}/sellers/${encodeURIComponent(seller)}`, { headers: headers() });
    if (r.ok) return await r.json();
  } catch {}
  return { doneIds: [], editionsDone: 0, editionsTotal: null, total: 0, totalMatched: 0 };
}

/** Ingest d'un lot de cartes brutes scrapées (le backend re-matche). */
export async function ingestCards(seller: string, cards: MarketCard[]): Promise<void> {
  try {
    await fetch(`${API_BASE}/sellers/${encodeURIComponent(seller)}/cards`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ cards }),
    });
  } catch {}
}

export async function postMeta(
  seller: string,
  meta: { editionsDone?: number; editionsTotal?: number; doneIds?: string[] }
): Promise<void> {
  try {
    await fetch(`${API_BASE}/sellers/${encodeURIComponent(seller)}/meta`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(meta),
    });
  } catch {}
}

// ─── Wishlist (interne, exportable en "Add Deck List" cardmarket) ───

export interface WishItem {
  id: string; name: string; image: string | null; expansionCode: string | null;
  price: number | null; offerUrl: string | null; seller: string | null; addedAt: string;
}

export async function listWish(): Promise<WishItem[]> {
  try {
    const r = await fetch(`${API_BASE}/wishlist`, { headers: headers() });
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

export async function addWish(card: {
  name: string; image?: string; expansionCode?: string; price?: number | null; offerUrl?: string; seller?: string;
}): Promise<void> {
  try {
    await fetch(`${API_BASE}/wishlist`, { method: "POST", headers: headers(), body: JSON.stringify(card) });
  } catch {}
}

export async function removeWish(id: string): Promise<void> {
  try {
    await fetch(`${API_BASE}/wishlist/${encodeURIComponent(id)}`, { method: "DELETE", headers: headers() });
  } catch {}
}

/** Texte au format cardmarket "Add Deck List" (1 carte/ligne, découpé par 150). */
export async function getWishExport(): Promise<string> {
  try {
    const r = await fetch(`${API_BASE}/wishlist/export`, { headers: headers() });
    return r.ok ? await r.text() : "";
  } catch {
    return "";
  }
}
