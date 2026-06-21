/**
 * Clean up OCR output to better match card names.
 */
export function cleanOcrText(raw: string): string {
  let text = raw.trim();

  // Remove everything inside brackets: [Magie], [Piège], [Monstre/Effet], etc.
  text = text.replace(/\[.*?\]/g, "");
  // Also remove orphan brackets and everything after an unclosed [
  text = text.replace(/\[.*$/g, "");
  text = text.replace(/^.*\]/g, "");
  text = text.replace(/[\[\]]/g, "");

  // Remove trademark symbols
  text = text.replace(/[™®©]/g, "");

  // Remove common OCR artifacts
  text = text.replace(/[|\\{}]/g, "");

  // Remove card type/attribute words that OCR might pick up
  const REMOVE_WORDS = [
    // Attributes FR
    "TÉNÈBRES",
    "TENEBRES",
    "LUMIÈRE",
    "LUMIERE",
    "TERRE",
    "EAU",
    "FEU",
    "VENT",
    "DIVIN",
    // Attributes EN
    "DARK",
    "LIGHT",
    "EARTH",
    "WATER",
    "FIRE",
    "WIND",
    "DIVINE",
    // Card types FR
    "MAGIE",
    "PIÈGE",
    "PIEGE",
    "MONSTRE",
    "EFFET",
    "NORMAL",
    "RITUEL",
    "FUSION",
    "CONTINU",
    "ÉQUIPEMENT",
    "EQUIPEMENT",
    "TERRAIN",
    "RAPIDE",
    // Card types EN
    "SPELL",
    "TRAP",
    "MONSTER",
    "EFFECT",
    "RITUAL",
    "CONTINUOUS",
    "EQUIP",
    "FIELD",
    // Monster types FR
    "MAGICIEN",
    "GUERRIER",
    "DRAGON",
    "DÉMON",
    "DEMON",
    "MACHINE",
    "BÊTE",
    "BETE",
    "ZOMBIE",
    "FÉE",
    "FEE",
    "POISSON",
    "REPTILE",
    "ROCHER",
    "TONNERRE",
    "INSECTE",
    "PLANTE",
    "PYRO",
    "DINOSAURE",
    "AQUA",
    "BÊTE AILÉE",
    "SERPENT DE MER",
    // Edition
    "EDITION",
    "1ST",
    "LIMITED",
    "1ÈRE",
    "1ERE",
  ];

  // Remove standalone type/attribute words (case insensitive, whole words only)
  for (const word of REMOVE_WORDS) {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    text = text.replace(regex, "");
  }

  // Remove star ratings like ★★★★
  text = text.replace(/[★☆✦✧⭐]{1,12}/g, "");

  // Remove ATK/DEF values like "ATK/2500" or "DEF/2100"
  text = text.replace(/\b(ATK|DEF)\s*[/:]?\s*\d+/gi, "");

  // Remove standalone numbers (level, stats)
  text = text.replace(/^\d+$/gm, "");

  // Fix common OCR substitutions
  text = text
    .replace(/0(?=[a-zA-ZÀ-ÿ])/g, "O")
    .replace(/(?<=[a-zA-ZÀ-ÿ])0/g, "O")
    .replace(/1(?=[a-zA-ZÀ-ÿ])/g, "l")
    .replace(/(?<=[a-zA-ZÀ-ÿ])1/g, "l");

  // Normalize whitespace
  text = text.replace(/\s+/g, " ").trim();

  return text;
}
