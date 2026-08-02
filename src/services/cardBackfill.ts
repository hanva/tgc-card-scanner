import { getCollectionEntries } from "./collection";
import { getStoredCard, storeCard } from "./cardStore";
import { YgoCard } from "../types/card";

const BASE_URL = "https://db.ygoprodeck.com/api/v7/cardinfo.php";

/**
 * Rattrapage : complète la base locale avec les fiches (dont codes de set) de toutes
 * les cartes DÉJÀ scannées dans la collection. Batch de 50 ids par requête,
 * EN (données complètes + card_sets) + FR (noms) fusionnés.
 * Idempotent et silencieux : au 2e lancement, plus rien à rattraper → 0 requête.
 */
export async function backfillCardDb(): Promise<number> {
  try {
    const entries = await getCollectionEntries();
    const missing = [
      ...new Set(
        entries
          .map((e) => e.cardId)
          .filter((id) => id > 0) // ids négatifs = fiches Yugipedia locales, rien à récupérer
          .filter((id) => {
            const c = getStoredCard(id);
            return !c || !c.card_sets?.length;
          })
      ),
    ];
    if (missing.length === 0) return 0;

    let done = 0;
    for (let i = 0; i < missing.length; i += 50) {
      const chunk = missing.slice(i, i + 50).join(",");
      try {
        const [enRes, frRes] = await Promise.all([
          fetch(`${BASE_URL}?id=${chunk}`),
          fetch(`${BASE_URL}?id=${chunk}&language=fr`),
        ]);
        const en: YgoCard[] = enRes.ok ? (await enRes.json()).data || [] : [];
        const fr: YgoCard[] = frRes.ok ? (await frRes.json()).data || [] : [];
        const frById = new Map(fr.map((c) => [c.id, c]));
        for (const c of en) {
          const f = frById.get(c.id);
          storeCard(f ? { ...c, name: f.name, name_en: c.name, desc: f.desc || c.desc } : c);
          done++;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 350)); // rate-limit friendly
    }
    return done;
  } catch {
    return 0;
  }
}
