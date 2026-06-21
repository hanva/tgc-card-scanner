import { useState } from "react";
import { View, Text, Image, TouchableOpacity, Linking } from "react-native";
import { MarketCard } from "../services/market";

interface Props {
  card: MarketCard;
  width: number;
  wished?: boolean;
  onToggleWish?: (card: MarketCard) => void;
}

// L'image cardmarket est protégée (hotlink) → on tente avec un Referer cardmarket,
// et on retombe sur le dos de carte YGO (comme la fiche perso) si ça échoue/absente.
const IMG_HEADERS = { Referer: "https://www.cardmarket.com/" };
const CARD_BACK = "https://images.ygoprodeck.com/images/cards/back_high.jpg";

export function MarketCardTile({ card, width, wished, onToggleWish }: Props) {
  const [failed, setFailed] = useState(false);
  const open = () => {
    if (card.offerUrl) Linking.openURL(card.offerUrl).catch(() => {});
  };

  const useArt = card.image && !failed;
  const source = useArt ? { uri: card.image, headers: IMG_HEADERS } : { uri: CARD_BACK };

  return (
    <TouchableOpacity style={{ width }} onPress={open} activeOpacity={0.7}>
      <View className="rounded-lg overflow-hidden">
        <Image
          source={source}
          className="w-full aspect-[59/86] rounded-lg"
          onError={() => setFailed(true)}
        />
        {onToggleWish && (
          <TouchableOpacity
            onPress={() => onToggleWish(card)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={{ position: "absolute", top: 4, right: 4, backgroundColor: "rgba(13,13,26,0.65)", borderRadius: 14, width: 28, height: 28, alignItems: "center", justifyContent: "center" }}
          >
            <Text style={{ fontSize: 15, color: wished ? "#ffd700" : "#e6e6e6" }}>{wished ? "★" : "☆"}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text className="text-[10px] mt-1 text-center text-gray-300" numberOfLines={2}>{card.name}</Text>
      <Text className="text-[10px] text-center text-gray-500" numberOfLines={1}>
        {card.expansionCode}
        {card.price != null ? ` · ` : ""}
        {card.price != null ? <Text className="text-ygo-gold-bright font-bold">{card.price.toFixed(2)}€</Text> : null}
      </Text>
    </TouchableOpacity>
  );
}
