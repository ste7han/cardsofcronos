"""
Controleert per kaart of het effect ooit afvuurt.

    ./venv/bin/python audit_cards.py [matches_per_kaart]

Elke kaart wordt in een geldig deck gezet en een aantal keer gespeeld, zowel als
speler 1 als als speler 2 (de engine behandelt de decks niet symmetrisch, dus dat
scheelt). Per kaart onderscheiden we drie uitkomsten:

  vuurt   – er staat een actieregel over de kaart in het logboek
  skipt   – de engine overwoog de kaart maar de voorwaarde werd niet gehaald
  stil    – de kaart komt buiten de opstelling nooit voor: verdacht

"stil" betekent niet automatisch kapot: een kaart kan een puur passief effect
hebben dat nergens gelogd wordt. Maar het is wel de lijst om na te lopen.
"""
import collections
import zlib
import contextlib
import io
import json
import multiprocessing as mp
import os
import random
import re
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

CARDS = json.load(open(os.path.join(BASE_DIR, "COC_Cards_parsed.json"), encoding="utf-8"))
BY_ID = {c["card_id"]: c for c in CARDS}
BY_TYPE = {
    t: [c["card_id"] for c in CARDS if c.get("card_type") == t]
    for t in ("Project", "Support", "Founder")
}

NEEDED = {"Project": 5, "Support": 5, "Founder": 1}


def deck_met(card_id, rng):
    """Een geldig 5/5/1 deck waar deze kaart zeker in zit."""
    soort = BY_ID[card_id]["card_type"]
    deck = [card_id]
    for t, n in NEEDED.items():
        pool = [c for c in BY_TYPE[t] if c != card_id]
        deck += rng.sample(pool, n - (1 if t == soort else 0))
    return deck


def deck_zonder(card_id, rng):
    return (
        rng.sample([c for c in BY_TYPE["Project"] if c != card_id], 5)
        + rng.sample([c for c in BY_TYPE["Support"] if c != card_id], 5)
        + rng.sample([c for c in BY_TYPE["Founder"] if c != card_id], 1)
    )


# Regels die niet als "de kaart deed iets" tellen.
LINEUP = re.compile(r"^\s*•")
BASIS = re.compile(r"starts with base MC|💰")
SKIP = re.compile(r"⛔|could not act|skipped|no valid targets|held back")


def onderzoek(args):
    card_id, runs = args
    from match_simulator import simulate_match_with_decks

    rng = random.Random(zlib.crc32(card_id.encode()))
    vuurt = skipt = 0
    fouten = []
    voorbeeld = None

    for i in range(runs):
        eigen = deck_met(card_id, rng)
        ander = deck_zonder(card_id, rng)
        # Afwisselend als speler 1 en speler 2.
        d1, d2 = (eigen, ander) if i % 2 == 0 else (ander, eigen)
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                logs, _, _ = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=1000 + i)
        except Exception as e:
            fouten.append(f"{type(e).__name__}: {e}")
            continue

        for regel in "\n".join(logs).split("\n"):
            if card_id not in regel:
                continue
            if LINEUP.search(regel) or BASIS.search(regel):
                continue
            if SKIP.search(regel):
                skipt += 1
                continue
            vuurt += 1
            if voorbeeld is None:
                voorbeeld = regel.replace("**", "").strip()[:100]

    return card_id, vuurt, skipt, fouten, voorbeeld


def main():
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    taken = [(c["card_id"], runs) for c in CARDS]

    with mp.Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        resultaten = pool.map(onderzoek, taken, chunksize=4)

    stil, alleen_skip, crasht, werkt = [], [], [], []
    for card_id, vuurt, skipt, fouten, voorbeeld in resultaten:
        if fouten:
            crasht.append((card_id, fouten[0]))
        if vuurt == 0 and skipt == 0:
            stil.append(card_id)
        elif vuurt == 0:
            alleen_skip.append((card_id, skipt))
        else:
            werkt.append((card_id, vuurt, voorbeeld))

    print(f"=== {len(CARDS)} kaarten, elk {runs} matches ({len(CARDS)*runs} matches totaal) ===\n")
    print(f"  vuurt aantoonbaar af : {len(werkt)}")
    print(f"  alleen overgeslagen  : {len(alleen_skip)}")
    print(f"  volledig stil        : {len(stil)}")
    print(f"  veroorzaakt een crash: {len(crasht)}")

    if crasht:
        print("\n--- CRASHES ---")
        for cid, fout in crasht[:15]:
            print(f"  {cid:<32} {fout[:80]}")

    if stil:
        print("\n--- VOLLEDIG STIL (komt buiten de opstelling nooit voor) ---")
        for cid in sorted(stil):
            c = BY_ID[cid]
            eff = [(e.get("phase"), e.get("action_type")) for e in (c.get("parsed_power") or [])]
            print(f"  {cid:<32} {c['card_type']:<8} {eff}")

    if alleen_skip:
        print("\n--- WEL OVERWOGEN, NOOIT AFGEVUURD (voorwaarde nooit gehaald) ---")
        for cid, n in sorted(alleen_skip, key=lambda x: -x[1])[:25]:
            c = BY_ID[cid]
            eff = [(e.get("condition_type"), e.get("action_type")) for e in (c.get("parsed_power") or [])]
            print(f"  {cid:<32} {n:>4}x overgeslagen  {eff}")


if __name__ == "__main__":
    main()
