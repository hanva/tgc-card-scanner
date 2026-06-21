export interface Arc {
  id: string;
  name: string;
  range: [number, number];
}

export const DM_ARCS: Arc[] = [
  { id: "dk", name: "Duelist Kingdom", range: [1, 49] },
  { id: "bc", name: "Battle City", range: [50, 97] },
  { id: "bcf", name: "Battle City Finals", range: [98, 144] },
  { id: "wtd", name: "Waking the Dragons", range: [145, 184] },
  { id: "kcgp", name: "KC Grand Prix", range: [185, 198] },
  { id: "pm", name: "Pharaoh's Memory", range: [199, 224] },
];

export const GX_ARCS: Arc[] = [
  { id: "gx1", name: "Saison 1", range: [1, 52] },
  { id: "gx2", name: "Saison 2", range: [53, 104] },
  { id: "gx3", name: "Saison 3", range: [105, 156] },
  { id: "gx4", name: "Saison 4", range: [157, 180] },
];

export function getArcsForSeries(series: string): Arc[] {
  return series === "DM" ? DM_ARCS : GX_ARCS;
}

export function getArcForEpisode(episodeId: string): Arc | undefined {
  const match = episodeId.match(/^(DM|GX)-(\d+)$/);
  if (!match) return undefined;
  const [, series, numStr] = match;
  const num = parseInt(numStr, 10);
  const arcs = series === "DM" ? DM_ARCS : GX_ARCS;
  return arcs.find((a) => num >= a.range[0] && num <= a.range[1]);
}
