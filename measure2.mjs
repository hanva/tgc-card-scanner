import fs from "fs";
const arch = JSON.parse(fs.readFileSync("/Users/nicolas.tran/modji/tgc-card-scanner/src/data/archetype-cards.json", "utf8"));
const additions = new Set(fs.readFileSync("/tmp/additions.txt", "utf8").trim().split("\n").map(l => l.split(" → ")[0]));

// Data officielle = data actuelle MOINS les 287 cartes liées déjà ajoutées
const official = {};
for (const [a, names] of Object.entries(arch)) official[a] = names.filter(n => !additions.has(n));

const dump = (await (await fetch("https://db.ygoprodeck.com/api/v7/cardinfo.php")).json()).data;
console.log("dump:", dump.length, "cards");
const byName = new Map(dump.map(c => [c.name, c]));
const memberOf = new Map();
for (const [a, names] of Object.entries(official)) for (const n of names) (memberOf.get(n) || memberOf.set(n, []).get(n)).push(a);

const QUOTE = /"([^"]+)"/g;
const citedBy = new Map(); // carte candidate → Set(archétypes)
for (const [a, names] of Object.entries(official)) {
  for (const n of names) {
    const card = byName.get(n);
    if (!card?.desc) continue;
    for (const m of card.desc.matchAll(QUOTE)) {
      const qc = byName.get(m[1]);
      if (!qc || qc.archetype || memberOf.has(m[1])) continue;
      (citedBy.get(m[1]) || citedBy.set(m[1], new Set()).get(m[1])).add(a);
    }
  }
}
for (const c of dump) {
  if (c.archetype || memberOf.has(c.name) || !c.desc) continue;
  for (const m of c.desc.matchAll(QUOTE)) {
    const archs = memberOf.get(m[1]);
    if (archs) for (const a of archs) (citedBy.get(c.name) || citedBy.set(c.name, new Set()).get(c.name)).add(a);
  }
}

const dist = {};
for (const [, s] of citedBy) dist[s.size] = (dist[s.size] || 0) + 1;
console.log("distribution nb archétypes liés → nb cartes:", JSON.stringify(dist, null, 0));

const exactly2 = [...citedBy.entries()].filter(([, s]) => s.size === 2);
console.log("\n=== règle ≤2 : cartes EN PLUS (liées à exactement 2 archétypes):", exactly2.length, "cartes → ", exactly2.length * 2, "liens ===");
for (const [name, s] of exactly2.sort((a, b) => a[0].localeCompare(b[0]))) console.log(`${name} → ${[...s].join(" + ")}`);
