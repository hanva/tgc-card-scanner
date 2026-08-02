import { useCallback, useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, ScrollView, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import {
  archetypesSorted, charactersSorted, buildSections, exportBlocks, norm,
  MarketCard, MarketDataset, Section,
} from "../src/services/market";
import { getWishDataset, removeWish } from "../src/services/marketApi";
import { MarketCardTile } from "../src/components/MarketCardTile";
import { Chip, ModeTab } from "../src/components/GroupControls";

const COLS = 3, H_PAD = 12, GAP = 8;
type Mode = "archetype" | "character";

type Row =
  | { type: "header"; key: string; title: string; count: number; cards: MarketCard[] }
  | { type: "cards"; key: string; cards: MarketCard[] };

/** Texte "Add Deck List" (1 nom/ligne, dédupliqué) prêt à coller dans cardmarket. */
function copyText(cards: MarketCard[]): string {
  return exportBlocks(cards, 100000)[0]?.join("\n") ?? "";
}
function uniqCount(cards: MarketCard[]): number {
  return exportBlocks(cards, 100000)[0]?.length ?? 0;
}

export default function WishlistScreen() {
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - H_PAD * 2 - GAP * (COLS - 1)) / COLS);

  const [dataset, setDataset] = useState<MarketDataset | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<Mode>("archetype");
  const [filterValue, setFilterValue] = useState<string | null>(null);
  const [showDups, setShowDups] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const d = await getWishDataset();
        if (active) { setDataset(d); setLoading(false); }
      })();
      return () => { active = false; };
    }, [])
  );

  const archetypes = useMemo(() => (dataset ? archetypesSorted(dataset) : []), [dataset]);
  const characters = useMemo(() => (dataset ? charactersSorted(dataset) : []), [dataset]);

  const sections = useMemo<Section[]>(
    () => (dataset ? buildSections(dataset, { mode, filterValue, query, matchFilter: "all", showDups }) : []),
    [dataset, mode, filterValue, query, showDups]
  );

  const rows = useMemo<Row[]>(() => {
    const r: Row[] = [];
    for (const sec of sections) {
      r.push({ type: "header", key: "h:" + sec.key, title: sec.title, count: sec.cards.length, cards: sec.cards });
      for (let i = 0; i < sec.cards.length; i += COLS) {
        r.push({ type: "cards", key: sec.key + ":" + i, cards: sec.cards.slice(i, i + COLS) });
      }
    }
    return r;
  }, [sections]);

  const copy = async (key: string, cards: MarketCard[]) => {
    await Clipboard.setStringAsync(copyText(cards));
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1800);
  };

  const removeCard = async (name: string) => {
    const id = norm(name);
    setDataset((d) => (d ? { ...d, cards: d.cards.filter((c) => norm(c.name) !== id) } : d));
    await removeWish(id);
    const fresh = await getWishDataset();
    if (fresh) setDataset(fresh);
  };

  const switchMode = (m: Mode) => { setMode(m); setFilterValue(null); };

  if (loading && !dataset) {
    return <View className="flex-1 bg-ygo-bg items-center justify-center"><ActivityIndicator color="#e6b800" size="large" /></View>;
  }

  const total = dataset?.cards.length ?? 0;

  return (
    <View className="flex-1 bg-ygo-bg">
      <View className="px-4 pt-3 pb-1 flex-row items-center justify-between">
        <Text className="text-ygo-gold text-lg font-black">Wishlist ({total})</Text>
        {total > 0 && (
          <TouchableOpacity
            className={`px-4 py-2 rounded-xl ${copiedKey === "__all__" ? "bg-ygo-gold-bright" : "bg-ygo-gold"}`}
            onPress={() => dataset && copy("__all__", dataset.cards)}
            activeOpacity={0.8}
          >
            <Text className="font-bold text-xs text-ygo-bg">
              {copiedKey === "__all__" ? "✓ Copié !" : `Tout copier (${dataset ? uniqCount(dataset.cards) : 0})`}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      <Text className="text-gray-500 text-[11px] px-4 mb-1 leading-4">
        Copie un archétype/perso (bouton dans chaque titre) ou tout, puis colle dans cardmarket › Mes souhaits › « Add Deck List » (150 max/liste).
        {"\n"}💡 Après l'import : tout cocher › Modifier la sélection › Langues = FR + EN (sinon le Shopping Wizard propose toutes les langues).
      </Text>

      {total === 0 ? (
        <Text className="text-gray-500 text-center mt-10 px-6">Aucune carte en wishlist.{"\n"}Touche ★ sur une carte (Marché, Collection, fiche…) pour l'ajouter.</Text>
      ) : (
        <>
          <View className="px-4 flex-row items-center gap-2 mt-1">
            <TextInput
              className="flex-1 bg-ygo-card text-white text-sm p-3 rounded-xl border border-ygo-muted"
              placeholder="Filtrer par nom…"
              placeholderTextColor="#666"
              value={query}
              onChangeText={setQuery}
            />
            <TouchableOpacity
              className={`px-3 py-3 rounded-xl border ${showDups ? "bg-ygo-gold border-ygo-gold-bright" : "bg-ygo-card border-ygo-muted"}`}
              onPress={() => setShowDups((v) => !v)}
              activeOpacity={0.8}
            >
              <Text className={`text-xs font-bold ${showDups ? "text-ygo-bg" : "text-gray-300"}`}>Doublons</Text>
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
            extraData={dataset}
            contentContainerStyle={{ padding: H_PAD, paddingBottom: 32 }}
            ListEmptyComponent={<Text className="text-gray-500 text-center mt-10">Aucune carte.</Text>}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            renderItem={({ item }) =>
              item.type === "header" ? (
                <View className="flex-row items-center justify-between mb-2 mt-3">
                  <View className="flex-row items-baseline flex-1 mr-2">
                    <Text className="text-ygo-archetype text-base font-black" numberOfLines={1}>{item.title}</Text>
                    <Text className="text-gray-500 text-xs ml-2">{item.count}</Text>
                  </View>
                  <TouchableOpacity
                    className={`px-3 py-1.5 rounded-lg ${copiedKey === item.key ? "bg-ygo-gold-bright" : "bg-ygo-card border border-ygo-gold/40"}`}
                    onPress={() => copy(item.key, item.cards)}
                    activeOpacity={0.8}
                  >
                    <Text className={`text-[11px] font-bold ${copiedKey === item.key ? "text-ygo-bg" : "text-ygo-gold"}`}>
                      {copiedKey === item.key ? "✓ Copié" : `Copier (${uniqCount(item.cards)})`}
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
                  {item.cards.map((c, i) => (
                    <MarketCardTile
                      key={c.articleId || `${c.name}-${i}`}
                      card={c}
                      width={tileW}
                      wished
                      halo
                      onToggleWish={() => removeCard(c.name)}
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
