/**
 * Scraper Playwright — crawl complet de l'inventaire d'un vendeur cardmarket, filtré par nos
 * archétypes/personnages. Un VRAI navigateur (Chrome) qui sait passer/attendre le challenge
 * Cloudflare, là où un fetch console échoue dès que le challenge s'arme.
 *
 * Réutilise : les sélecteurs de l'adapter (adapters.ts) et la map cible (targets.ts).
 * Stratégie : navigation page par page, slice par édition (idExpansion), locale /en/.
 * Robustesse : reprise sur fichier d'état + sauvegarde après chaque édition + Ctrl-C safe.
 *
 * ANTI-CLOUDFLARE : on NE laisse PAS Playwright lancer Chrome (ses flags d'automatisation
 * → navigator.webdriver=true → Cloudflare reboucle le challenge à l'infini). À la place on
 * lance un VRAI Chrome normal avec un port de debug et Playwright s'y connecte via CDP : pas
 * de flag d'automatisation, webdriver=false → Cloudflare se comporte comme une nav humaine
 * (tu résous le challenge UNE fois dans la fenêtre, le profil persiste, c'est réglé).
 *
 * Prérequis : npm i -D playwright  (pas besoin de `playwright install`, on utilise ton Chrome)
 *
 * Usage:
 *   npx tsx scripts/market/scrape-playwright.ts "<url Offers/Singles>" [options]
 *
 *   --discreet            mode discret recommandé : délais 12-28s aléatoires + lots de 40 éditions
 *                         /session + arrêt automatique si ban détecté (reste sous le seuil de ban IP)
 *   --batch N             nb d'éditions max par session (défaut 40 en discret, ∞ sinon)
 *   --min-delay / --max-delay ms   bornes du délai aléatoire entre requêtes
 *   --reset               repart de zéro (efface l'état)
 *   --limit N             ne considère que les N premières éditions à faire
 *   --port 9222           port debug Chrome
 *   --chrome "/chemin"    binaire Chrome (sinon auto-détecté / $CHROME_PATH)
 *   --launch              ancien mode (Playwright lance Chromium ; déconseillé, Cloudflare reboucle)
 *
 * Reprise automatique entre sessions (fichier d'état). Relance la même commande pour continuer.
 */
import * as fs from "fs";
import * as path from "path";
import { spawn, ChildProcess } from "child_process";
import { chromium, Browser, BrowserContext, Page } from "playwright";
import { CARDMARKET, MarketAdapter } from "./adapters";
import { buildTargetMap, norm } from "./targets";

const ROOT = path.join(__dirname, "..", "..");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

/** Chemins Chrome usuels (macOS) + override via --chrome / $CHROME_PATH. */
function findChrome(): string | null {
  const cands = [
    arg("--chrome"),
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Google Chrome Beta.app/Contents/MacOS/Google Chrome Beta",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ].filter(Boolean) as string[];
  return cands.find((p) => { try { return fs.existsSync(p); } catch { return false; } }) || null;
}

async function waitCDP(port: number): Promise<boolean> {
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) return true; } catch {}
    await sleep(500);
  }
  return false;
}

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : undefined;
}
const has = (flag: string) => process.argv.includes(flag);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const SELLER_URL = process.argv.find((a) => a.startsWith("http"));
const HEADLESS = has("--headless");
const RESET = has("--reset");
const LIMIT = arg("--limit") ? parseInt(arg("--limit")!, 10) : 0;
const USE_CHROMIUM = has("--chromium");
// --api <url> : POST les cartes au backend (au lieu/en plus du fichier d'état). --api-key <clé>.
const API = arg("--api");
const API_KEY_CLI = arg("--api-key") || "";

async function apiPost(path: string, body: unknown): Promise<void> {
  if (!API) return;
  try {
    await fetch(API.replace(/\/$/, "") + path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(API_KEY_CLI ? { "X-API-Key": API_KEY_CLI } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.warn("[market] api POST err", (e as Error).message);
  }
}

// Mode discret : gros délais aléatoires + lots limités par session → reste sous le seuil de ban IP.
const DISCREET = has("--discreet");
const DELAY = arg("--delay") ? parseInt(arg("--delay")!, 10) : 1500;
const MIN_DELAY = arg("--min-delay") ? parseInt(arg("--min-delay")!, 10) : DISCREET ? 12000 : DELAY;
const MAX_DELAY = arg("--max-delay") ? parseInt(arg("--max-delay")!, 10) : DISCREET ? 28000 : DELAY;
const BATCH = arg("--batch") ? parseInt(arg("--batch")!, 10) : DISCREET ? 40 : 0; // 0 = pas de plafond
const randDelay = () => Math.floor(MIN_DELAY + Math.random() * Math.max(0, MAX_DELAY - MIN_DELAY));

const adapter: MarketAdapter = CARDMARKET;

function parsePrice(s: string): number | null {
  const m = (s || "").replace(/\s/g, "").match(/([0-9]+[.,][0-9]+|[0-9]+)/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}
function enPath(p: string): string {
  return adapter.forceLocaleEn ? p.replace(/^\/[a-z]{2}\//, "/en/") : p;
}
function buildUrl(origin: string, listPath: string, exp: string, page: number): string {
  return origin + adapter.listUrlTemplate
    .replace("{path}", enPath(listPath))
    .replace("{exp}", String(exp))
    .replace("{page}", String(page));
}

interface RawCard {
  articleId: string; name: string; expansion: string; expansionCode: string;
  rarity: string; condition: string; conditionCode: string; language: string;
  firstEd: boolean; priceText: string; amount: string; offerUrl: string; image: string;
}

async function isChallenge(page: Page): Promise<boolean> {
  const t = (await page.title().catch(() => "")).toLowerCase();
  if (/just a moment|un instant|vérification|attention required|verifying you are human/.test(t)) return true;
  return (await page.locator('iframe[src*="challenges.cloudflare.com"], #challenge-running, .cf-turnstile').count().catch(() => 0)) > 0;
}

async function isBanned(page: Page): Promise<boolean> {
  const html = (await page.content().catch(() => "")).toLowerCase();
  return /banned you|access denied|you have been blocked|error 10[0-2][0-9]|cloudflare ray id.*blocked/.test(html);
}

/** Navigue en gérant challenge Cloudflare + détection de ban. Statut: ok | banned | fail. */
async function gotoSafe(page: Page, url: string): Promise<"ok" | "banned" | "fail"> {
  for (let attempt = 0; attempt < 4; attempt++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 }); }
    catch { await sleep(3000); continue; }
    const ready = await page.waitForSelector("#UserOffersTable, " + adapter.rowSelector, { timeout: 8000 }).then(() => true).catch(() => false);
    if (ready) return "ok";
    if (await isBanned(page)) return "banned";
    if (await isChallenge(page)) {
      console.log("  ⚠ challenge Cloudflare — attente de résolution (auto/manuelle, jusqu'à 3 min)…");
      const cleared = await page.waitForSelector("#UserOffersTable, " + adapter.rowSelector, { timeout: 180000 }).then(() => true).catch(() => false);
      if (cleared) return "ok";
      if (await isBanned(page)) return "banned";
    } else {
      return "ok"; // page chargée sans tableau (édition vide possible) → extraction renverra 0
    }
  }
  return "fail";
}

// Code d'extraction passé en CHAÎNE à page.evaluate : tsx/esbuild ne le transforme pas
// (sinon il injecte un helper `__name` absent du navigateur → ReferenceError dans la page).
const EXTRACT_CODE = `(function () {
  var F = ${JSON.stringify(adapter.fields)};
  var ROW = ${JSON.stringify(adapter.rowSelector)};
  function field(row, spec) {
    if (!spec || !spec.sel) return "";
    var el = row.querySelector(spec.sel);
    if (!el) return "";
    if (spec.attr) return el.getAttribute(spec.attr) || "";
    return (el.textContent || "").trim();
  }
  return Array.prototype.slice.call(document.querySelectorAll(ROW)).map(function (row) {
    var href = field(row, F.nameHref);
    var imgHtml = field(row, F.imageHtml);
    var im = imgHtml.match(/src=["']?([^"'\\s>]+)/);
    return {
      articleId: (row.id || "").replace(/[^0-9]/g, ""),
      image: im ? im[1] : "",
      name: field(row, F.name),
      expansion: field(row, F.expansion),
      expansionCode: field(row, F.expansionCode),
      rarity: field(row, F.rarity),
      condition: field(row, F.condition),
      conditionCode: field(row, F.conditionCode),
      language: field(row, F.language),
      firstEd: !!field(row, F.firstEd),
      priceText: field(row, F.price),
      amount: field(row, F.amount),
      offerUrl: href ? (href.indexOf("http") === 0 ? href : location.origin + href) : ""
    };
  });
})()`;

async function extractRows(page: Page): Promise<RawCard[]> {
  return (await page.evaluate(EXTRACT_CODE)) as RawCard[];
}

interface State { doneIds: string[]; cards: any[]; }

function statePath(seller: string) { return path.join(OUTPUT_DIR, `cardmarket-${seller}-state.json`); }
function loadState(seller: string): State {
  try { return JSON.parse(fs.readFileSync(statePath(seller), "utf-8")); } catch { return { doneIds: [], cards: [] }; }
}
function saveState(seller: string, s: State) {
  fs.writeFileSync(statePath(seller), JSON.stringify(s), "utf-8");
}

async function main() {
  if (!SELLER_URL || !adapter.matchesUrl || !new RegExp(adapter.matchesUrl).test(SELLER_URL)) {
    console.error("Usage: npx tsx scripts/market/scrape-playwright.ts \"<url Offers/Singles d'un vendeur cardmarket>\"");
    process.exit(1);
  }
  const u = new URL(SELLER_URL);
  const origin = u.origin;
  const listPath = u.pathname;
  const seller = (listPath.match(/\/Users\/([^/]+)\//) || [])[1] || "unknown";

  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  if (RESET) { try { fs.unlinkSync(statePath(seller)); } catch {} }

  const { target, stats } = buildTargetMap(ROOT);
  console.log(`Cible : ${stats.size} noms (${stats.archetypes} archétypes, ${stats.characters} personnages)`);

  const state = loadState(seller);
  const done = new Set(state.doneIds);
  const cards: any[] = state.cards;
  console.log(`Reprise : ${done.size} éditions déjà faites, ${cards.length} cartes en mémoire`);

  // Vrai Chrome + connexion CDP (anti-Cloudflare, cf. en-tête). --launch = ancien mode.
  const PORT = arg("--port") ? parseInt(arg("--port")!, 10) : 9222;
  const profileDir = path.join(OUTPUT_DIR, `.chrome-${seller}`);
  let chromeProc: ChildProcess | null = null;
  let browser: Browser | null = null;
  let context: BrowserContext;

  if (has("--launch")) {
    context = await chromium.launchPersistentContext(profileDir, {
      headless: HEADLESS, channel: USE_CHROMIUM ? undefined : "chrome",
      viewport: { width: 1280, height: 900 },
    });
  } else {
    const chromePath = findChrome();
    if (!chromePath) { console.error('Chrome introuvable. Passe --chrome "/chemin/Chrome" ou $CHROME_PATH.'); process.exit(1); }
    console.log(`Lancement de Chrome : ${chromePath}`);
    chromeProc = spawn(chromePath, [
      `--remote-debugging-port=${PORT}`,
      `--user-data-dir=${profileDir}`,
      "--no-first-run", "--no-default-browser-check",
      "--disable-blink-features=AutomationControlled",
      SELLER_URL,
    ], { stdio: "ignore" });
    chromeProc.on("error", (e) => { console.error("Échec lancement Chrome:", e.message); process.exit(1); });
    if (!(await waitCDP(PORT))) {
      console.error(`CDP indisponible sur :${PORT}. Si un Chrome est déjà ouvert, ferme-le complètement (ou change --port).`);
      process.exit(1);
    }
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
    context = browser.contexts()[0] || (await browser.newContext());
  }
  const page = context.pages()[0] || (await context.newPage());
  async function cleanup() {
    try { if (browser) await browser.close(); else await context.close(); } catch {}
    if (chromeProc) { try { chromeProc.kill(); } catch {} }
  }

  // Ctrl-C → sauvegarde
  let stopping = false;
  const onExit = () => { if (stopping) return; stopping = true; saveState(seller, { doneIds: [...done], cards }); if (chromeProc) { try { chromeProc.kill(); } catch {} } console.log("\n💾 état sauvegardé. Relance la même commande pour reprendre."); process.exit(0); };
  process.on("SIGINT", onExit);

  const matchCard = (c: RawCard) => target[norm(c.name)] || null;

  // 1) page de base : passe Cloudflare une fois + énumère les éditions
  console.log("Ouverture de la page vendeur — résous le challenge Cloudflare dans la fenêtre Chrome si demandé (une seule fois)…");
  const baseStatus = await gotoSafe(page, buildUrl(origin, listPath, "0", 1));
  if (baseStatus === "banned") {
    console.error("🚫 IP bannie temporairement par cardmarket. Attends quelques heures puis relance (reprise auto).");
    await cleanup(); process.exit(1);
  }
  if (baseStatus !== "ok") {
    console.error("Impossible de charger la page de base (challenge non résolu ?). Relance et résous le challenge dans la fenêtre.");
    await cleanup(); process.exit(1);
  }
  let editions = await page.$$eval(adapter.sliceSelect + " option", (opts) =>
    opts.map((o) => ({ id: (o as HTMLOptionElement).value, label: (o.textContent || "").trim() }))
      .filter((o) => o.id && o.id !== "0")
  );
  console.log(`${editions.length} éditions au total.`);
  let todo = editions.filter((e) => !done.has(e.id));
  if (LIMIT) todo = todo.slice(0, LIMIT);
  console.log(`${todo.length} à parcourir.\n`);

  // 2) crawl par édition (mode discret : délais aléatoires, plafond de lot, arrêt sur ban)
  if (DISCREET) console.log(`Mode discret : ${MIN_DELAY / 1000}-${MAX_DELAY / 1000}s entre requêtes, lot de ${BATCH || "∞"} éditions/session.\n`);
  const truncated: string[] = [];
  let processed = 0; // éditions traitées CETTE session (plafond de lot)
  let banned = false;
  let consecFail = 0, softBlocked = false; // disjoncteur : N échecs d'affilée = blocage soft
  for (let si = 0; si < todo.length && !stopping && !banned && !softBlocked; si++) {
    const ed = todo[si];
    let edMatched = 0, edAll = 0, ok = true, hitCap = false;
    const edCards: any[] = []; // cartes de CETTE édition (pour POST API)
    for (let pg = 1; pg <= adapter.maxPages; pg++) {
      await sleep(randDelay());
      const st = await gotoSafe(page, buildUrl(origin, listPath, ed.id, pg));
      if (st === "banned") { banned = true; ok = false; break; }
      if (st !== "ok") { ok = false; break; }
      const raw = await extractRows(page);
      if (!raw.length) break;
      for (const r of raw) {
        if (!r.name) continue;
        const m = matchCard(r);
        // On garde TOUTES les cartes ; matched=null si pas liée à nos archétypes/persos.
        const card = {
          ...r, price: parsePrice(r.priceText), amount: parseInt(r.amount, 10) || null,
          isMatched: !!m,
          matched: m ? { archetypes: m.a, characters: m.c } : null,
          expansionSlice: ed.label,
        };
        cards.push(card);
        edCards.push(card);
        edAll++;
        if (m) edMatched++;
      }
      if (pg === adapter.maxPages && raw.length === adapter.pageSize) hitCap = true;
      if (raw.length < adapter.pageSize) break;
    }
    if (ok) {
      done.add(ed.id);
      if (hitCap) truncated.push(ed.label);
      saveState(seller, { doneIds: [...done], cards });
      if (API && edCards.length) await apiPost("/sellers/" + encodeURIComponent(seller) + "/cards", { cards: edCards });
      processed++;
      consecFail = 0;
    } else if (!banned) {
      console.log(`  (édition non terminée, sera reprise: ${ed.label})`);
      if (++consecFail >= 6) softBlocked = true;
    }
    if (edAll || si % 25 === 0) console.log(`[${si + 1}/${todo.length}] ${ed.label} → +${edAll} cartes (${edMatched} match) | total ${cards.length}`);
    if (BATCH && processed >= BATCH) { console.log(`\n⏸️  Lot de ${BATCH} éditions atteint — pause. Relance la même commande plus tard pour continuer (reprise auto).`); break; }
  }
  if (banned) console.error("\n🚫 Ban IP détecté — arrêt. État sauvegardé. Attends quelques heures puis relance (reprise auto). Augmente --min-delay/--max-delay si ça recommence.");
  if (softBlocked) console.error("\n🟠 Blocage soft détecté (6 éditions échouées d'affilée — cardmarket ne sert plus le tableau). Arrêt. État sauvegardé. Attends ~1-2h puis relance (reprise auto) ; idéalement par lots (--batch 40) espacés.");

  // 3) sortie finale
  const byArchetype: Record<string, number> = {}, byCharacter: Record<string, number> = {}, byExpansion: Record<string, number> = {};
  for (const c of cards) {
    (c.matched?.archetypes || []).forEach((a: string) => (byArchetype[a] = (byArchetype[a] || 0) + 1));
    (c.matched?.characters || []).forEach((ch: string) => (byCharacter[ch] = (byCharacter[ch] || 0) + 1));
    byExpansion[c.expansionSlice] = (byExpansion[c.expansionSlice] || 0) + 1;
  }
  const matchedCount = cards.filter((c: any) => c.isMatched).length;
  const result = {
    seller, source: adapter.id, scrapedAt: new Date().toISOString(),
    total: cards.length, totalMatched: matchedCount, editionsDone: done.size, editionsTotal: editions.length,
    byArchetype, byCharacter, byExpansion, truncatedExpansions: truncated, cards,
  };
  if (API) await apiPost("/sellers/" + encodeURIComponent(seller) + "/meta", { editionsDone: done.size, editionsTotal: editions.length, doneIds: [...done] });
  const outPath = path.join(OUTPUT_DIR, `cardmarket-${seller}.json`);
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
  console.log(`\n✓ DONE — ${cards.length} cartes (${matchedCount} liées à nos archétypes/persos) sur ${done.size}/${editions.length} éditions → ${path.relative(ROOT, outPath)}`);
  if (truncated.length) console.log(`⚠ éditions tronquées (15 pages pleines): ${truncated.join(", ")}`);
  await cleanup();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
