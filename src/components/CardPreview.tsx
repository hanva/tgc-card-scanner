import { View, Text, Image, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { YgoCard } from "../types/card";

interface Props {
  card: YgoCard;
  wished?: boolean;
  onToggleWish?: () => void;
}

export function CardPreview({ card, wished, onToggleWish }: Props) {
  const router = useRouter();
  const imageUrl = card.card_images?.[0]?.image_url_small;

  return (
    <View className="flex-row bg-ygo-card rounded-xl mb-2.5 items-center">
      <TouchableOpacity
        className="flex-1 flex-row p-2.5 items-center"
        onPress={() =>
          router.push({
            pathname: `/card/${card.id}`,
            params: { from: "scan" },
          })
        }
      >
        {imageUrl && (
          <Image
            source={{ uri: imageUrl }}
            className={`w-[60px] h-[88px] rounded ${wished ? "border-2 border-ygo-gold-bright" : ""}`}
          />
        )}
        <View className="flex-1 ml-3">
          <Text className="text-ygo-gold text-base font-bold" numberOfLines={1}>
            {card.name}
          </Text>
          {card.name_en && card.name_en !== card.name && (
            <Text className="text-gray-500 text-xs mt-0.5" numberOfLines={1}>
              {card.name_en}
            </Text>
          )}
          <Text className="text-gray-400 text-xs mt-1" numberOfLines={1}>
            {card.humanReadableCardType}
          </Text>
          {card.atk !== undefined && (
            <Text className="text-gray-300 text-sm mt-1 font-semibold">
              ATK {card.atk} / DEF {card.def}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      {onToggleWish && (
        <TouchableOpacity className="px-3.5 py-4" onPress={onToggleWish} activeOpacity={0.7}>
          <Text style={{ fontSize: 20, color: wished ? "#ffd700" : "#555" }}>{wished ? "★" : "☆"}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
