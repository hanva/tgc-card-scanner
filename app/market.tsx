import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { archetypesSorted, charactersSorted, norm, MarketCard, MarketDataset } from "../src/services/market";
import { listSellers, getDataset, listWish, addWish, removeWish, SellerSummary } from "../src/services/marketApi";
import { MarketCardTile } from "../src/components/MarketCardTile";
import { useScan } from "../src/services/scanController";

type Mode = "archetype" | "character";
interface Section { key: string; title: string; cards: MarketCard[] }

// Une carte = une vignette, même si plusieurs offres (raretés/éditions) → on garde la moins chère.
function dedupeByName(cards: MarketCard[]): MarketCard[] {
  const by = new Map<string, MarketCard>();
  for (const c of cards) {
    const k = norm(c.name); // normalisé → collapse les variantes/raretés (ex "(V.1 - Ultra Rare)")
    const ex = by.get(k);
    if (!ex) by.set(k, c);
    else if ((c.price ?? Infinity) < (ex.price ?? Infinity)) by.set(k, c);
  }
  return [...by.values()];
}

const COLS = 3;
const H_PAD = 12;
const GAP = 8;

export default function MarketScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ seller?: string }>();
  const scan = useScan();
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - H_PAD * 2 - GAP * (COLS - 1)) / COLS);

  const [sellers, setSellers] = useState<SellerSummary[]>([]);
  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("archetype");
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [matchFilter, setMatchFilter] = useState<"matched" | "unmatched" | "all">("matched");
  const [wished, setWished] = useState<Set<string>>(new Set());

  const toggleWish = async (card: MarketCard) => {
    const id = norm(card.name);
    const next = new Set(wished);
    if (next.has(id)) {
      next.delete(id);
      setWished(next);
      await removeWish(id);
    } else {
      next.add(id);
      setWished(next);
      await addWish({
        name: card.name, image: card.image, expansionCode: card.expansionCode,
        price: card.price, offerUrl: card.offerUrl, seller: dataset?.seller,
      });
    }
  };

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const [list, wl] = await Promise.all([listSellers(), listWish()]);
        if (!active) return;
        setSellers(list);
        setWished(new Set(wl.map((w) => w.id)));
        const target = params.seller || dataset?.seller || list[0]?.seller;
        if (target) {
          const d = await getDataset(target);
          if (active && d) setDataset(d);
        }
        setLoading(false);
      })();
      return () => { active = false; };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [params.seller])
  );

  const selectSeller = async (s: string) => {
    setFilterValue(null);
    const d = await getDataset(s);
    if (d) setDataset(d);
  };

  const archetypes = useMemo(() => (dataset ? archetypesSorted(dataset) : []), [dataset]);
  const characters = useMemo(() => (dataset ? charactersSorted(dataset) : []), [dataset]);

  const sections = useMemo<Section[]>(() => {
    if (!dataset) return [];
    const q = query.trim().toLowerCase();
    const pass = (c: MarketCard) => !q || c.name.toLowerCase().includes(q);
    const matched = dataset.cards.filter((c) => c.isMatched && pass(c));
    const out: Section[] = [];

    if (matchFilter !== "unmatched") {
      if (mode === "archetype") {
        for (const a of archetypes) {
          if (filterValue && filterValue !== a.name) continue;
          const cards = dedupeByName(matched.filter((c) => c.matched!.archetypes.includes(a.name)));
          if (cards.length) out.push({ key: "a:" + a.name, title: a.name, cards });
        }
      } else {
        for (const ch of characters) {
          if (filterValue && filterValue !== ch.id) continue;
          const cards = dedupeByName(matched.filter((c) => c.matched!.characters.includes(ch.id)));
          if (cards.length) out.push({ key: "c:" + ch.id, title: ch.name, cards });
        }
      }
    }
    if (matchFilter !== "matched" && !filterValue) {
      const unmatched = dedupeByName(dataset.cards.filter((c) => !c.isMatched && pass(c)));
      if (unmatched.length) out.push({ key: "unmatched", title: "Non liées", cards: unmatched });
    }
    return out;
  }, [dataset, query, mode, filterValue, matchFilter, archetypes, characters]);

  // Aplatissement en rangées (en-tête | rangée de 3 cartes) pour virtualiser toute la liste
  // → seules les rangées visibles se rendent (les images chargent au scroll).
  type Row =
    | { type: "header"; key: string; title: string; count: number }
    | { type: "cards"; key: string; cards: MarketCard[] };
  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    for (const sec of sections) {
      r.push({ type: "header", key: "h:" + sec.key, title: sec.title, count: sec.cards.length });
      for (let i = 0; i < sec.cards.length; i += COLS) {
        r.push({ type: "cards", key: sec.key + ":" + i, cards: sec.cards.slice(i, i + COLS) });
      }
    }
    return r;
  }, [sections]);

  const switchMode = (m: Mode) => { setMode(m); setFilterValue(null); };

  if (loading && !dataset) {
    return <View className="flex-1 bg-ygo-bg items-center justify-center"><ActivityIndicator color="#e6b800" size="large" /></View>;
  }

  return (
    <View className="flex-1 bg-ygo-bg">
      {/* Bandeau : scan en cours masqué → revenir à la WebView */}
      {scan.active && !scan.visible && (
        <TouchableOpacity onPress={scan.show} className="flex-row items-center justify-between px-4 py-2 bg-ygo-archetype" activeOpacity={0.85}>
          <Text className="text-white text-xs font-bold" numberOfLines={1}>
            ● Scan {scan.seller}
            {scan.progress ? ` · ${scan.progress.cards} cartes${scan.progress.total ? ` · ${scan.progress.index}/${scan.progress.total}` : ""}` : ""}
          </Text>
          <Text className="text-white text-xs font-bold">Voir ▸</Text>
        </TouchableOpacity>
      )}

      {/* Sélecteur de vendeurs + scan */}
      <View className="pt-2">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, alignItems: "center", paddingHorizontal: 16, paddingVertical: 6 }}>
          {sellers.map((s) => (
            <Chip key={s.seller} label={`${s.seller} (${s.totalMatched})`} active={dataset?.seller === s.seller} onPress={() => selectSeller(s.seller)} />
          ))}
          <TouchableOpacity className="px-3 py-2 rounded-full bg-ygo-gold border border-ygo-gold-bright" onPress={() => scan.show()} activeOpacity={0.8}>
            <Text className="text-ygo-bg text-xs font-bold">{scan.active ? "▸ Voir le scan" : "＋ Scanner"}</Text>
          </TouchableOpacity>
          <TouchableOpacity className="px-3 py-2 rounded-full bg-ygo-card border border-ygo-gold" onPress={() => router.push("/wishlist")} activeOpacity={0.8}>
            <Text className="text-ygo-gold text-xs font-bold">★ Wishlist{wished.size ? ` (${wished.size})` : ""}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {!dataset ? (
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-gray-400 text-center mb-4">Aucun vendeur scrapé. Lance un scan pour commencer.</Text>
          <TouchableOpacity className="bg-ygo-gold py-3 px-6 rounded-xl" onPress={() => scan.show()} activeOpacity={0.8}>
            <Text className="text-ygo-bg font-bold">Scanner un vendeur</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <View className="px-4 pt-1 pb-1">
            <Text className="text-gray-400 text-xs">
              {dataset.totalMatched} cartes liées · {dataset.total} scannées
              {dataset.partial ? ` (partiel, ${dataset.editionsDone}${dataset.editionsTotal ? "/" + dataset.editionsTotal : ""} éditions)` : ""}
            </Text>
          </View>

          <View className="px-4 flex-row items-center gap-2">
            <TextInput
              className="flex-1 bg-ygo-card text-white text-sm p-3 rounded-xl border border-ygo-muted"
              placeholder="Filtrer par nom…"
              placeholderTextColor="#666"
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity
              className={`px-3 py-3 rounded-xl border ${matchFilter === "all" ? "bg-ygo-card border-ygo-muted" : "bg-ygo-gold border-ygo-gold-bright"}`}
              onPress={() => setMatchFilter((m) => (m === "matched" ? "unmatched" : m === "unmatched" ? "all" : "matched"))}
              activeOpacity={0.8}
            >
              <Text className={`text-xs font-bold ${matchFilter === "all" ? "text-gray-300" : "text-ygo-bg"}`}>
                {matchFilter === "matched" ? "Liées" : matchFilter === "unmatched" ? "Non liées" : "Toutes"}
              </Text>
            </TouchableOpacity>
          </View>

          <View className="px-4 mt-2 flex-row gap-2">
            <ModeTab label="Archétypes" active={mode === "archetype"} onPress={() => switchMode("archetype")} />
            <ModeTab label="Persos" active={mode === "character"} onPress={() => switchMode("character")} />
          </View>

          <View className="mt-1">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 6, gap: 6 }}>
              <Chip label="Tous" active={filterValue === null} onPress={() => setFilterValue(null)} />
              {mode === "archetype"
                ? archetypes.map((a) => <Chip key={a.name} label={`${a.name} ${a.count}`} active={filterValue === a.name} onPress={() => setFilterValue(a.name)} />)
                : characters.map((c) => <Chip key={c.id} label={`${c.name} ${c.count}`} active={filterValue === c.id} onPress={() => setFilterValue(c.id)} />)}
            </ScrollView>
          </View>

          <FlatList
            data={rows}
            keyExtractor={(r) => r.key}
            contentContainerStyle={{ padding: H_PAD, paddingBottom: 32 }}
            ListEmptyComponent={<Text className="text-gray-500 text-center mt-10">Aucune carte.</Text>}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            renderItem={({ item }) =>
              item.type === "header" ? (
                <View className="flex-row items-baseline mb-2 mt-3">
                  <Text className="text-ygo-archetype text-base font-black">{item.title}</Text>
                  <Text className="text-gray-500 text-xs ml-2">{item.count}</Text>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
                  {item.cards.map((c, i) => (
                    <MarketCardTile
                      key={c.articleId || `${c.name}-${i}`}
                      card={c}
                      width={tileW}
                      wished={wished.has(norm(c.name))}
                      onToggleWish={toggleWish}
                    />
                  ))}
                </View>
              )
            }
          />
        </>
      )}
    </View>
  );
}

function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className={`flex-1 items-center py-2 rounded-lg border ${active ? "bg-ygo-gold border-ygo-gold-bright" : "bg-ygo-card border-ygo-muted"}`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className={`text-xs font-bold ${active ? "text-ygo-bg" : "text-gray-300"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className={`px-3 py-2 rounded-full border ${active ? "bg-ygo-gold border-ygo-gold-bright" : "bg-ygo-card border-ygo-muted"}`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className={`text-xs font-semibold ${active ? "text-ygo-bg" : "text-gray-300"}`}>{label}</Text>
    </TouchableOpacity>
  );
}
