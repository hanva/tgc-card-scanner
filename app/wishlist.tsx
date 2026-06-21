import { useCallback, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Share, useWindowDimensions } from "react-native";
import { useFocusEffect } from "expo-router";
import { listWish, removeWish, getWishExport, WishItem } from "../src/services/marketApi";
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

  const exportList = async () => {
    const text = await getWishExport();
    if (text) Share.share({ message: text });
  };

  const rows: WishItem[][] = [];
  for (let i = 0; i < items.length; i += COLS) rows.push(items.slice(i, i + COLS));

  if (loading) {
    return <View className="flex-1 bg-ygo-bg items-center justify-center"><ActivityIndicator color="#e6b800" size="large" /></View>;
  }

  return (
    <View className="flex-1 bg-ygo-bg">
      <View className="px-4 pt-3 pb-1 flex-row items-center justify-between">
        <Text className="text-ygo-gold text-lg font-black">Wishlist ({items.length})</Text>
        <TouchableOpacity
          className={`px-4 py-2 rounded-xl ${items.length ? "bg-ygo-gold" : "bg-ygo-muted"}`}
          onPress={exportList}
          disabled={!items.length}
          activeOpacity={0.8}
        >
          <Text className={`font-bold text-xs ${items.length ? "text-ygo-bg" : "text-gray-500"}`}>EXPORTER</Text>
        </TouchableOpacity>
      </View>
      <Text className="text-gray-500 text-[11px] px-4 mb-2 leading-4">
        Export → partage/copie le texte, puis colle dans cardmarket › Mes souhaits › « Add Deck List » (150 cartes max par liste).
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
