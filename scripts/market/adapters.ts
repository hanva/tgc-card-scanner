/**
 * Market adapters — config "selon les sites".
 *
 * Un adapter décrit COMMENT parler à un marketplace : rewrite de locale, patron d'URL
 * de listing paginé par tranche (slice), sélecteurs CSS des lignes d'offres et de leurs
 * champs. Le moteur (snippet-template.ts) est générique et réutilise ces configs.
 * Ajouter un site = ajouter un objet MarketAdapter et l'enregistrer dans ADAPTERS.
 *
 * Sélecteurs cardmarket figés à partir du DOM réel (page Offers/Singles d'un vendeur),
 * sur le HTML BRUT renvoyé par fetch (donc attributs `title`, pas `data-bs-original-title`).
 */

export interface SelectorSpec {
  /** Sélecteur CSS relatif à la ligne. */
  sel: string;
  /** Si défini, on lit cet attribut ; sinon le textContent. */
  attr?: string;
}

export interface MarketAdapter {
  id: string;
  /** Regex (source) testée contre l'URL collée. */
  matchesUrl: string;
  /** Forcer la locale /en/ (pour des noms de cartes en anglais, alignés sur nos data). */
  forceLocaleEn: boolean;
  /**
   * cardmarket plafonne la pagination (~15 pages) par jeu de filtres → on slice par
   * édition. Patron d'URL de listing, tokens : {path} {exp} {page}.
   */
  listUrlTemplate: string;
  /** Sélecteur du <select> énumérant les tranches (éditions), lu au runtime. */
  sliceSelect: string;
  /** Taille de page (pour détecter la dernière page). */
  pageSize: number;
  /** Plafond de pagination du site. */
  maxPages: number;
  /** Sélecteur d'une ligne d'offre dans le doc fetché. */
  rowSelector: string;
  /** Extraction des champs (relatifs à la ligne). */
  fields: {
    name: SelectorSpec;
    nameHref: SelectorSpec;
    expansion: SelectorSpec;
    expansionCode: SelectorSpec;
    rarity: SelectorSpec;
    condition: SelectorSpec;
    conditionCode: SelectorSpec;
    language: SelectorSpec;
    firstEd: SelectorSpec;
    price: SelectorSpec;
    amount: SelectorSpec;
    /** HTML de la miniature (contient <img src=...>) — l'URL en est extraite par regex. */
    imageHtml: SelectorSpec;
  };
}

/**
 * cardmarket — page "Offers/Singles" d'un vendeur.
 * Listing rendu côté serveur ; filtrage par édition via ?idExpansion=, pagination ?site=.
 * Le tableau : #UserOffersTable .table-body > .row.article-row (id="stockRow<articleId>").
 */
export const CARDMARKET: MarketAdapter = {
  id: "cardmarket",
  matchesUrl: "cardmarket\\.com/.+/Users/.+/Offers/Singles",
  forceLocaleEn: true,
  listUrlTemplate: "{path}?idExpansion={exp}&site={page}&sortBy=name_asc",
  sliceSelect: "select[name='idExpansion']",
  pageSize: 20,
  maxPages: 15,
  rowSelector: "#UserOffersTable .table-body > .row.article-row",
  fields: {
    name: { sel: ".col-seller a" },
    nameHref: { sel: ".col-seller a", attr: "href" },
    expansion: { sel: "a.expansion-symbol", attr: "title" },
    expansionCode: { sel: "a.expansion-symbol span" },
    rarity: { sel: ".product-attributes svg[title]", attr: "title" },
    condition: { sel: ".article-condition", attr: "title" },
    conditionCode: { sel: ".article-condition .badge" },
    language: { sel: ".product-attributes span.icon[title]:not(.st_SpecialIcon)", attr: "title" },
    firstEd: { sel: ".product-attributes span.icon.st_SpecialIcon[title]", attr: "title" },
    price: { sel: ".col-offer .price-container .color-primary" },
    amount: { sel: ".col-offer .amount-container .item-count" },
    imageHtml: { sel: ".col-thumbnail .thumbnail-icon", attr: "data-bs-title" },
  },
};

export const ADAPTERS: MarketAdapter[] = [CARDMARKET];

export function pickAdapter(url: string): MarketAdapter | undefined {
  return ADAPTERS.find((a) => new RegExp(a.matchesUrl).test(url));
}
