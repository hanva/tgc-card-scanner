import { Text, TouchableOpacity } from "react-native";

/** Étoile ★/☆ en overlay (coin haut-droit d'une image de carte). Toggle wishlist. */
export function FavStar({ wished, onPress }: { wished: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      style={{
        position: "absolute", top: 4, right: 4,
        backgroundColor: "rgba(13,13,26,0.65)", borderRadius: 14,
        width: 28, height: 28, alignItems: "center", justifyContent: "center",
      }}
    >
      <Text style={{ fontSize: 15, color: wished ? "#ffd700" : "#e6e6e6" }}>{wished ? "★" : "☆"}</Text>
    </TouchableOpacity>
  );
}
