import { useEffect, useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useCardSearch } from "../src/hooks/useCardSearch";
import { CardPreview } from "../src/components/CardPreview";

export default function SearchScreen() {
  const { q } = useLocalSearchParams<{ q?: string }>();
  const { results, loading, error, search } = useCardSearch();
  const [query, setQuery] = useState(q || "");

  useEffect(() => {
    if (q && q.length >= 2) search(q);
  }, [q]);

  const handleChange = (text: string) => {
    setQuery(text);
    search(text);
  };

  return (
    <View className="flex-1 bg-ygo-bg p-4">
      <TextInput
        className="bg-ygo-card text-white text-base p-3.5 rounded-xl border-2 border-ygo-gold mb-4"
        placeholder="Nom de la carte (ex: Magicien Sombre)"
        placeholderTextColor="#666"
        autoFocus={!q}
        value={query}
        onChangeText={handleChange}
      />
      {loading && <ActivityIndicator size="large" color="#e6b800" className="my-5" />}
      {error && !loading && <Text className="text-ygo-danger text-center my-5">{error}</Text>}
      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <CardPreview card={item} />}
        contentContainerStyle={{ paddingBottom: 20 }}
      />
    </View>
  );
}
