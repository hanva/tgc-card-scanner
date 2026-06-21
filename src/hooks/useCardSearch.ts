import { useState, useCallback, useRef } from "react";
import { YgoCard } from "../types/card";
import { searchCards } from "../services/ygoprodeck";
import { storeCard } from "../services/cardStore";

export function useCardSearch() {
  const [results, setResults] = useState<YgoCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const requestIdRef = useRef(0);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Set codes should search immediately (no debounce)
    const isSetCode = /[A-Z0-9]{2,5}-[A-Z]{2}/i.test(query.trim());
    const delay = isSetCode ? 100 : 400;

    debounceRef.current = setTimeout(async () => {
      const currentId = ++requestIdRef.current;
      try {
        const cards = await searchCards(query);
        // Only update if this is still the latest request
        if (currentId !== requestIdRef.current) return;
        cards.forEach(storeCard);
        setResults(cards);
        if (cards.length === 0) {
          setError("Aucune carte trouvée");
        }
      } catch {
        if (currentId !== requestIdRef.current) return;
        setError("Erreur de connexion");
        setResults([]);
      } finally {
        if (currentId === requestIdRef.current) {
          setLoading(false);
        }
      }
    }, delay);
  }, []);

  return { results, loading, error, search };
}
