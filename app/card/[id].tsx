import { useEffect, useState } from "react";
import {
  View, Text, Image, ScrollView, ActivityIndicator, TouchableOpacity, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { YgoCard } from "../../src/types/card";
import { getCardById } from "../../src/services/ygoprodeck";
import { getCharactersForCard } from "../../src/services/characterLookup";
import { CharacterResult } from "../../src/types/character";
import { CharacterBadge } from "../../src/components/CharacterBadge";
import { getStoredCard } from "../../src/services/cardStore";
import {
  isInCollection, addToCollection, decrementFromCollection, updateCollectionEntry,
} from "../../src/services/collection";

export default function CardDetailScreen() {
  const { id, from } = useLocalSearchParams<{ id: string; from?: string }>();
  const router = useRouter();
  const [card, setCard] = useState<YgoCard | null>(null);
  const [characters, setCharacters] = useState<CharacterResult[]>([]);
  const [inCollection, setInCollection] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const cardId = Number(id);
    (async () => {
      const fetchedCard = getStoredCard(cardId) || await getCardById(cardId);
      setCard(fetchedCard);
      if (fetchedCard) {
        setCharacters(getCharactersForCard(fetchedCard));
        if (from === "scan") {
          await addToCollection(fetchedCard);
        } else {
          // Update card info (FR name, archetype) without incrementing scan count
          await updateCollectionEntry(fetchedCard);
        }
      }
      setInCollection(await isInCollection(cardId));
      setLoading(false);
    })();
  }, [id]);

  const handleDecrement = async () => {
    if (!card) return;
    const newCount = await decrementFromCollection(card.id);
    if (newCount === 0) setInCollection(false);
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-ygo-bg">
        <ActivityIndicator size="large" color="#e6b800" />
      </View>
    );
  }

  if (!card) {
    return (
      <View className="flex-1 items-center justify-center bg-ygo-bg">
        <Text className="text-ygo-danger text-base">Carte introuvable</Text>
      </View>
    );
  }

  const imageUrl = card.card_images?.[0]?.image_url;

  return (
    <ScrollView className="flex-1 bg-ygo-bg" contentContainerStyle={{ alignItems: "center", padding: 20, paddingBottom: 40 }}>
      {imageUrl && (
        <Image source={{ uri: imageUrl }} className="w-[250px] h-[365px] rounded-lg mb-4" />
      )}

      <Text className="text-[22px] font-bold text-ygo-gold text-center">
        {card.name}
      </Text>
      {card.name_en && card.name_en !== card.name && (
        <Text className="text-gray-500 text-sm mt-1">{card.name_en}</Text>
      )}

      {inCollection && (
        <TouchableOpacity
          className="bg-ygo-owned py-1.5 px-3.5 rounded-full mt-2"
          onPress={handleDecrement}
          activeOpacity={0.7}
        >
          <Text className="text-ygo-owned-text text-xs font-bold">
            ✓ Dans ma collection (tap pour −1)
          </Text>
        </TouchableOpacity>
      )}

      <View className="flex-row gap-4 mt-3 items-center">
        <Text className="text-gray-400 text-sm">{card.humanReadableCardType}</Text>
        {card.atk !== undefined && (
          <Text className="text-gray-300 text-sm font-semibold">
            ATK {card.atk} / DEF {card.def}
          </Text>
        )}
      </View>

      {card.archetype && (
        <TouchableOpacity
          onPress={() => router.push({ pathname: "/collection", params: { archetype: card.archetype } })}
          activeOpacity={0.7}
        >
          <Text className="text-ygo-archetype text-[13px] mt-2 underline">
            Archétype : {card.archetype}
          </Text>
        </TouchableOpacity>
      )}

      <Text className="text-gray-300 text-sm mt-4 leading-5 text-center">
        {card.desc}
      </Text>

      {characters.length > 0 && (
        <View className="mt-6 w-full">
          <Text className="text-lg font-bold text-ygo-gold mb-3">
            Utilisé par
          </Text>
          {characters.map((cr, i) => (
            <CharacterBadge key={i} result={cr} />
          ))}
        </View>
      )}

      {characters.length === 0 && (
        <View className="mt-6 w-full">
          <Text className="text-lg font-bold text-ygo-gold mb-3">
            Utilisé par
          </Text>
          <Text className="text-gray-600 italic">
            Aucun personnage connu pour cette carte
          </Text>
        </View>
      )}

      <View className="flex-row gap-3 mt-6 w-full">
        <TouchableOpacity
          className="bg-ygo-card py-3.5 rounded-xl flex-1 items-center border border-ygo-gold/30"
          onPress={() => router.replace("/")}
          activeOpacity={0.8}
        >
          <Text className="text-ygo-gold font-bold text-base">⌂ Home</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="bg-ygo-gold py-3.5 rounded-xl flex-[2] items-center"
          onPress={() => router.push("/scan")}
          activeOpacity={0.8}
        >
          <Text className="text-ygo-bg font-black text-base tracking-wide">
            Scanner une carte
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
