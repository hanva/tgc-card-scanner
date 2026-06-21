import { useCallback, useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { getCollectionCount } from "../src/services/collection";
import { ExportModal } from "../src/components/ExportModal";

export default function HomeScreen() {
  const router = useRouter();
  const [collectionCount, setCollectionCount] = useState(0);
  const [exportVisible, setExportVisible] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getCollectionCount().then(setCollectionCount);
    }, [])
  );

  return (
    <View className="flex-1 items-center justify-center p-6 bg-ygo-bg">
      <View className="items-center mb-10">
        <View className="w-16 h-16 rounded-full border-2 border-ygo-gold items-center justify-center mb-3">
          <Text className="text-3xl">👁️</Text>
        </View>
        <Text className="text-4xl font-black text-ygo-gold tracking-widest">YGO</Text>
        <Text className="text-sm font-bold text-ygo-gold-dark tracking-widest -mt-0.5">CARD SCANNER</Text>
      </View>

      <View className="w-full gap-3">
        <TouchableOpacity
          className="w-full items-center justify-center bg-ygo-gold py-5 rounded-2xl border-2 border-ygo-gold-bright"
          onPress={() => router.push("/scan")}
          activeOpacity={0.8}
        >
          <Text className="text-lg font-black text-ygo-bg tracking-widest">SCANNER</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center bg-ygo-card py-5 rounded-2xl border-2 border-ygo-gold"
          onPress={() => router.push("/search")}
          activeOpacity={0.8}
        >
          <Text className="text-base font-extrabold text-ygo-gold tracking-wider">RECHERCHE</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center bg-ygo-card py-5 rounded-2xl border-2 border-ygo-gold"
          onPress={() => router.push("/market")}
          activeOpacity={0.8}
        >
          <Text className="text-base font-extrabold text-ygo-gold tracking-wider">MARCHÉ</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center bg-ygo-card py-4 rounded-2xl border border-ygo-muted"
          onPress={() => router.push("/collection")}
          activeOpacity={0.8}
        >
          <Text className="text-sm font-bold text-gray-400 tracking-wider">
            COLLECTION{collectionCount > 0 ? ` (${collectionCount})` : ""}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center justify-center bg-ygo-card py-4 rounded-2xl border border-ygo-muted"
          onPress={() => setExportVisible(true)}
          activeOpacity={0.8}
        >
          <Text className="text-sm font-bold text-gray-400 tracking-wider">EXPORTER</Text>
        </TouchableOpacity>
      </View>

      <ExportModal visible={exportVisible} onClose={() => setExportVisible(false)} />
    </View>
  );
}
