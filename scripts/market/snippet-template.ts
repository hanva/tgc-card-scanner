/**
 * Construit le snippet JS exécuté DANS le navigateur (console DevTools en Phase 1,
 * `injectedJavaScript` d'une WebView en Phase 2).
 *
 * Stratégie : cardmarket plafonne la pagination (~15 pages) par jeu de filtres, donc on
 * crawle l'inventaire du vendeur TRANCHE PAR TRANCHE (par édition `idExpansion`, énumérées
 * au runtime depuis le <select> de la page), et on MATCHE en local chaque carte contre nos
 * archétypes/personnages. Locale forcée à /en/ pour des noms anglais alignés sur nos data.
 *
 * Réseau : cardmarket renvoie des 429 si on va trop vite → fetch poli (espacement global
 * + backoff exponentiel sur 429/503, Retry-After, ralentissement durable).
 *
 * Robustesse / reprise : sur laptop on persiste l'avancement par édition dans localStorage,
 * donc un run interrompu (rate-limit, reload, crash) REPREND où il s'était arrêté. Une édition
 * non terminée (réseau) n'est pas marquée faite → réessayée au prochain run.
 *   window.__MARKET_RESET__ = true;  // efface l'avancement persistant et repart de zéro
 *
 * Hôte (optionnel) via globals — seul point qui diffère laptop vs mobile :
 *   window.__MARKET_HOST__ = {
 *     emit?(payload),         // après CHAQUE édition → sauvegarde incrémentale (mobile)
 *     onProgress?(progress),  // barre de progression
 *     onDone?(result),        // résultat agrégé final
 *     queriesDone?: string[], // clés "exp:<id>" déjà faites (mobile gère sa propre persistance)
 *     limit?: number,         // ne parcourir que N éditions (tests)
 *     baseDelay?: number,     // ms entre requêtes (défaut 900)
 *   }
 *   window.__MARKET_DEBUG__ = true; // valide sélecteurs + matching sur 1 édition, sans tout crawler
 *
 * Sans hôte (laptop) : accumule + persiste + télécharge un JSON à la fin.
 */
import { MarketAdapter } from "./adapters";
import { TargetMap } from "./targets";

export interface SnippetData {
  adapter: MarketAdapter;
  target: TargetMap;
}

export function buildSnippet(data: SnippetData): string {
  const CONFIG = JSON.stringify(data.adapter);
  const TARGET = JSON.stringify(data.target);

  // Corps : pas de backticks ni de `${}` à l'intérieur (concat de chaînes) ; antislashs de
  // regex doublés pour traverser ce template literal TS intact.
  const body = `
(async function () {
  'use strict';
  var CONFIG = ${CONFIG};
  var TARGET = ${TARGET};
  var F = CONFIG.fields;
  var HOST = window.__MARKET_HOST__ || {};
  var DEBUG = !!window.__MARKET_DEBUG__;
  var useLocal = (typeof HOST.emit !== 'function'); // laptop ⇒ persistance localStorage

  // ── helpers réseau ──
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  // cardmarket a une fenêtre de quota stricte : on démarre prudent et, sur 429, on fait un
  // cooldown long (qui vide la fenêtre) tout en augmentant durablement l'espacement de base.
  var MIN_DELAY = HOST.baseDelay || 1800;
  var BASE_DELAY = MIN_DELAY;
  var lastFetchAt = 0, okStreak = 0;
  async function politeFetch(url) {
    for (var attempt = 0; attempt < 8; attempt++) {
      var wait = BASE_DELAY - (Date.now() - lastFetchAt);
      if (wait > 0) await sleep(wait);
      lastFetchAt = Date.now();
      var res;
      try { res = await fetch(url); }
      catch (e) { await sleep(3000); continue; }
      if (res.status === 429 || res.status === 503) {
        var ra = parseInt(res.headers.get('Retry-After') || '', 10);
        var backoff = ra > 0 ? ra * 1000 : Math.min(60000, 10000 * Math.pow(2, attempt));
        BASE_DELAY = Math.min(6000, BASE_DELAY + 400); // increase additif
        okStreak = 0;
        console.warn('[market] ' + res.status + ' — cooldown ' + Math.round(backoff / 1000) + 's (delay→' + BASE_DELAY + 'ms)');
        await sleep(backoff);
        continue;
      }
      // succès : on redescend doucement vers le débit soutenable (decrease additif)
      if (++okStreak % 15 === 0 && BASE_DELAY > MIN_DELAY) {
        BASE_DELAY = Math.max(MIN_DELAY, BASE_DELAY - 200);
      }
      return res;
    }
    return null;
  }
  async function fetchText(url) {
    var res = await politeFetch(url);
    if (!res || !res.ok) return null;
    return await res.text();
  }

  // ── helpers DOM / parsing ──
  function parse(html) { return new DOMParser().parseFromString(html || '', 'text/html'); }
  function pick(root, sel) { try { return sel ? root.querySelector(sel) : null; } catch (e) { return null; } }
  function field(row, spec) {
    if (!spec || !spec.sel) return '';
    var el = pick(row, spec.sel);
    if (!el) return '';
    if (spec.attr) return el.getAttribute(spec.attr) || '';
    return (el.textContent || '').trim();
  }
  function parsePrice(s) {
    var m = (s || '').replace(/\\s/g, '').match(/([0-9]+[.,][0-9]+|[0-9]+)/);
    return m ? parseFloat(m[1].replace(',', '.')) : null;
  }
  function norm(s) {
    return (s || '').toLowerCase()
      .normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
      .replace(/\\([^)]*\\)/g, ' ')
      .replace(/[^a-z0-9 ]/g, ' ')
      .replace(/\\s+/g, ' ').trim();
  }
  function enPath(p) { return CONFIG.forceLocaleEn ? p.replace(/^\\/[a-z]{2}\\//, '/en/') : p; }
  function buildUrl(exp, page) {
    return CONFIG.listUrlTemplate
      .replace('{path}', enPath(location.pathname))
      .replace('{exp}', String(exp))
      .replace('{page}', String(page));
  }
  function extractRow(row) {
    var href = field(row, F.nameHref);
    var priceText = field(row, F.price);
    var imgHtml = field(row, F.imageHtml);
    var im = imgHtml.match(/src=["']?([^"'\\s>]+)/);
    return {
      articleId: (row.id || '').replace(/[^0-9]/g, ''),
      image: im ? im[1] : '',
      name: field(row, F.name),
      expansion: field(row, F.expansion),
      expansionCode: field(row, F.expansionCode),
      rarity: field(row, F.rarity),
      condition: field(row, F.condition),
      conditionCode: field(row, F.conditionCode),
      language: field(row, F.language),
      firstEd: !!field(row, F.firstEd),
      priceText: priceText,
      price: parsePrice(priceText),
      amount: parseInt(field(row, F.amount), 10) || null,
      offerUrl: href ? (href.indexOf('http') === 0 ? href : location.origin + href) : '',
    };
  }
  function matchCard(card) { return TARGET[norm(card.name)] || null; }
  function readSlices(doc) {
    var sel = pick(doc, CONFIG.sliceSelect) || pick(document, CONFIG.sliceSelect);
    if (!sel) return [];
    return [].slice.call(sel.options || sel.querySelectorAll('option'))
      .map(function (o) { return { id: o.value, label: (o.textContent || '').trim() }; })
      .filter(function (o) { return o.id && o.id !== '0'; });
  }

  // ── seller + persistance locale (laptop) ──
  var sellerMatch = location.pathname.match(/\\/Users\\/([^/]+)\\//);
  var seller = sellerMatch ? sellerMatch[1] : 'unknown';
  var LS = (function () { try { return window.localStorage; } catch (e) { return null; } })();
  var PFX = 'mkt_' + CONFIG.id + '_' + seller + '_';
  function lsGet(suffix, dflt) { if (!LS) return dflt; try { var v = LS.getItem(PFX + suffix); return v ? JSON.parse(v) : dflt; } catch (e) { return dflt; } }
  function lsSet(suffix, val) { if (!LS) return; try { LS.setItem(PFX + suffix, JSON.stringify(val)); } catch (e) { console.warn('[market] localStorage', e && e.name); } }
  function lsClear() { if (!LS) return; var ks = []; for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (k && k.indexOf(PFX) === 0) ks.push(k); } ks.forEach(function (k) { LS.removeItem(k); }); }
  if (window.__MARKET_RESET__ && useLocal) { lsClear(); console.log('[market] avancement effacé (reset)'); }

  // ── DEBUG : valide /en/, énumération, extraction+matching, et filtre idExpansion ──
  if (DEBUG) {
    var baseDoc = parse(await fetchText(buildUrl(0, 1)));
    var baseRows = baseDoc.querySelectorAll(CONFIG.rowSelector);
    console.log('[diag] base /en/ (idExpansion=0, site=1) → ' + baseRows.length + ' lignes');
    var sl = readSlices(baseDoc);
    console.log('[diag] éditions trouvées:', sl.length);
    if (!baseRows.length) { console.log('[diag] 0 ligne en base — vérifier rowSelector / locale'); return; }
    var titles = [];
    for (var b = 0; b < baseRows.length; b++) { var t = field(baseRows[b], F.expansion); if (t) titles.push(t); }
    console.log('[diag] éditions présentes (échantillon):', JSON.stringify(titles.slice(0, 6)));
    console.log('[diag] — extraction + matching (page de base) —');
    for (var i = 0; i < Math.min(baseRows.length, 6); i++) {
      var c = extractRow(baseRows[i]); var m = matchCard(c);
      console.log('[diag] ' + JSON.stringify({ name: c.name, code: c.expansionCode, rar: c.rarity, cond: c.conditionCode, lang: c.language, price: c.price, amt: c.amount, match: m ? { a: m.a, c: m.c } : null }));
    }
    var labelToId = {}; sl.forEach(function (s) { labelToId[s.label] = s.id; });
    var testId = null, testLabel = null;
    for (var ti = 0; ti < titles.length; ti++) { if (labelToId[titles[ti]]) { testId = labelToId[titles[ti]]; testLabel = titles[ti]; break; } }
    if (testId) {
      var fRows = parse(await fetchText(buildUrl(testId, 1))).querySelectorAll(CONFIG.rowSelector);
      console.log('[diag] filtre idExpansion=' + testId + ' ("' + testLabel + '") site=1 → ' + fRows.length + ' lignes (doit être >0)');
    }
    return;
  }

  // ── tranches à parcourir ──
  var bootDoc = parse(await fetchText(buildUrl(0, 1)));
  var slices = readSlices(bootDoc);
  if (!slices.length) { console.error('[market] aucune édition trouvée — abandon'); return; }

  // état (avec reprise)
  var results = [];
  var doneIds = {};
  if (useLocal) {
    var idx = lsGet('idx', []);
    idx.forEach(function (id) { doneIds[id] = true; results = results.concat(lsGet('c_' + id, [])); });
  } else {
    (HOST.queriesDone || []).forEach(function (k) { doneIds[String(k).replace('exp:', '')] = true; });
  }
  var todo = slices.filter(function (s) { return !doneIds[s.id]; });
  if (HOST.limit) todo = todo.slice(0, HOST.limit);
  console.log('[market] ' + slices.length + ' éditions, ' + Object.keys(doneIds).length + ' déjà faites, ' + todo.length + ' à parcourir | delay ' + BASE_DELAY + 'ms | ' + results.length + ' cartes reprises');

  // ── crawl + matching ──
  var truncated = [];

  async function crawlSlice(slice) {
    var batch = [], ok = true, hitCap = false;
    for (var page = 1; page <= CONFIG.maxPages; page++) {
      var html = await fetchText(buildUrl(slice.id, page));
      if (html === null) { ok = false; break; } // réseau KO après retries → édition non terminée
      var doc = parse(html);
      var rows = doc.querySelectorAll(CONFIG.rowSelector);
      if (!rows.length) break;
      for (var i = 0; i < rows.length; i++) {
        var card = extractRow(rows[i]);
        if (!card.name) continue;
        var m = matchCard(card);
        card.isMatched = !!m;
        card.matched = m ? { archetypes: m.a || [], characters: m.c || [] } : null;
        card.expansionSlice = slice.label;
        batch.push(card); // on garde TOUTES les cartes (matched=null si non liée)
      }
      if (page === CONFIG.maxPages && rows.length === CONFIG.pageSize) hitCap = true;
      if (rows.length < CONFIG.pageSize) break;
    }
    return { batch: batch, ok: ok, hitCap: hitCap };
  }

  for (var si = 0; si < todo.length; si++) {
    var slice = todo[si];
    var r = await crawlSlice(slice);
    if (r.ok) {
      doneIds[slice.id] = true;
      for (var k = 0; k < r.batch.length; k++) results.push(r.batch[k]);
      if (r.hitCap) truncated.push(slice.label);
      if (useLocal) { lsSet('c_' + slice.id, r.batch); lsSet('idx', Object.keys(doneIds)); }
    } else {
      console.warn('[market] édition non terminée (réseau), sera reprise au prochain run:', slice.label);
    }
    var edMatched = r.batch.filter(function (c) { return c.isMatched; }).length;
    var totalMatched = results.filter(function (c) { return c.isMatched; }).length;
    var progress = { index: si + 1, total: todo.length, slice: slice.label, added: r.batch.length, matched: edMatched, total: results.length, totalMatched: totalMatched, ok: r.ok };
    if (r.batch.length) console.log('[market] ' + progress.index + '/' + progress.total + ' ' + slice.label + ' → +' + r.batch.length + ' (' + edMatched + ' match) | total ' + results.length);
    else if (si % 25 === 0) console.log('[market] ' + progress.index + '/' + progress.total + ' … (scan en cours, ' + results.length + ' cartes)');
    if (typeof HOST.emit === 'function') HOST.emit({ key: 'exp:' + slice.id, slice: slice, batch: r.batch, ok: r.ok, progress: progress });
    if (typeof HOST.onProgress === 'function') HOST.onProgress(progress);
  }

  // ── agrégats (recalculés depuis l'ensemble, reprise comprise) ──
  var byArchetype = {}, byCharacter = {}, byExpansion = {};
  results.forEach(function (c) {
    (c.matched && c.matched.archetypes || []).forEach(function (a) { byArchetype[a] = (byArchetype[a] || 0) + 1; });
    (c.matched && c.matched.characters || []).forEach(function (ch) { byCharacter[ch] = (byCharacter[ch] || 0) + 1; });
    byExpansion[c.expansionSlice] = (byExpansion[c.expansionSlice] || 0) + 1;
  });

  var result = {
    seller: seller, source: CONFIG.id, scrapedAt: new Date().toISOString(),
    total: results.length, totalMatched: results.filter(function (c) { return c.isMatched; }).length,
    editionsDone: Object.keys(doneIds).length, editionsTotal: slices.length,
    byArchetype: byArchetype, byCharacter: byCharacter, byExpansion: byExpansion,
    truncatedExpansions: truncated, cards: results,
  };
  console.log('[market] DONE — ' + result.total + ' cartes (' + result.totalMatched + ' liées) sur ' + result.editionsDone + '/' + slices.length + ' éditions');
  if (truncated.length) console.warn('[market] ⚠ éditions tronquées (15 pages pleines, données incomplètes):', truncated);
  if (typeof HOST.onDone === 'function') HOST.onDone(result);
  if (typeof HOST.emit !== 'function') {
    var blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = CONFIG.id + '-' + seller + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  return result;
})();
`;
  return body.trimStart();
}
