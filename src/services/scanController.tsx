/**
 * Service de scan global : une WebView UNIQUE montée au niveau racine (dans _layout via
 * <ScanProvider>), qui survit à la navigation entre écrans. Le scan continue tant que l'app
 * est au premier plan ; il est juste masqué (déplacé hors écran) quand on quitte l'écran de
 * scan. On NE peut PAS le faire tourner app en arrière-plan (l'OS gèle le JS de la WebView).
 *
 * L'écran /market-scan ne fait qu'afficher/masquer cette WebView et piloter start/stop.
 */
import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, AppState, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, WebViewMessageEvent } from "react-native-webview";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import snippetAsset from "../data/market-snippet.json";
import { MarketCard } from "./market";
import { ingestCards, postMeta, getSellerState } from "./marketApi";

const SNIPPET = (snippetAsset as { snippet: string }).snippet;
const READY_PROBE =
  "(function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({t:'ready',ready:!!document.querySelector('#UserOffersTable')}));}catch(e){}})();true;";

function parseSeller(url: string): string | null {
  const m = url.match(/\/Users\/([^/]+)\//);
  return m ? m[1] : null;
}

type Status = "idle" | "ready" | "scraping" | "done";

interface ScanCtx {
  active: boolean;
  seller: string | null;
  status: Status;
  pageReady: boolean;
  progress: { index: number; total: number; totalMatched: number; cards: number } | null;
  visible: boolean;
  openScan: (url: string) => Promise<void>;
  begin: () => void;
  stop: () => Promise<void>;
  show: () => void;
  hide: () => void;
}

const Ctx = createContext<ScanCtx | null>(null);
export const useScan = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useScan must be used within ScanProvider");
  return c;
};

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const webRef = useRef<WebView>(null);
  const totalRef = useRef(0); // total de cartes scannées (cumulé, base = état serveur)
  const doneRef = useRef<Set<string>>(new Set());
  const saveCounter = useRef(0);

  const [session, setSession] = useState<{ url: string; seller: string } | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [pageReady, setPageReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<ScanCtx["progress"]>(null);
  const [urlInput, setUrlInput] = useState("");

  const seller = session?.seller || null;

  const pushMeta = useCallback(async (editionsTotal?: number) => {
    if (session?.seller) await postMeta(session.seller, { editionsDone: doneRef.current.size, editionsTotal, doneIds: [...doneRef.current] });
  }, [session?.seller]);

  const openScan = useCallback(async (url: string) => {
    const s = parseSeller(url.trim());
    if (!s) return;
    const state = await getSellerState(s); // reprise depuis le backend
    doneRef.current = new Set(state.doneIds || []);
    totalRef.current = state.total || 0;
    saveCounter.current = 0;
    setProgress(state.total ? { index: 0, total: state.editionsTotal || 0, totalMatched: state.totalMatched, cards: state.total } : null);
    setPageReady(false);
    setStatus("ready");
    setSession({ url: url.trim(), seller: s });
    setVisible(true);
  }, []);

  const begin = useCallback(() => {
    const queriesDone = [...doneRef.current].map((id) => "exp:" + id);
    const host =
      "window.__MARKET_HOST__={queriesDone:" + JSON.stringify(queriesDone) + ",baseDelay:12000," +
      "emit:function(p){window.ReactNativeWebView.postMessage(JSON.stringify({t:'batch',key:p.key,cards:p.batch,progress:p.progress}))}," +
      "onDone:function(r){window.ReactNativeWebView.postMessage(JSON.stringify({t:'done',summary:{editionsTotal:r.editionsTotal}}))}};";
    webRef.current?.injectJavaScript(host + "\n" + SNIPPET + "\ntrue;");
    setStatus("scraping");
  }, []);

  const stop = useCallback(async () => {
    await pushMeta(progress?.total);
    setStatus("idle");
    setSession(null); // démonte la WebView → coupe le snippet (reprise possible plus tard)
    setVisible(false);
    setPageReady(false);
  }, [pushMeta, progress?.total]);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  const onMessage = useCallback(async (e: WebViewMessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.t === "ready") {
      setPageReady(!!msg.ready);
    } else if (msg.t === "batch") {
      doneRef.current.add(String(msg.key).replace("exp:", ""));
      const cards: MarketCard[] = Array.isArray(msg.cards) ? msg.cards : [];
      if (cards.length && session?.seller) await ingestCards(session.seller, cards); // POST au backend
      totalRef.current += cards.length;
      const p = msg.progress || {};
      setProgress({ index: p.index || 0, total: p.total || 0, totalMatched: p.totalMatched || 0, cards: totalRef.current });
      if (++saveCounter.current % 3 === 0) await pushMeta(p.total);
    } else if (msg.t === "done") {
      await pushMeta(msg.summary?.editionsTotal);
      setStatus("done");
    }
  }, [pushMeta, session?.seller]);

  // Garde l'écran allumé pendant le scan.
  useEffect(() => {
    if (status === "scraping") activateKeepAwakeAsync("market-scan");
    else deactivateKeepAwake("market-scan");
    return () => { deactivateKeepAwake("market-scan"); };
  }, [status]);

  // Sauvegarde immédiate quand l'app passe en arrière-plan (le scan sera gelé par l'OS).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (st) => {
      if (st !== "active" && status === "scraping") pushMeta(progress?.total);
    });
    return () => sub.remove();
  }, [status, progress?.total, pushMeta]);

  const value: ScanCtx = { active: !!session, seller, status, pageReady, progress, visible, openScan, begin, stop, show, hide };

  return (
    <Ctx.Provider value={value}>
      <View style={{ flex: 1 }}>
        {children}

        {/* Saisie d'URL (overlay) quand aucun scan en cours */}
        {visible && !session && (
          <View style={[styles.full, { paddingTop: insets.top + 12, paddingHorizontal: 16 }]}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <Text style={{ color: "#e6b800", fontWeight: "900", fontSize: 18 }}>Scanner un vendeur</Text>
              <TouchableOpacity onPress={hide}><Text style={{ color: "#9aa", fontWeight: "700" }}>Fermer ✕</Text></TouchableOpacity>
            </View>
            <Text style={{ color: "#ccc", fontSize: 13, marginBottom: 8 }}>URL d'un vendeur cardmarket (page Offres / Cartes) :</Text>
            <TextInput
              style={{ backgroundColor: "#16213e", color: "#fff", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#2a2a4e" }}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="https://www.cardmarket.com/fr/YuGiOh/Users/.../Offers/Singles"
              placeholderTextColor="#666"
            />
            <TouchableOpacity style={{ backgroundColor: "#e6b800", paddingVertical: 14, borderRadius: 12, alignItems: "center", marginTop: 12 }} onPress={() => openScan(urlInput)}>
              <Text style={{ color: "#0d0d1a", fontWeight: "900" }}>CHARGER</Text>
            </TouchableOpacity>
            <Text style={{ color: "#777", fontSize: 12, marginTop: 16, lineHeight: 18 }}>
              La page s'ouvre, résous le challenge Cloudflare si demandé, attends l'affichage des offres puis lance le scan.
              Garde l'app ouverte (pas de vrai arrière-plan). Progression sauvegardée en continu — tu peux arrêter et reprendre.
            </Text>
          </View>
        )}

        {session && (
          <View style={visible ? styles.full : styles.offscreen} pointerEvents={visible ? "auto" : "none"}>
            {visible && (
              <View style={{ paddingTop: insets.top + 6, backgroundColor: "#0d0d1a", paddingHorizontal: 12, paddingBottom: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ color: "#e6b800", fontWeight: "900", fontSize: 16 }}>{seller}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    {status === "scraping" && <ActivityIndicator color="#e6b800" />}
                    <TouchableOpacity onPress={hide}><Text style={{ color: "#9aa", fontWeight: "700" }}>Réduire ▾</Text></TouchableOpacity>
                  </View>
                </View>
                {progress && (
                  <Text style={{ color: "#9aa", fontSize: 12, marginTop: 2 }}>
                    {progress.total ? `édition ${progress.index}/${progress.total} · ` : ""}{progress.cards} cartes · {progress.totalMatched} liées
                  </Text>
                )}
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  {status !== "scraping" ? (
                    <TouchableOpacity
                      style={[styles.btn, { backgroundColor: pageReady ? "#e6b800" : "#2a2a4e" }]}
                      onPress={begin}
                      disabled={!pageReady}
                    >
                      <Text style={{ color: pageReady ? "#0d0d1a" : "#666", fontWeight: "700" }}>
                        {pageReady ? "DÉMARRER LE SCAN" : "Attente du chargement…"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity style={[styles.btn, { backgroundColor: "#16213e", borderWidth: 1, borderColor: "#ff6b6b" }]} onPress={stop}>
                      <Text style={{ color: "#ff6b6b", fontWeight: "700" }}>ARRÊTER (sauvegarde)</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <WebView
                ref={webRef}
                source={{ uri: session.url }}
                injectedJavaScript={READY_PROBE}
                onMessage={onMessage}
                onNavigationStateChange={() => setPageReady(false)}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                setSupportMultipleWindows={false}
              />
            </View>
          </View>
        )}
      </View>
    </Ctx.Provider>
  );
}

const styles = StyleSheet.create({
  full: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0d0d1a", zIndex: 50 },
  offscreen: { position: "absolute", left: -100000, top: 0, width: 1, height: 1, opacity: 0 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: "center" },
});
