import { useState, useRef } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { useRouter } from "expo-router";
import { CameraView, useCameraPermissions } from "expo-camera";
import { recognizeCardName } from "../src/services/ocr";
import { searchCards } from "../src/services/ygoprodeck";

export default function ScanScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(false);
  const [ocrText, setOcrText] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-ygo-bg p-6">
        <ActivityIndicator size="large" color="#e6b800" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-ygo-bg p-6">
        <Text className="text-gray-400 text-base text-center mb-5">
          L'app a besoin de la caméra pour scanner les cartes.
        </Text>
        <TouchableOpacity className="bg-ygo-gold py-3.5 px-6 rounded-xl" onPress={requestPermission}>
          <Text className="text-ygo-bg font-bold text-base">Autoriser la caméra</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleCapture = async () => {
    if (!cameraRef.current || scanning) return;
    setScanning(true);
    setOcrText(null);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo) { Alert.alert("Erreur", "Impossible de prendre la photo"); setScanning(false); return; }
      const cardName = await recognizeCardName(photo.uri);
      setOcrText(cardName);
      if (!cardName || cardName.length < 3) {
        Alert.alert("Carte non reconnue", "Rapproche la carte ou utilise la recherche manuelle.", [
          { text: "Réessayer", onPress: () => setScanning(false) },
          { text: "Recherche manuelle", onPress: () => router.push("/search") },
        ]);
        return;
      }
      const results = await searchCards(cardName);
      if (results.length === 0) {
        Alert.alert("Aucun résultat", `Aucune carte trouvée pour "${cardName}".`, [
          { text: "Réessayer", onPress: () => setScanning(false) },
          { text: "Recherche manuelle", onPress: () => router.push({ pathname: "/search", params: { q: cardName } }) },
        ]);
        return;
      }
      if (results.length === 1) {
        router.push({ pathname: `/card/${results[0].id}`, params: { from: "scan" } });
      } else {
        router.push({ pathname: "/search", params: { q: cardName } });
      }
    } catch { Alert.alert("Erreur", "Erreur lors du scan."); } finally { setScanning(false); }
  };

  return (
    <View className="flex-1 bg-black">
      <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back">
        <View className="absolute top-10 left-0 right-0 items-center">
          <Text className="text-ygo-gold text-sm bg-black/50 px-4 py-1.5 rounded-full overflow-hidden">
            Vise le nom de la carte
          </Text>
        </View>
      </CameraView>

      <View className="bg-ygo-bg p-5 pb-10 items-center">
        {ocrText && <Text className="text-ygo-gold text-sm mb-3">Détecté : {ocrText}</Text>}
        <TouchableOpacity
          className="mb-4"
          onPress={() => router.push("/search")}
          activeOpacity={0.7}
        >
          <Text className="text-gray-400 text-sm">🔍 Recherche manuelle</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`bg-ygo-gold py-4 px-12 rounded-full border-2 border-ygo-gold-bright ${scanning ? "opacity-50" : ""}`}
          onPress={handleCapture}
          disabled={scanning}
          activeOpacity={0.8}
        >
          {scanning ? <ActivityIndicator color="#0d0d1a" /> : (
            <Text className="text-ygo-bg font-black text-lg tracking-widest">SCANNER</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
