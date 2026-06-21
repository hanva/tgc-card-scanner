import { useState, useCallback, useEffect } from "react";
import {
  View, Text, FlatList, Image, TouchableOpacity, Alert, TextInput, ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect, useLocalSearchParams } from "expo-router";
import {
  getCollectionEntries, decrementFromCollection, backfillCollection, CollectionEntry,
} from "../src/services/collection";
import { getCharactersForCard } from "../src/services/characterLookup";
import { YgoCard } from "../src/types/card";
import { CHARACTER_AVATARS } from "../src/services/avatars";
import { getStoredCard } from "../src/services/cardStore";
import { getCardsByArchetype } from "../src/services/ygoprodeck";
import { storeCard } from "../src/services/cardStore";

type FilterMode = "all" | "character" | "archetype";

interface LooseCardEntry extends CollectionEntry {
  archetypeName?: string;
  linkedCard?: string;
}

interface CharacterGroup {
  characterId: string;
  characterName: string;
  series: string;
  avatar?: string;
  directCards: CollectionEntry[];
  looseCards: LooseCardEntry[];
}

export default function CollectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ archetype?: string }>();
  const [entries, setEntries] = useState<CollectionEntry[]>([]);
  const [filter, setFilter] = useState<FilterMode>(params.archetype ? "archetype" : "all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArchetype, setSelectedArchetype] = useState<string | null>(params.archetype || null);
  const [archetypeCards, setArchetypeCards] = useState<YgoCard[]>([]);
  const [loadingArchetype, setLoadingArchetype] = useState(false);

  const refresh = useCallback(() => {
    getCollectionEntries().then(setEntries);
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
      backfillCollection(refresh);
    }, [])
  );

  useEffect(() => {
    if (filter === "archetype" && selectedArchetype) {
      setLoadingArchetype(true);
      getCardsByArchetype(selectedArchetype).then((cards) => {
        cards.forEach(storeCard);
        setArchetypeCards(cards);
        setLoadingArchetype(false);
      });
    } else {
      setArchetypeCards([]);
    }
  }, [filter, selectedArchetype]);

  const handleDecrement = async (entry: CollectionEntry) => {
    const newCount = await decrementFromCollection(entry.cardId);
    if (newCount === 0) {
      Alert.alert("Carte retirée", `"${entry.cardName}" a été retirée de ta collection.`);
    }
    refresh();
  };

  const getEntryArchetype = (entry: CollectionEntry): string | undefined => {
    const stored = getStoredCard(entry.cardId);
    return stored?.archetype || entry.archetype;
  };

  const archetypes = [...new Set(
    entries.map(getEntryArchetype).filter((a): a is string => !!a && a !== "_none")
  )].sort();

  let filteredEntries = entries;
  if (searchQuery.trim().length > 0) {
    const q = searchQuery.toLowerCase();
    filteredEntries = filteredEntries.filter((e) =>
      e.cardName.toLowerCase().includes(q) || (e.cardNameEn?.toLowerCase().includes(q) ?? false)
    );
  }
  if (filter === "archetype" && selectedArchetype) {
    filteredEntries = filteredEntries.filter((e) => getEntryArchetype(e) === selectedArchetype);
  }

  const characterGroups = useCallback((): CharacterGroup[] => {
    const groups = new Map<string, CharacterGroup>();
    for (const entry of filteredEntries) {
      const stored = getStoredCard(entry.cardId);
      const chars = getCharactersForCard({
        id: entry.cardId,
        name: stored?.name || entry.cardName,
        archetype: stored?.archetype || entry.archetype,
        type: stored?.type || entry.cardType || "",
        race: stored?.race || entry.race || "",
        card_sets: stored?.card_sets,
      } as YgoCard);

      if (chars.length === 0) {
        const unknown = groups.get("unknown") || {
          characterId: "unknown", characterName: "Autres cartes", series: "", directCards: [], looseCards: [],
        };
        unknown.directCards.push(entry);
        groups.set("unknown", unknown);
      } else {
        for (const cr of chars) {
          const key = cr.character.id;
          const group = groups.get(key) || {
            characterId: key,
            characterName: cr.character.nameFr || cr.character.name,
            series: cr.character.series,
            avatar: CHARACTER_AVATARS[key],
            directCards: [],
            looseCards: [],
          };
          const isDirect = cr.strength === "direct";
          if (isDirect) {
            if (!group.directCards.some((c) => c.cardId === entry.cardId)) {
              group.directCards.push(entry);
            }
          } else {
            if (!group.looseCards.some((c) => c.cardId === entry.cardId)) {
              group.looseCards.push({
                ...entry,
                archetypeName: cr.archetypeInfo?.name,
                linkedCard: cr.archetypeInfo?.linkedCard,
              });
            }
          }
          groups.set(key, group);
        }
      }
    }
    return [...groups.values()].sort(
      (a, b) => b.directCards.length - a.directCards.length
    );
  }, [filteredEntries]);

  if (entries.length === 0) {
    return (
      <View className="flex-1 bg-ygo-bg items-center justify-center p-6">
        <Text className="text-5xl mb-4">📚</Text>
        <Text className="text-gray-600 text-base text-center leading-6">
          Ta collection est vide.{"\n"}Scanne des cartes pour commencer !
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-ygo-bg">
      {/* Filter bar */}
      <View className="flex-row px-4 pt-3 pb-2 gap-2">
        {([
          { key: "all" as FilterMode, label: "Toutes" },
          { key: "character" as FilterMode, label: "Par perso" },
          { key: "archetype" as FilterMode, label: "Archétype" },
        ]).map((f) => (
          <TouchableOpacity
            key={f.key}
            className={`py-1.5 px-3.5 rounded-full border ${filter === f.key ? "bg-ygo-gold border-ygo-gold" : "bg-ygo-card border-ygo-muted"}`}
            onPress={() => setFilter(f.key)}
          >
            <Text className={`text-[13px] font-semibold ${filter === f.key ? "text-ygo-bg" : "text-gray-500"}`}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Archetype chips */}
      {filter === "archetype" && (
        <FlatList
          horizontal
          data={archetypes}
          keyExtractor={(item) => item}
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0, flexShrink: 0, height: 44, marginBottom: 8, marginTop: 4 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className={`h-[34px] px-3.5 rounded-full justify-center border ${selectedArchetype === item ? "bg-ygo-archetype border-ygo-archetype" : "bg-ygo-card border-ygo-muted"}`}
              onPress={() => setSelectedArchetype(selectedArchetype === item ? null : item)}
            >
              <Text
                className={`text-xs font-semibold ${selectedArchetype === item ? "text-white" : "text-gray-500"}`}
                numberOfLines={1}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TextInput
        className="bg-ygo-card text-white text-sm p-2.5 mx-4 mb-2 rounded-xl border border-ygo-muted"
        placeholder="Rechercher dans ma collection..."
        placeholderTextColor="#555"
        value={searchQuery}
        onChangeText={setSearchQuery}
      />

      {/* Count */}
      {filter === "archetype" && selectedArchetype && !loadingArchetype ? (
        <Text className="text-gray-600 text-xs px-4 pb-2">
          {entries.filter((e) => getEntryArchetype(e) === selectedArchetype).length}/{archetypeCards.length} cartes possédées
        </Text>
      ) : (
        <Text className="text-gray-600 text-xs px-4 pb-2">
          {filteredEntries.length} carte{filteredEntries.length > 1 ? "s" : ""}
        </Text>
      )}

      {/* Archetype full view */}
      {filter === "archetype" && selectedArchetype && archetypeCards.length > 0 ? (
        <FlatList
          data={archetypeCards}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item: card }) => {
            const owned = entries.some((e) => e.cardId === card.id || e.cardName.toLowerCase() === card.name.toLowerCase() || (e.cardNameEn && card.name_en && e.cardNameEn.toLowerCase() === card.name_en.toLowerCase()));
            const imageUrl = card.card_images?.[0]?.image_url_small;
            return (
              <TouchableOpacity
                className={`flex-row bg-ygo-card rounded-xl mb-2 mx-4 p-2.5 items-center ${!owned ? "opacity-40" : ""}`}
                onPress={() => router.push({ pathname: `/card/${card.id}`, params: { from: "collection" } })}
                activeOpacity={0.7}
              >
                {imageUrl && (
                  <Image source={{ uri: imageUrl }} className={`w-[45px] h-[66px] rounded ${!owned ? "opacity-50" : ""}`} />
                )}
                <View className="flex-1 ml-3">
                  <Text className={`text-sm font-bold ${owned ? "text-ygo-gold" : "text-gray-600"}`} numberOfLines={1}>
                    {card.name}
                  </Text>
                  {card.name_en && card.name_en !== card.name && (
                    <Text className="text-gray-500 text-[11px] mt-0.5" numberOfLines={1}>{card.name_en}</Text>
                  )}
                </View>
                {owned && (
                  <View className="bg-ygo-owned py-1 px-2.5 rounded-xl mr-3">
                    <Text className="text-ygo-owned-text text-[11px] font-bold">Possédée</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      ) : filter === "archetype" && loadingArchetype ? (
        <ActivityIndicator size="large" color="#e6b800" style={{ marginTop: 40 }} />
      ) : filter === "character" ? (
        <FlatList
          data={characterGroups()}
          keyExtractor={(item) => item.characterId}
          renderItem={({ item: group }) => (
            <CharacterGroupCard group={group} router={router} onDecrement={handleDecrement} />
          )}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
        />
      ) : (
        <FlatList
          data={filteredEntries}
          keyExtractor={(item) => String(item.cardId)}
          renderItem={({ item }) => (
            <View className="flex-row bg-ygo-card rounded-xl mb-2 mx-4 items-center">
              <TouchableOpacity
                className="flex-1 flex-row p-2.5 items-center"
                onPress={() => router.push({ pathname: `/card/${item.cardId}`, params: { from: "collection" } })}
              >
                {item.imageUrl && (
                  <Image source={{ uri: item.imageUrl }} className="w-[45px] h-[66px] rounded" />
                )}
                <View className="flex-1 ml-3">
                  <Text className="text-ygo-gold text-sm font-bold" numberOfLines={1}>{item.cardName}</Text>
                  {item.cardNameEn && item.cardNameEn !== item.cardName && (
                    <Text className="text-gray-500 text-[11px] mt-0.5" numberOfLines={1}>{item.cardNameEn}</Text>
                  )}
                  <Text className="text-gray-600 text-[11px] mt-1">Scanné {item.scanCount}x</Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity className="p-3.5" onPress={() => handleDecrement(item)}>
                <Text className="text-ygo-danger text-base font-bold">−1</Text>
              </TouchableOpacity>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

function CharacterGroupCard({
  group, router, onDecrement,
}: {
  group: CharacterGroup;
  router: any;
  onDecrement: (e: CollectionEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View className="bg-ygo-card rounded-xl mb-2.5 overflow-hidden">
      <TouchableOpacity
        className="flex-row items-center p-3"
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        {group.avatar ? (
          <Image source={{ uri: group.avatar }} className="w-10 h-10 rounded-full mr-3 border-2 border-ygo-gold bg-ygo-muted" />
        ) : (
          <View className="w-10 h-10 rounded-full mr-3 border-2 border-ygo-gold bg-ygo-muted items-center justify-center">
            <Text className="text-ygo-gold text-lg font-bold">{group.characterName.charAt(0)}</Text>
          </View>
        )}
        <View className="flex-1 flex-row items-center gap-2">
          <Text className="text-white text-[15px] font-bold">{group.characterName}</Text>
          {group.series && (
            <View className={`px-1.5 py-0.5 rounded ${group.series === "DM" ? "bg-ygo-dm" : "bg-ygo-gx"}`}>
              <Text className="text-white text-[10px] font-bold">{group.series}</Text>
            </View>
          )}
        </View>
        <Text className="text-ygo-gold text-base font-bold mr-2">{group.directCards.length}{group.looseCards.length > 0 ? <Text className="text-gray-600 text-xs"> +{group.looseCards.length}</Text> : null}</Text>
        <Text className="text-gray-600 text-xs">{expanded ? "▲" : "▼"}</Text>
      </TouchableOpacity>

      {expanded && (
        <View className="border-t border-ygo-bg">
          {/* Profile link */}
          {group.characterId !== "unknown" && (
            <TouchableOpacity
              className="flex-row items-center justify-center py-2 border-b border-ygo-bg/30"
              onPress={() => router.push(`/character/${group.characterId}`)}
              activeOpacity={0.7}
            >
              <Text className="text-ygo-gold text-xs font-semibold">Voir le profil complet →</Text>
            </TouchableOpacity>
          )}
          {/* Direct cards */}
          {group.directCards.map((card) => (
            <View key={card.cardId} className="flex-row items-center px-3 py-1.5 border-b border-ygo-bg/20">
              <TouchableOpacity
                className="flex-1 flex-row items-center"
                onPress={() => router.push({ pathname: `/card/${card.cardId}`, params: { from: "collection" } })}
              >
                {card.imageUrl && (
                  <Image source={{ uri: card.imageUrl }} className="w-[30px] h-[44px] rounded mr-2.5" />
                )}
                <Text className="text-gray-300 text-[13px] flex-1" numberOfLines={1}>{card.cardName}</Text>
              </TouchableOpacity>
              <TouchableOpacity className="p-2" onPress={() => onDecrement(card)}>
                <Text className="text-ygo-danger text-base font-bold">−1</Text>
              </TouchableOpacity>
            </View>
          ))}

          {/* Loose cards section */}
          {group.looseCards.length > 0 && (
            <>
              <View className="px-3 py-2 bg-ygo-bg/50">
                <Text className="text-gray-600 text-[11px] italic">Archétype associé</Text>
              </View>
              {group.looseCards.map((card) => (
                <View key={card.cardId} className="flex-row items-center px-3 py-1.5 border-b border-ygo-bg/20 opacity-50">
                  <TouchableOpacity
                    className="flex-1 flex-row items-center"
                    onPress={() => router.push({ pathname: `/card/${card.cardId}`, params: { from: "collection" } })}
                  >
                    {card.imageUrl && (
                      <Image source={{ uri: card.imageUrl }} className="w-[30px] h-[44px] rounded mr-2.5" />
                    )}
                    <View className="flex-1">
                      <Text className="text-gray-500 text-[13px]" numberOfLines={1}>{card.cardName}</Text>
                      {card.archetypeName && (
                        <Text className="text-ygo-gold/50 text-[10px] italic">
                          Archétype {card.archetypeName}
                          {card.linkedCard ? ` — utilise ${card.linkedCard}` : ""}
                        </Text>
                      )}
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity className="p-2" onPress={() => onDecrement(card)}>
                    <Text className="text-ygo-danger text-base font-bold">−1</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}
