import { useState } from "react";
import { View, Text, TouchableOpacity, Linking } from "react-native";
import { CharacterResult, EpisodeAppearance } from "../types/character";

interface Props {
  result: CharacterResult;
}

export function CharacterBadge({ result }: Props) {
  const { character, context, source, strength, episodes, archetypeInfo } = result;
  const [expanded, setExpanded] = useState(false);
  const hasEpisodes = episodes && episodes.length > 0;
  const isDM = character.series === "DM";
  const isLoose = strength === "loose" || strength === "archetype";

  return (
    <View className={`bg-ygo-card rounded-xl mb-2.5 overflow-hidden ${isLoose ? "opacity-60 border border-dashed border-ygo-muted" : ""}`}>
      <TouchableOpacity
        className="flex-row items-center p-3"
        onPress={() => hasEpisodes && setExpanded(!expanded)}
        activeOpacity={hasEpisodes ? 0.7 : 1}
      >
        <View
          className={`px-2 py-1 rounded-md mr-3 ${isDM ? "bg-ygo-dm" : "bg-ygo-gx"}`}
        >
          <Text className="text-white text-[11px] font-bold">
            {character.series}
          </Text>
        </View>
        <View className="flex-1">
          <Text className="text-white text-[15px] font-bold">
            {character.nameFr || character.name}
          </Text>
          {character.nameFr && character.nameFr !== character.name && (
            <Text className="text-gray-500 text-xs mt-0.5">
              {character.name}
            </Text>
          )}
          {archetypeInfo ? (
            <View className="mt-1">
              <Text className="text-ygo-gold/70 text-[11px] italic">
                Archétype {archetypeInfo.name}
              </Text>
              {archetypeInfo.linkedCard && (
                <Text className="text-gray-500 text-[10px]">
                  ↳ utilise {archetypeInfo.linkedCard}
                </Text>
              )}
            </View>
          ) : (
            <Text className="text-gray-400 text-xs mt-1">
              {context}
              {source === "skill-card" ? " (Skill Card)" : ""}
            </Text>
          )}
        </View>
        {hasEpisodes && (
          <View className="items-center ml-2">
            <Text className="text-ygo-gold text-xs font-bold">
              {episodes.length} ep.
            </Text>
            <Text className="text-gray-600 text-[10px] mt-0.5">
              {expanded ? "▲" : "▼"}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {expanded && hasEpisodes && (
        <View className="border-t border-ygo-bg px-3 pb-2">
          {episodes.slice(0, 20).map((ep) => (
            <TouchableOpacity
              key={ep.id}
              className="flex-row items-center py-2 border-b border-ygo-bg/20"
              onPress={() => Linking.openURL(ep.url)}
              activeOpacity={0.7}
            >
              <View
                className={`w-1.5 h-1.5 rounded-full mr-2 ${ep.series === "DM" ? "bg-ygo-dm" : "bg-ygo-gx"}`}
              />
              <Text className="text-gray-500 text-[11px] font-semibold w-14">
                {ep.id}
              </Text>
              <Text className="text-gray-300 text-xs flex-1" numberOfLines={1}>
                {ep.title}
              </Text>
              <Text className="text-ygo-gold text-sm ml-2">↗</Text>
            </TouchableOpacity>
          ))}
          {episodes.length > 20 && (
            <Text className="text-gray-600 text-[11px] text-center pt-2">
              +{episodes.length - 20} autres épisodes
            </Text>
          )}
        </View>
      )}
    </View>
  );
}
