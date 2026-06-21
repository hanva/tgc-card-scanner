import { useState } from "react";
import { View, Text, Image, TouchableOpacity, Linking } from "react-native";
import { MarketCard } from "../services/market";

interface Props {
  card: MarketCard;
  width: number;
}

// L'image cardmarket est protégée (hotlink) → on tente avec un Referer cardmarket,
// et on retombe sur le dos de carte YGO (comme la fiche perso) si ça échoue/absente.
const IMG_HEADERS = { Referer: "https://www.cardmarket.com/" };
const CARD_BACK = "https://images.ygoprodeck.com/images/cards/back_high.jpg";

export function MarketCardTile({ card, width }: Props) {
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
