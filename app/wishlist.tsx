import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, useWindowDimensions } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { listWish, removeWish, WishItem } from "../src/services/marketApi";
import { MarketCard } from "../src/services/market";
import { MarketCardTile } from "../src/components/MarketCardTile";

const COLS = 3, H_PAD = 12, GAP = 8;

function wishToCard(w: WishItem): MarketCard {
  return {
    articleId: w.id, name: w.name, expansion: "", expansionCode: w.expansionCode || "",
    rarity: "", condition: "", conditionCode: "", language: "",
    price: w.price, amount: null, firstEd: false, offerUrl: w.offerUrl || "",
    image: w.image || undefined, isMatched: true, matched: null, expansionSlice: "",
  };
}

export default function WishlistScreen() {
  const { width } = useWindowDimensions();
  const tileW = Math.floor((width - H_PAD * 2 - GAP * (COLS - 1)) / COLS);
  const [items, setItems] = useState<WishItem[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        setLoading(true);
        const w = await listWish();
        if (active) { setItems(w); setLoading(false); }
      })();
      return () => { active = false; };
    }, [])
  );

  const remove = async (w: WishItem) => {
    setItems((prev) => prev.filter((x) => x.id !== w.id));
    await removeWish(w.id);
  };

  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Export cardmarket "Add Deck List" : 1 nom/ligne, noms nettoyés (sans variantes entre parenthèses),
  // dédupliqués, découpés en blocs de 150 (limite cardmarket). Copie directe presse-papier (fiable,
  // contrairement à Share qui tronquait le texte).
  const CHUNK = 150;
  const exportName = (n: string) => (n || "").replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const names = [...new Set(items.map((w) => exportName(w.name)).filter(Boolean))];
  const blocks: string[][] = [];
  for (let i = 0; i < names.length; i += CHUNK) blocks.push(names.slice(i, i + CHUNK));

  const copyBlock = async (idx: number) => {
    await Clipboard.setStringAsync(blocks[idx].join("\n"));
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx((c) => (c === idx ? null : c)), 1800);
  };

  const rows: WishItem[][] = [];
  for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS));

  if (loading) {
    return <View className="flex-1 bg-ygo-bg items-center justify-center"><ActivityIndicator color="#e6b800" size="large" /></View>;
  }

  return (
    <View className="flex-1 bg-ygo-bg">
      <View className="px-4 pt-3 pb-1">
        <Text className="text-ygo-gold text-lg font-black mb-2">Wishlist ({items.length})</Text>
        {items.length > 0 && (
          <View className="flex-row flex-wrap gap-2">
            {blocks.map((b, i) => (
              <TouchableOpacity
                key={i}
                className={`px-4 py-2 rounded-xl ${copiedIdx === i ? "bg-ygo-gold-bright" : "bg-ygo-gold"}`}
                onPress={() => copyBlock(i)}
                activeOpacity={0.8}
              >
                <Text className="font-bold text-xs text-ygo-bg">
                  {copiedIdx === i ? "✓ Copié !" : blocks.length > 1 ? `Copier liste ${i + 1} (${b.length})` : `Copier (${b.length})`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <Text className="text-gray-500 text-[11px] px-4 mb-2 leading-4">
        Copie {blocks.length > 1 ? "chaque liste" : "la liste"}, puis colle dans cardmarket › Mes souhaits › « Add Deck List ».
        {blocks.length > 1 ? ` cardmarket = 150 cartes max/liste → ${blocks.length} listes à coller une par une.` : ""}
      </Text>
      <FlatList
        data={rows}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ padding: H_PAD, paddingBottom: 32 }}
        ListEmptyComponent={<Text className="text-gray-500 text-center mt-10">Aucune carte en wishlist.{"\n"}Touche ★ sur une carte du Marché pour l'ajouter.</Text>}
        renderItem={({ item }) => (
          <View style={{ flexDirection: "row", gap: GAP, marginBottom: GAP }}>
            {item.map((w) => (
              <MarketCardTile key={w.id} card={wishToCard(w)} width={tileW} wished onToggleWish={() => remove(w)} />
            ))}
          </View>
        )}
      />
    </View>
  );
}
