#!/usr/bin/env python3
"""
Scrape Speed Duel pre-built deck card lists from Yugipedia,
resolve card IDs via YGOProDeck, and merge into character-cards.json.
"""

import json
import re
import time
import urllib.request
import urllib.parse
import urllib.error
import os

# ── Configuration ──────────────────────────────────────────────────────────

PRODUCTS = [
    "Speed_Duel:_Battle_City_Box",
    "Speed_Duel:_Streets_of_Battle_City",
    "Speed_Duel:_Battle_City_Finals",
    "Speed_Duel_GX:_Duel_Academy_Box",
    "Speed_Duel_GX:_Midterm_Paradox",
    "Speed_Duel_GX:_Duelists_of_Shadows",
    "Speed_Duel_GX:_Midterm_Destruction",
]

CHARACTER_NAME_TO_ID = {
    "Yami Yugi": "yami-yugi",
    "Pharaoh": "yami-yugi",
    "Yugi Muto": "yugi",
    "Yugi": "yugi",
    "Seto Kaiba": "seto-kaiba",
    "Kaiba": "seto-kaiba",
    "Joey Wheeler": "joey-wheeler",
    "Joey": "joey-wheeler",
    "Mai Valentine": "mai-valentine",
    "Mai": "mai-valentine",
    "Yami Bakura": "bakura",
    "Bakura": "bakura",
    "Yami Marik": "yami-marik",
    "Marik": "yami-marik",
    "Ishizu Ishtar": "ishizu",
    "Ishizu": "ishizu",
    "Odion": "odion",
    "Arkana": "arkana",
    "Mako Tsunami": "mako",
    "Mako": "mako",
    "Weevil Underwood": "weevil",
    "Weevil": "weevil",
    "Espa Roba": "espa-roba",
    "Rare Hunter": "rare-hunter",
    "Strings": "strings",
    "Jaden Yuki": "jaden-yuki",
    "Jaden": "jaden-yuki",
    "Supreme King Jaden": "supreme-king-jaden",
    "Alexis Rhodes": "alexis-rhodes",
    "Alexis": "alexis-rhodes",
    "Chazz Princeton": "chazz-princeton",
    "Chazz": "chazz-princeton",
    "Zane Truesdale": "zane-truesdale",
    "Zane": "zane-truesdale",
    "Syrus Truesdale": "syrus-truesdale",
    "Syrus": "syrus-truesdale",
    "Bastion Misawa": "bastion-misawa",
    "Bastion": "bastion-misawa",
    "Aster Phoenix": "aster-phoenix",
    "Aster": "aster-phoenix",
    "Jesse Anderson": "jesse-anderson",
    "Jesse": "jesse-anderson",
    "Axel Brodie": "axel-brodie",
    "Axel": "axel-brodie",
    "Vellian Crowler": "crowler",
    "Dr. Crowler": "crowler",
    "Tyranno Hassleberry": "tyranno-hassleberry",
    "Hassleberry": "tyranno-hassleberry",
    "Sartorius": "sartorius",
    "Sartorius Kumar": "sartorius",
    "Nightshroud": "nightshroud",
    "Atticus Rhodes": "nightshroud",
    "Camula": "camula",
    "Tania": "tania",
    "Titan": "titan",
    "Amnael": "amnael",
    "Lyman Banner": "amnael",
    "Kagemaru": "kagemaru",
    "Adrian Gecko": "adrian-gecko",
    "Adrian": "adrian-gecko",
    "Jim Crocodile Cook": "jim-cook",
    "Jim Cook": "jim-cook",
    "Paradox Brothers": "paradox-brothers",
    "Lumis and Umbra": "lumis-umbra",
}

NEW_CHARACTERS_INFO = {
    "strings": {"name": "Strings", "nameFr": "Strings", "series": "DM"},
    "rare-hunter": {"name": "Rare Hunter", "nameFr": "Rare Hunter", "series": "DM"},
    "paradox-brothers": {"name": "Paradox Brothers", "nameFr": "Paradox Brothers", "series": "DM"},
    "lumis-umbra": {"name": "Lumis and Umbra", "nameFr": "Lumis and Umbra", "series": "DM"},
    "supreme-king-jaden": {"name": "Supreme King Jaden", "nameFr": "Supreme King Jaden", "series": "GX"},
    "zane-truesdale": {"name": "Zane Truesdale", "nameFr": "Zane Truesdale", "series": "GX"},
}

DATA_FILE = os.path.join(os.path.dirname(__file__), "..", "src", "data", "character-cards.json")

# ── Helpers ────────────────────────────────────────────────────────────────

def fetch_json(url):
    """Fetch JSON from a URL."""
    req = urllib.request.Request(url, headers={"User-Agent": "SpeedDuelScraper/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_wikitext(page):
    """Fetch the wikitext for a Yugipedia page."""
    url = (
        f"https://yugipedia.com/api.php?action=parse&page={urllib.parse.quote(page)}"
        f"&prop=wikitext&format=json"
    )
    data = fetch_json(url)
    return data["parse"]["wikitext"]["*"]


def parse_decklists(wikitext):
    """
    Parse {{Decklist|Character Name ...}} templates from wikitext.
    Returns dict: { character_name: [card_name, ...] }
    """
    results = {}

    # Find all Decklist templates - they can be nested with {{ inside
    # We need to find matching {{ }} pairs
    decklists = find_decklist_templates(wikitext)

    for decklist_text in decklists:
        # The character name is between "Decklist|" and the next | or \n
        # Format: {{Decklist|Character Name\n...\n}}
        match = re.match(r'\{\{Decklist\|([^|\n}]+)', decklist_text)
        if not match:
            continue
        char_name = match.group(1).strip()

        # Extract card names from [[Card Name]] or [[Target|Display Name]] links
        card_names = []
        # Match [[...]] patterns
        for link_match in re.finditer(r'\[\[([^\]]+)\]\]', decklist_text):
            link_content = link_match.group(1)
            # If it has a pipe, use the display name (after pipe)
            if '|' in link_content:
                card_name = link_content.split('|')[-1].strip()
            else:
                card_name = link_content.strip()

            # Skip category/file links and section headers
            if card_name and not card_name.startswith(('Category:', 'File:', '#')):
                card_names.append(card_name)

        if char_name and card_names:
            # Remove duplicates while preserving order
            seen = set()
            unique_cards = []
            for c in card_names:
                if c not in seen:
                    seen.add(c)
                    unique_cards.append(c)
            results[char_name] = unique_cards

    return results


def find_decklist_templates(wikitext):
    """Find all {{Decklist|...}} templates, handling nested braces."""
    templates = []
    search_start = 0
    while True:
        idx = wikitext.find('{{Decklist|', search_start)
        if idx == -1:
            break
        # Find the matching closing }}
        depth = 0
        i = idx
        while i < len(wikitext):
            if wikitext[i:i+2] == '{{':
                depth += 1
                i += 2
            elif wikitext[i:i+2] == '}}':
                depth -= 1
                if depth == 0:
                    templates.append(wikitext[idx:i+2])
                    break
                i += 2
            else:
                i += 1
        search_start = idx + 1
    return templates


def resolve_card_id(card_name, cache):
    """Resolve a card name to its YGOProDeck ID. Returns (id, resolved_name) or (None, card_name)."""
    if card_name in cache:
        return cache[card_name]

    url = f"https://db.ygoprodeck.com/api/v7/cardinfo.php?name={urllib.parse.quote(card_name)}"
    try:
        data = fetch_json(url)
        if "data" in data and len(data["data"]) > 0:
            card_id = data["data"][0]["id"]
            resolved_name = data["data"][0]["name"]
            cache[card_name] = (card_id, resolved_name)
            return (card_id, resolved_name)
    except urllib.error.HTTPError as e:
        if e.code == 400:
            print(f"  WARNING: Card not found: {card_name}")
        else:
            print(f"  ERROR: HTTP {e.code} for card: {card_name}")
    except Exception as e:
        print(f"  ERROR resolving '{card_name}': {e}")

    cache[card_name] = (None, card_name)
    return (None, card_name)


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    # Collect all character -> card names from all products
    all_character_cards = {}  # char_id -> set of card names

    for page in PRODUCTS:
        print(f"\n{'='*60}")
        print(f"Fetching: {page}")
        print(f"{'='*60}")

        try:
            wikitext = fetch_wikitext(page)
        except Exception as e:
            print(f"  ERROR fetching page: {e}")
            continue

        decklists = parse_decklists(wikitext)
        print(f"  Found {len(decklists)} decklists")

        for char_name, cards in decklists.items():
            char_id = CHARACTER_NAME_TO_ID.get(char_name)
            if char_id is None:
                print(f"  WARNING: Unknown character '{char_name}', skipping")
                continue
            print(f"  {char_name} -> {char_id}: {len(cards)} cards")

            if char_id not in all_character_cards:
                all_character_cards[char_id] = set()
            all_character_cards[char_id].update(cards)

        time.sleep(0.5)  # Be nice to Yugipedia

    # Resolve card names to IDs
    print(f"\n{'='*60}")
    print("Resolving card names to IDs via YGOProDeck...")
    print(f"{'='*60}")

    # Collect all unique card names
    all_card_names = set()
    for cards in all_character_cards.values():
        all_card_names.update(cards)

    print(f"Total unique cards to resolve: {len(all_card_names)}")

    card_cache = {}  # card_name -> (id, resolved_name)
    resolved_count = 0
    failed_count = 0

    for card_name in sorted(all_card_names):
        card_id, resolved_name = resolve_card_id(card_name, card_cache)
        if card_id is not None:
            resolved_count += 1
        else:
            failed_count += 1
        time.sleep(0.1)  # 100ms delay between API calls

    print(f"\nResolved: {resolved_count}, Failed: {failed_count}")

    # Load existing data
    print(f"\n{'='*60}")
    print("Merging into character-cards.json...")
    print(f"{'='*60}")

    with open(DATA_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Build lookup for existing characters and mappings
    existing_char_ids = {c["id"] for c in data["characters"]}
    mapping_by_char = {}
    for m in data["mappings"]:
        mapping_by_char[m["characterId"]] = m

    # Add new characters
    for char_id, info in NEW_CHARACTERS_INFO.items():
        if char_id not in existing_char_ids:
            data["characters"].append({
                "id": char_id,
                "name": info["name"],
                "nameFr": info["nameFr"],
                "series": info["series"],
            })
            print(f"  Added new character: {char_id}")

    # Merge card data
    for char_id, card_names in all_character_cards.items():
        # Resolve all cards for this character
        char_card_ids = []
        char_card_names = []
        for cn in sorted(card_names):
            cid, resolved = resolve_card_id(cn, card_cache)
            if cid is not None:
                char_card_ids.append(cid)
                char_card_names.append(resolved)

        if char_id in mapping_by_char:
            # Existing mapping - merge
            existing = mapping_by_char[char_id]
            existing_ids_set = set(existing["cardIds"])
            existing_names_set = set(existing["cardNames"])

            new_ids_added = 0
            new_names_added = 0

            for cid, cname in zip(char_card_ids, char_card_names):
                if cid not in existing_ids_set:
                    existing["cardIds"].append(cid)
                    existing_ids_set.add(cid)
                    new_ids_added += 1
                if cname not in existing_names_set:
                    existing["cardNames"].append(cname)
                    existing_names_set.add(cname)
                    new_names_added += 1

            # Update context
            if existing.get("context") == "anime":
                existing["context"] = "both"
                print(f"  {char_id}: updated context anime -> both, added {new_ids_added} new cards")
            else:
                print(f"  {char_id}: added {new_ids_added} new cards (context: {existing.get('context', 'N/A')})")
        else:
            # New mapping
            new_mapping = {
                "characterId": char_id,
                "cardIds": char_card_ids,
                "cardNames": char_card_names,
                "context": "speed-duel",
            }
            data["mappings"].append(new_mapping)
            mapping_by_char[char_id] = new_mapping
            print(f"  {char_id}: NEW mapping with {len(char_card_ids)} cards (context: speed-duel)")

    # Update version and date
    data["version"] = data.get("version", 0) + 1
    data["lastUpdated"] = "2026-03-22"

    # Write back
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nDone! Updated {DATA_FILE}")
    print(f"Version: {data['version']}, Characters: {len(data['characters'])}, Mappings: {len(data['mappings'])}")


if __name__ == "__main__":
    main()
