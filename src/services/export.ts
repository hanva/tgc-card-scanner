import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import characterData from "../data/character-cards.json";
import { CHARACTER_AVATARS } from "./avatars";
import { getCollectionEntries } from "./collection";
import { Character, CharacterCardMapping } from "../types/character";

export type ExportScope =
  | { type: "all" }
  | { type: "character"; characterId: string };

interface CharacterExportSection {
  character: Character;
  avatar?: string;
  cards: { cardId: number; cardName: string; owned: boolean }[];
  ownedCount: number;
}

interface ExportData {
  exportedAt: Date;
  totalCards: number;
  ownedTotal: number;
  sections: CharacterExportSection[];
}

const characters = characterData.characters as Character[];
const mappings = characterData.mappings as CharacterCardMapping[];

const SERIES_LABEL: Record<string, string> = { DM: "DM", GX: "GX", VideoGame: "VG" };
const SERIES_COLOR: Record<string, string> = {
  DM: "#8b5cf6",
  GX: "#f97316",
  VideoGame: "#7b68ee",
};

function cardImageUrl(cardId: number): string {
  return `https://images.ygoprodeck.com/images/cards_small/${cardId}.jpg`;
}

async function buildExportData(scope: ExportScope): Promise<ExportData> {
  const entries = await getCollectionEntries();
  const ownedIds = new Set(entries.map((e) => e.cardId));

  const targets =
    scope.type === "character"
      ? characters.filter((c) => c.id === scope.characterId)
      : characters;

  const sections: CharacterExportSection[] = [];
  let totalCards = 0;
  let ownedTotal = 0;

  for (const character of targets) {
    const mapping = mappings.find((m) => m.characterId === character.id);
    if (!mapping || mapping.cardIds.length === 0) continue;

    const seen = new Set<number>();
    const cards: { cardId: number; cardName: string; owned: boolean }[] = [];
    for (let i = 0; i < mapping.cardIds.length; i++) {
      const cardId = mapping.cardIds[i];
      if (seen.has(cardId)) continue;
      seen.add(cardId);
      cards.push({
        cardId,
        cardName: mapping.cardNames[i] || `Card ${cardId}`,
        owned: ownedIds.has(cardId),
      });
    }

    cards.sort((a, b) => {
      if (a.owned !== b.owned) return a.owned ? -1 : 1;
      return a.cardName.localeCompare(b.cardName);
    });

    const ownedCount = cards.filter((c) => c.owned).length;
    totalCards += cards.length;
    ownedTotal += ownedCount;

    sections.push({
      character,
      avatar: CHARACTER_AVATARS[character.id],
      cards,
      ownedCount,
    });
  }

  sections.sort((a, b) => {
    const pa = a.cards.length ? a.ownedCount / a.cards.length : 0;
    const pb = b.cards.length ? b.ownedCount / b.cards.length : 0;
    if (pa !== pb) return pb - pa;
    return (a.character.nameFr || a.character.name).localeCompare(
      b.character.nameFr || b.character.name
    );
  });

  return { exportedAt: new Date(), totalCards, ownedTotal, sections };
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(data: ExportData): string {
  const dateStr = data.exportedAt.toLocaleString("fr-FR", {
    dateStyle: "long",
    timeStyle: "short",
  });
  const globalPct =
    data.totalCards > 0 ? Math.round((data.ownedTotal / data.totalCards) * 100) : 0;

  const sectionsHtml = data.sections
    .map((s) => {
      const { character, avatar, cards, ownedCount } = s;
      const total = cards.length;
      const pct = total > 0 ? Math.round((ownedCount / total) * 100) : 0;
      const seriesLabel = SERIES_LABEL[character.series] || character.series;
      const seriesColor = SERIES_COLOR[character.series] || "#666";
      const displayName = character.nameFr || character.name;
      const avatarHtml = avatar
        ? `<img class="avatar" src="${esc(avatar)}" alt="" loading="lazy">`
        : `<div class="avatar avatar-fallback">${esc(displayName.charAt(0))}</div>`;

      const cardsHtml = cards
        .map(
          (c) => `<div class="card ${c.owned ? "owned" : "missing"}">
  <div class="img-wrap">
    <img src="${cardImageUrl(c.cardId)}" alt="${esc(c.cardName)}" loading="lazy" decoding="async" width="168" height="245">
    ${c.owned ? "" : `<span class="missing-tag">Manquante</span>`}
  </div>
  <p class="card-name">${esc(c.cardName)}</p>
</div>`
        )
        .join("");

      return `<details open class="section">
  <summary>
    <div class="summary-row">
      ${avatarHtml}
      <div class="summary-text">
        <div class="name-row">
          <span class="name">${esc(displayName)}</span>
          <span class="badge series" style="background:${seriesColor}">${esc(seriesLabel)}</span>
        </div>
        <div class="progress-row">
          <span class="progress-text">${ownedCount}/${total} cartes</span>
          <div class="bar"><div class="fill" style="width:${pct}%"></div></div>
          <span class="progress-pct">${pct}%</span>
        </div>
      </div>
    </div>
  </summary>
  <div class="grid">${cardsHtml}</div>
</details>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Ma collection Yu-Gi-Oh — ${data.exportedAt.toISOString().slice(0, 10)}</title>
<style>
:root{
  --bg:#0d0d1a;--surface:#16213e;--surface-2:#1a1a2e;--border:#2a2a4e;
  --gold:#e6b800;--gold-bright:#ffd700;--text:#f0f0f0;--text-dim:#aaa;--text-muted:#777;
  --owned:#2d6a4f;--owned-text:#95d5b2;--danger:#ff6b6b;
  --gap:clamp(8px,1.6vw,14px);
  --card-min:clamp(86px,14vw,140px);
  --radius:clamp(6px,1vw,10px);
}
*{box-sizing:border-box;margin:0;padding:0}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{
  background:var(--bg);color:var(--text);
  font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Ubuntu,sans-serif;
  padding:clamp(14px,3vw,28px) clamp(8px,2.5vw,24px) clamp(60px,8vw,100px);
  line-height:1.45;font-size:clamp(13px,1.6vw,15px);
  -webkit-font-smoothing:antialiased;
}
.container{max-width:1280px;margin:0 auto}
header{text-align:center;margin-bottom:clamp(20px,3vw,32px)}
header h1{
  color:var(--gold);font-size:clamp(20px,3.4vw,28px);font-weight:900;
  letter-spacing:.12em;margin-bottom:6px;line-height:1.2;
}
header .meta{color:var(--text-dim);font-size:clamp(11px,1.4vw,13px)}
.global-progress{margin:clamp(12px,2vw,18px) auto 0;max-width:min(440px,90%)}
.global-progress .label{color:#ccc;font-size:clamp(12px,1.5vw,14px);margin-bottom:6px}
.global-progress .label strong{color:var(--gold);font-size:clamp(16px,2.4vw,20px);font-weight:900}
.global-progress .bar{height:10px;background:var(--surface-2);border-radius:5px;overflow:hidden}
.global-progress .fill{height:100%;background:linear-gradient(90deg,var(--gold),var(--gold-bright));transition:width .3s}

.section{
  background:var(--surface);border:1px solid var(--border);
  border-radius:clamp(8px,1.4vw,14px);margin-bottom:clamp(10px,1.6vw,16px);overflow:hidden;
}
.section[open] summary{border-bottom:1px solid var(--border)}
summary{
  padding:clamp(10px,1.8vw,16px);cursor:pointer;list-style:none;user-select:none;
  -webkit-tap-highlight-color:transparent;
}
summary:hover{background:rgba(230,184,0,.04)}
summary::-webkit-details-marker{display:none}
.summary-row{display:flex;align-items:center;gap:clamp(8px,1.4vw,14px)}
.summary-row::before{
  content:"▶";color:var(--gold);font-size:11px;
  transition:transform .15s;flex-shrink:0;width:12px;
}
.section[open] .summary-row::before{transform:rotate(90deg)}
@media (prefers-reduced-motion:reduce){.summary-row::before,.global-progress .fill{transition:none}}

.avatar{
  width:clamp(38px,5vw,52px);height:clamp(38px,5vw,52px);
  border-radius:50%;object-fit:cover;background:var(--border);flex-shrink:0;
}
.avatar-fallback{
  display:flex;align-items:center;justify-content:center;
  font-size:clamp(16px,2.4vw,22px);font-weight:700;color:var(--gold);
}
.summary-text{flex:1;min-width:0}
.name-row{margin-bottom:5px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.name{
  font-size:clamp(14px,1.9vw,18px);font-weight:700;color:#fff;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
  min-width:0;flex:1 1 auto;
}
.badge{
  display:inline-block;font-size:clamp(9px,1.1vw,11px);font-weight:700;
  padding:2px 7px;border-radius:6px;color:var(--bg);letter-spacing:.5px;
  flex-shrink:0;
}
.progress-row{
  display:flex;align-items:center;gap:clamp(6px,1vw,10px);
  font-size:clamp(11px,1.3vw,13px);color:var(--text-dim);flex-wrap:wrap;
}
.progress-row .bar{
  flex:1;min-width:80px;height:6px;background:var(--surface-2);
  border-radius:3px;overflow:hidden;max-width:240px;
}
.progress-row .fill{height:100%;background:var(--owned);transition:width .3s}
.progress-pct{color:var(--owned-text);font-weight:600;min-width:38px;text-align:right}

.grid{
  display:grid;
  grid-template-columns:repeat(auto-fill,minmax(var(--card-min),1fr));
  gap:var(--gap);
  padding:clamp(10px,1.8vw,16px);
}
.card{text-align:center;display:flex;flex-direction:column;gap:6px}
.img-wrap{
  position:relative;aspect-ratio:59/86;background:var(--surface-2);
  border-radius:var(--radius);overflow:hidden;
  box-shadow:0 2px 4px rgba(0,0,0,.3);
}
.card img{
  width:100%;height:100%;object-fit:cover;display:block;
  background:var(--surface-2);
}
.card.missing img{filter:grayscale(85%) brightness(.5);opacity:.55}
.card.owned .img-wrap{box-shadow:0 0 0 1px var(--gold),0 2px 6px rgba(230,184,0,.2)}
.missing-tag{
  position:absolute;bottom:4px;left:4px;right:4px;
  background:rgba(255,107,107,.92);color:#fff;
  font-size:clamp(8px,1vw,10px);font-weight:700;padding:2px 4px;
  border-radius:3px;text-transform:uppercase;letter-spacing:.5px;
  text-align:center;
}
.card-name{
  font-size:clamp(10px,1.2vw,12px);color:#ccc;
  overflow:hidden;text-overflow:ellipsis;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
  min-height:2.6em;line-height:1.3;
}
.card.missing .card-name{color:var(--text-muted)}

/* Narrow phones: shrink card minimums further */
@media (max-width:380px){
  :root{--card-min:78px;--gap:6px}
  .card-name{font-size:9.5px;min-height:2.4em}
}

/* Tablet+: a bit roomier */
@media (min-width:900px){
  :root{--card-min:130px}
}

/* Wide desktop: max comfort */
@media (min-width:1400px){
  :root{--card-min:150px;--gap:16px}
}

/* Print: clean, paper-friendly */
@media print{
  body{background:#fff;color:#000;padding:0;font-size:11pt}
  .container{max-width:none}
  header h1{color:#000}
  .name,.progress-pct,.global-progress .label strong{color:#000}
  .section{background:#fff;border:1px solid #ccc;break-inside:avoid;page-break-inside:avoid;box-shadow:none;margin-bottom:8mm}
  .section[open] summary,summary:hover{background:#fff}
  .card.owned .img-wrap{box-shadow:0 0 0 1px #000}
  .card.missing img{opacity:.4;filter:grayscale(100%)}
  .summary-row::before{display:none}
  /* Force all sections open in print */
  details{display:block}
  details>*:not(summary){display:block!important}
}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>MA COLLECTION YU-GI-OH</h1>
    <div class="meta">Exporté le ${esc(dateStr)}</div>
    <div class="global-progress">
      <div class="label"><strong>${data.ownedTotal}</strong> / ${data.totalCards} cartes possédées · ${globalPct}%</div>
      <div class="bar"><div class="fill" style="width:${globalPct}%"></div></div>
    </div>
  </header>
  ${sectionsHtml || '<p style="text-align:center;color:#999">Aucune carte à exporter.</p>'}
</div>
</body>
</html>`;
}

export async function exportToHtml(scope: ExportScope): Promise<void> {
  const data = await buildExportData(scope);
  const html = renderHtml(data);

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const suffix = scope.type === "character" ? `-${scope.characterId}` : "";
  const fileName = `ygo-collection${suffix}-${timestamp}.html`;

  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(html);

  if (!(await Sharing.isAvailableAsync())) {
    throw new Error("Le partage n'est pas disponible sur cet appareil");
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: "text/html",
    dialogTitle: "Exporter ma collection",
    UTI: "public.html",
  });
}

export interface CharacterListItem {
  id: string;
  name: string;
  series: string;
  avatar?: string;
  cardCount: number;
}

export function getExportableCharacters(): CharacterListItem[] {
  return characters
    .map((c) => {
      const mapping = mappings.find((m) => m.characterId === c.id);
      return {
        id: c.id,
        name: c.nameFr || c.name,
        series: c.series,
        avatar: CHARACTER_AVATARS[c.id],
        cardCount: mapping?.cardIds.length || 0,
      };
    })
    .filter((c) => c.cardCount > 0)
    .sort((a, b) => a.name.localeCompare(b.name));
}
