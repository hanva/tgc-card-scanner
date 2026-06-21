import { useEffect, useState, useMemo } from "react";
import {
  View, Text, Image, FlatList, TouchableOpacity, ActivityIndicator, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import characterData from "../../src/data/character-cards.json";
import cardEpisodesRaw from "../../src/data/card-episodes.json";
import { CHARACTER_AVATARS } from "../../src/services/avatars";
import { getCollectionEntries, CollectionEntry } from "../../src/services/collection";
import { getCardById } from "../../src/services/ygoprodeck";
import { getStoredCard, storeCard } from "../../src/services/cardStore";
import { YgoCard } from "../../src/types/card";
import { EpisodeAppearance } from "../../src/types/character";
import { Arc, getArcsForSeries, getArcForEpisode } from "../../src/utils/arcs";

const cardEpisodes = cardEpisodesRaw as Record<
  string,
  { characterId: string; episodes: EpisodeAppearance[] }[]
>;

interface CardWithArc {
  cardId: number;
  cardName: string;
  arcs: Set<string>;
  imageUrl?: string;
  owned: boolean;
}

export default function CharacterProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedArc, setSelectedArc] = useState<string>("all");
  const [cards, setCards] = useState<CardWithArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<Set<number>>(new Set());

  const character = useMemo(
    () => characterData.characters.find((c) => c.id === id),
    [id]
  );
  const series = character?.series || "DM";
  const arcs = useMemo(() => getArcsForSeries(series), [series]);
  const avatar = id ? CHARACTER_AVATARS[id] : undefined;

  useEffect(() => {
    if (!id) return;
    (async () => {
      // Get collection
      const entries = await getCollectionEntries();
      const ownedIds = new Set(entries.map((e) => e.cardId));
      setCollection(ownedIds);

      // Get character's cards
      const mapping = characterData.mappings.find((m) => m.characterId === id);
      if (!mapping) {
        setLoading(false);
        return;
      }

      const cardList: CardWithArc[] = [];

      for (let i = 0; i < mapping.cardIds.length; i++) {
        const cardId = mapping.cardIds[i];
        const cardName = mapping.cardNames[i];
        const cardArcs = new Set<string>();

        // Find arcs from episodes
        const epEntries = cardEpisodes[String(cardId)];
        if (epEntries) {
          for (const entry of epEntries) {
            if (entry.characterId === id) {
              for (const ep of entry.episodes) {
                const arc = getArcForEpisode(ep.id);
                if (arc) cardArcs.add(arc.id);
              }
            }
          }
        }

        // Get image from store or fetch
        let imageUrl: string | undefined;
        const stored = getStoredCard(cardId);
        if (stored?.card_images?.[0]) {
          imageUrl = stored.card_images[0].image_url_small;
        }

        cardList.push({
          cardId,
          cardName,
          arcs: cardArcs,
          imageUrl,
          owned: ownedIds.has(cardId),
        });
      }

      // Show cards immediately, then fetch images in background
      setCards([...cardList]);
      setLoading(false);

      // Fetch images for cards without them
      const needImages = cardList.filter((c) => !c.imageUrl);
      let updated = 0;
      for (let i = 0; i < needImages.length; i++) {
        try {
          const card = await getCardById(needImages[i].cardId);
          if (card?.card_images?.[0]) {
            needImages[i].imageUrl = card.card_images[0].image_url_small;
            storeCard(card);
            updated++;
            // Update UI every 5 cards
            if (updated % 5 === 0) setCards([...cardList]);
          }
        } catch {}
      }
      if (updated > 0) setCards([...cardList]);
    })();
  }, [id]);

  const filteredCards = useMemo(() => {
    if (selectedArc === "all") return cards;
    return cards.filter((c) => c.arcs.has(selectedArc));
  }, [cards, selectedArc]);

  const ownedCount = filteredCards.filter((c) => c.owned).length;

  // Only show arcs that have cards
  const activeArcs = useMemo(() => {
    const arcIds = new Set<string>();
    for (const card of cards) {
      for (const arcId of card.arcs) arcIds.add(arcId);
    }
    return arcs.filter((a) => arcIds.has(a.id));
  }, [cards, arcs]);

  if (loading) {
    return (
      <View className="flex-1 bg-ygo-bg items-center justify-center">
        <ActivityIndicator size="large" color="#e6b800" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ygo-bg">
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-3"
        style={{ paddingTop: insets.top + 12 }}
      >
        <TouchableOpacity onPress={() => router.back()} className="mr-3">
          <Text className="text-ygo-gold text-2xl">←</Text>
        </TouchableOpacity>
        {avatar ? (
          <Image source={{ uri: avatar }} className="w-12 h-12 rounded-full mr-3 bg-ygo-card" />
        ) : (
          <View className="w-12 h-12 rounded-full mr-3 bg-ygo-card items-center justify-center">
            <Text className="text-ygo-gold text-lg font-bold">
              {(character?.nameFr || character?.name || "?")[0]}
            </Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-white text-xl font-bold">
            {character?.nameFr || character?.name || id}
          </Text>
          <View className="flex-row items-center mt-0.5">
            <View className={`px-2 py-0.5 rounded mr-2 ${series === "DM" ? "bg-ygo-dm" : "bg-ygo-gx"}`}>
              <Text className="text-white text-[10px] font-bold">{series}</Text>
            </View>
            <Text className="text-gray-500 text-xs">{cards.length} cartes</Text>
          </View>
        </View>
      </View>

      {/* Arc tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-3 pb-2" contentContainerStyle={{ gap: 8 }}>
        <TouchableOpacity
          className={`h-8 justify-center px-3.5 rounded-full border ${selectedArc === "all" ? "bg-ygo-gold border-ygo-gold" : "bg-ygo-card border-ygo-muted"}`}
          onPress={() => setSelectedArc("all")}
        >
          <Text className={`text-[12px] font-semibold ${selectedArc === "all" ? "text-ygo-bg" : "text-gray-500"}`}>
            Toutes
          </Text>
        </TouchableOpacity>
        {activeArcs.map((arc) => (
          <TouchableOpacity
            key={arc.id}
            className={`h-8 justify-center px-3.5 rounded-full border ${selectedArc === arc.id ? "bg-ygo-gold border-ygo-gold" : "bg-ygo-card border-ygo-muted"}`}
            onPress={() => setSelectedArc(arc.id)}
          >
            <Text className={`text-[12px] font-semibold ${selectedArc === arc.id ? "text-ygo-bg" : "text-gray-500"}`}>
              {arc.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Counter */}
      <View className="px-4 pb-2">
        <Text className="text-gray-500 text-xs">
          {ownedCount}/{filteredCards.length} cartes possédées
        </Text>
        <View className="h-1.5 bg-ygo-card rounded-full mt-1 overflow-hidden">
          <View
            className="h-full bg-ygo-gold rounded-full"
            style={{ width: `${filteredCards.length > 0 ? (ownedCount / filteredCards.length) * 100 : 0}%` }}
          />
        </View>
      </View>

      {/* Card grid */}
      <FlatList
        data={filteredCards}
        numColumns={3}
        keyExtractor={(item) => String(item.cardId)}
        contentContainerStyle={{ padding: 8 }}
        columnWrapperStyle={{ gap: 8 }}
        ItemSeparatorComponent={() => <View className="h-2" />}
        renderItem={({ item }) => (
          <TouchableOpacity
            className="flex-1"
            style={{ maxWidth: "33%" }}
            activeOpacity={0.7}
            onPress={() => router.push({ pathname: `/card/${item.cardId}`, params: { from: "collection" } })}
          >
            <View className={`rounded-lg overflow-hidden ${item.owned ? "" : "opacity-30"}`}>
              {item.imageUrl ? (
                <Image
                  source={{ uri: item.imageUrl }}
                  className="w-full aspect-[59/86] rounded-lg"
                />
              ) : (
                <Image
                  source={{ uri: "https://images.ygoprodeck.com/images/cards/back_high.jpg" }}
                  className="w-full aspect-[59/86] rounded-lg"
                />
              )}
            </View>
            <Text
              className={`text-[10px] mt-1 text-center ${item.owned ? "text-gray-300" : "text-gray-600"}`}
              numberOfLines={1}
            >
              {item.cardName}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="items-center py-10">
            <Text className="text-gray-600 italic">Aucune carte pour cet arc</Text>
          </View>
        }
      />
    </View>
  );
}
