import TextRecognition from "@react-native-ml-kit/text-recognition";
import { cleanOcrText } from "../utils/ocrCleanup";

// Set code pattern: XXX-FRXXX or XXXX-FRXXX (also matches OCR errors like FRO66)
const SET_CODE_REGEX = /[A-Z0-9]{2,5}-[A-Z]{2}[A-Z0-9]?[0-9O]{2,3}/i;

/**
 * Fix common OCR errors in set codes.
 * After the 2-letter language code, all characters should be digits.
 * e.g. AGOV-FRO66 → AGOV-FR066
 */
function fixSetCode(raw: string): string {
  const upper = raw.toUpperCase();
  const dashIdx = upper.indexOf("-");
  if (dashIdx === -1) return upper;

  // Fix O→0 in prefix where digits are expected (e.g. DPO8 → DP08)
  // Replace O that is adjacent to a digit (O8 → 08, 8O → 80)
  let prefix = upper.substring(0, dashIdx);
  prefix = prefix.replace(/O(?=\d)/g, "0").replace(/(?<=\d)O/g, "0");
  const suffix = upper.substring(dashIdx + 1); // e.g. FRO66

  if (suffix.length < 4) return upper;

  // First 2 chars are language code (FR, EN, DE, etc.)
  const lang = suffix.substring(0, 2);
  // Rest should be digits — replace O→0, I→1, l→1, S→5, B→8
  const numPart = suffix.substring(2)
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/l/g, "1")
    .replace(/S/g, "5");

  return `${prefix}-${lang}${numPart}`;
}

/**
 * Run OCR on a card photo and extract the card name + set code.
 *
 * Returns the card name. If a set code is found anywhere in the image,
 * it's prepended with a special marker so the search can use it.
 */
export async function recognizeCardName(photoUri: string): Promise<string> {
  const result = await TextRecognition.recognize(photoUri);

  if (result.blocks.length === 0) return "";

  // First pass: look for a set code anywhere in all blocks
  let setCode: string | null = null;
  for (const block of result.blocks) {
    const fullText = block.text;
    const match = fullText.match(SET_CODE_REGEX);
    if (match) {
      setCode = fixSetCode(match[0]);
      break;
    }
  }

  // Sort blocks by vertical position (topmost first)
  const sortedBlocks = [...result.blocks].sort(
    (a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0)
  );

  // Try each block from top to bottom to find the card name
  let cardName = "";
  for (const block of sortedBlocks) {
    const firstLine = block.lines?.[0]?.text || block.text.split("\n")[0];
    const cleaned = cleanOcrText(firstLine);

    if (cleaned.length < 3) continue;
    if (!/[a-zA-ZÀ-ÿ]/.test(cleaned)) continue;
    if (cleaned.length > 60) continue;

    const lower = cleaned.toLowerCase();
    const NOISE = [
      "atk", "def", "ténèbres", "tenebres", "lumière", "lumiere",
      "eau", "feu", "terre", "vent", "dark", "light", "water",
      "fire", "earth", "wind", "divine", "effet", "normal",
      "spell", "trap", "magie", "piège", "piege", "edition",
      "1st", "limited", "1ère", "1ere",
    ];
    if (NOISE.some((n) => lower === n)) continue;

    // Skip if this line IS a set code
    if (SET_CODE_REGEX.test(cleaned) && cleaned.length < 15) continue;

    cardName = cleaned;
    break;
  }

  if (!cardName) {
    const fallback =
      sortedBlocks[0].lines?.[0]?.text || sortedBlocks[0].text.split("\n")[0];
    cardName = cleanOcrText(fallback);
  }

  // If we found a set code and no good card name, return the set code
  // If we found both, return the set code (more reliable for lookup)
  if (setCode) {
    return setCode;
  }

  return cardName;
}
