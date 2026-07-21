import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { listWish, addWish, addWishBulk, removeWish } from "../services/marketApi";
import { norm } from "../services/market";

export interface WishExtra {
  image?: string;
  expansionCode?: string;
  price?: number | null;
  offerUrl?: string;
  seller?: string;
}

/**
 * État wishlist partagé (fiche carte, collection, perso, recherche…).
 * Clé = nom normalisé (règle unique). On passe TOUJOURS le nom anglais de la carte
 * (name_en) pour rester cohérent avec le Marché + l'export cardmarket.
 */
export function useWishlist() {
  const [wished, setWished] = useState<Set<string>>(new Set());

  const load = useCallback(async (active: () => boolean) => {
    const wl = await listWish();
    if (active()) setWished(new Set(wl.map((w) => w.id)));
  }, []);

  useFocusEffect(
    useCallback(() => {
      let on = true;
      load(() => on);
      return () => { on = false; };
    }, [load])
  );

  const reload = useCallback(async () => {
    const wl = await listWish();
    setWished(new Set(wl.map((w) => w.id)));
  }, []);

  const isWished = useCallback((name: string) => wished.has(norm(name)), [wished]);

  const toggle = useCallback(
    async (name: string, extra?: WishExtra) => {
      const id = norm(name);
      const has = wished.has(id);
      setWished((prev) => {
        const next = new Set(prev);
        if (has) next.delete(id); else next.add(id);
        return next;
      });
      if (has) await removeWish(id);
      else await addWish({ name, ...extra });
    },
    [wished]
  );

  const addMany = useCallback(async (items: { name: string; image?: string }[]) => {
    setWished((prev) => {
      const next = new Set(prev);
      for (const it of items) next.add(norm(it.name));
      return next;
    });
    await addWishBulk(items);
  }, []);

  const removeMany = useCallback(async (names: string[]) => {
    const ids = names.map(norm);
    setWished((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
    await Promise.all(ids.map((id) => removeWish(id)));
  }, []);

  return { wished, isWished, toggle, addMany, removeMany, reload };
}
