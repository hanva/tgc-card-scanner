import { View, Text, TouchableOpacity, Linking } from "react-native";
import { MarketCard, characterName } from "../services/market";

interface Props {
  card: MarketCard;
}

export function MarketCardRow({ card }: Props) {
  const open = () => {
    if (card.offerUrl) Linking.openURL(card.offerUrl).catch(() => {});
  };

  const meta = [card.expansionCode, card.rarity, card.conditionCode, card.language]
    .filter(Boolean)
    .join(" · ");

  return (
    <TouchableOpacity
      className="bg-ygo-card rounded-xl mb-2 p-3"
      onPress={open}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start justify-between">
        <View className="flex-1 mr-2">
          <Text className="text-ygo-gold text-base font-bold" numberOfLines={2}>
            {card.name}
          </Text>
          <Text className="text-gray-400 text-xs mt-1" numberOfLines={1}>
            {meta}
            {card.firstEd ? " · 1st Ed" : ""}
          </Text>

          {card.matched && (
            <View className="flex-row flex-wrap mt-1.5 gap-1">
              {card.matched.archetypes.map((a) => (
                <View key={`a-${a}`} className="border border-ygo-archetype rounded px-1.5 py-0.5">
                  <Text className="text-ygo-archetype text-[10px] font-semibold">{a}</Text>
                </View>
              ))}
              {card.matched.characters.map((c) => (
                <View key={`c-${c}`} className="bg-ygo-muted rounded px-1.5 py-0.5">
                  <Text className="text-gray-300 text-[10px]">{characterName(c)}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View className="items-end">
          <Text className="text-ygo-gold-bright text-base font-extrabold">
            {card.price != null ? `${card.price.toFixed(2)} €` : "—"}
          </Text>
          {card.amount != null && card.amount > 1 && (
            <Text className="text-gray-500 text-xs mt-0.5">x{card.amount}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}
