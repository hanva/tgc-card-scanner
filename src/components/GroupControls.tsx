import { Text, TouchableOpacity } from "react-native";

/** Onglet de mode (Archétypes / Persos). Partagé Marché ↔ Wishlist. */
export function ModeTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className={`flex-1 items-center py-2 rounded-lg border ${active ? "bg-ygo-gold border-ygo-gold-bright" : "bg-ygo-card border-ygo-muted"}`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className={`text-xs font-bold ${active ? "text-ygo-bg" : "text-gray-300"}`}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Puce de filtre (un archétype / un perso). Partagé Marché ↔ Wishlist. */
export function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      className={`px-3 py-2 rounded-full border ${active ? "bg-ygo-gold border-ygo-gold-bright" : "bg-ygo-card border-ygo-muted"}`}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text className={`text-xs font-semibold ${active ? "text-ygo-bg" : "text-gray-300"}`}>{label}</Text>
    </TouchableOpacity>
  );
}
