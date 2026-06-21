import { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import {
  exportToHtml,
  getExportableCharacters,
  ExportScope,
  CharacterListItem,
} from "../services/export";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type ScopeChoice = "all" | "character";

export function ExportModal({ visible, onClose }: Props) {
  const [scopeChoice, setScopeChoice] = useState<ScopeChoice>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const characters = useMemo<CharacterListItem[]>(() => getExportableCharacters(), []);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const handleExport = async () => {
    if (scopeChoice === "character" && !selectedId) {
      Alert.alert("Sélection requise", "Choisis un personnage à exporter.");
      return;
    }
    setLoading(true);
    try {
      const scope: ExportScope =
        scopeChoice === "all"
          ? { type: "all" }
          : { type: "character", characterId: selectedId! };
      await exportToHtml(scope);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "L'export a échoué.";
      Alert.alert("Erreur d'export", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View className="flex-1 bg-black/70 justify-end">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={handleClose} />

        <View className="bg-ygo-bg border-t-2 border-ygo-gold rounded-t-3xl pt-3 pb-8 px-5">
          <View className="items-center mb-4">
            <View className="w-12 h-1 bg-ygo-muted rounded-full mb-4" />
            <Text className="text-xl font-black text-ygo-gold tracking-widest">EXPORTER</Text>
            <Text className="text-xs text-gray-400 mt-1">
              Génère un fichier HTML partageable
            </Text>
          </View>

          <View className="flex-row gap-2 mb-4">
            <TouchableOpacity
              className={`flex-1 py-3 rounded-xl border-2 items-center ${
                scopeChoice === "all"
                  ? "bg-ygo-gold border-ygo-gold-bright"
                  : "bg-ygo-card border-ygo-muted"
              }`}
              onPress={() => setScopeChoice("all")}
              activeOpacity={0.8}
            >
              <Text
                className={`text-sm font-bold tracking-wider ${
                  scopeChoice === "all" ? "text-ygo-bg" : "text-gray-300"
                }`}
              >
                TOUTE MA DB
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-3 rounded-xl border-2 items-center ${
                scopeChoice === "character"
                  ? "bg-ygo-gold border-ygo-gold-bright"
                  : "bg-ygo-card border-ygo-muted"
              }`}
              onPress={() => setScopeChoice("character")}
              activeOpacity={0.8}
            >
              <Text
                className={`text-sm font-bold tracking-wider ${
                  scopeChoice === "character" ? "text-ygo-bg" : "text-gray-300"
                }`}
              >
                UN PERSONNAGE
              </Text>
            </TouchableOpacity>
          </View>

          {scopeChoice === "character" && (
            <ScrollView
              className="mb-4"
              style={{ maxHeight: 320 }}
              showsVerticalScrollIndicator={false}
            >
              {characters.map((char) => {
                const selected = selectedId === char.id;
                const seriesBg =
                  char.series === "DM"
                    ? "bg-ygo-dm"
                    : char.series === "GX"
                    ? "bg-ygo-gx"
                    : "bg-ygo-archetype";
                return (
                  <TouchableOpacity
                    key={char.id}
                    className={`flex-row items-center py-2.5 px-3 rounded-xl mb-1.5 border ${
                      selected
                        ? "bg-ygo-card border-ygo-gold"
                        : "bg-ygo-card/60 border-ygo-muted"
                    }`}
                    onPress={() => setSelectedId(char.id)}
                    activeOpacity={0.7}
                  >
                    {char.avatar ? (
                      <Image
                        source={{ uri: char.avatar }}
                        className="w-9 h-9 rounded-full bg-ygo-muted"
                      />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-ygo-muted items-center justify-center">
                        <Text className="text-ygo-gold font-bold">
                          {char.name.charAt(0)}
                        </Text>
                      </View>
                    )}
                    <Text
                      className={`flex-1 ml-3 font-semibold ${
                        selected ? "text-ygo-gold" : "text-gray-200"
                      }`}
                      numberOfLines={1}
                    >
                      {char.name}
                    </Text>
                    <View className={`px-2 py-0.5 rounded ${seriesBg}`}>
                      <Text className="text-[10px] font-bold text-white">
                        {char.series}
                      </Text>
                    </View>
                    <Text className="text-xs text-gray-500 ml-2 w-10 text-right">
                      {char.cardCount}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            className={`w-full items-center justify-center py-4 rounded-2xl border-2 ${
              loading
                ? "bg-ygo-card border-ygo-muted"
                : "bg-ygo-gold border-ygo-gold-bright"
            }`}
            onPress={handleExport}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#e6b800" />
            ) : (
              <Text className="text-base font-black text-ygo-bg tracking-widest">
                EXPORTER EN HTML
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="w-full items-center justify-center py-3 mt-2"
            onPress={handleClose}
            disabled={loading}
          >
            <Text className="text-sm text-gray-400">Annuler</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
