import "../global.css";
import { LogBox } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScanProvider } from "../src/services/scanController";

LogBox.ignoreAllLogs(true);

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ScanProvider>
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: "#0d0d1a" },
            headerTintColor: "#e6b800",
            headerTitleStyle: { fontWeight: "bold" },
            contentStyle: { backgroundColor: "#0d0d1a" },
          }}
        >
          <Stack.Screen name="index" options={{ title: "YGO Scanner" }} />
          <Stack.Screen name="scan" options={{ title: "Scanner" }} />
          <Stack.Screen name="search" options={{ title: "Recherche" }} />
          <Stack.Screen name="market" options={{ title: "Marché" }} />
          <Stack.Screen name="collection" options={{ title: "Ma Collection" }} />
          <Stack.Screen name="card/[id]" options={{ title: "Carte" }} />
          <Stack.Screen name="character/[id]" options={{ title: "Profil", headerShown: false }} />
        </Stack>
      </ScanProvider>
    </SafeAreaProvider>
  );
}
