"""
Meet of de plek aan tafel uitmaakt.

    ./venv/bin/python audit_position.py [aantal_deckparen]

Elk deckpaar wordt twee keer gespeeld met dezelfde seed: één keer met deck A als
speler 1 en één keer als speler 2. Is de engine positie-neutraal, dan scoort A
gemiddeld even goed op beide plekken.
"""
import contextlib
import io
import json
import multiprocessing as mp
import os
import random
import statistics
import sys
import zlib

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

CARDS = json.load(open("COC_Cards_parsed.json", encoding="utf-8"))
BT = {t: [c["card_id"] for c in CARDS if c["card_type"] == t] for t in ("Project", "Support", "Founder")}


def deck(rng):
    return rng.sample(BT["Project"], 5) + rng.sample(BT["Support"], 5) + rng.sample(BT["Founder"], 1)


def run(d1, d2, seed):
    from match_simulator import simulate_match_with_decks, calculate_total_mc
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        _, a, b = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=seed)
    return calculate_total_mc(a), calculate_total_mc(b)


def taak(args):
    dA, dB, seed = args
    a1, b1 = run(dA, dB, seed)   # A op positie 1
    b2, a2 = run(dB, dA, seed)   # A op positie 2
    return a1, a2


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1500
    rng = random.Random(zlib.crc32(b"positie"))
    taken = [(deck(rng), deck(rng), i) for i in range(n)]

    with mp.Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        res = pool.map(taak, taken, chunksize=25)

    gelijk = sum(1 for a1, a2 in res if abs(a1 - a2) < 0.01)
    beter1 = sum(1 for a1, a2 in res if a1 > a2 + 0.01)
    beter2 = sum(1 for a1, a2 in res if a2 > a1 + 0.01)
    verschil = [a2 - a1 for a1, a2 in res]

    print(f"{n} deckparen, elk twee keer gespeeld met dezelfde seed\n")
    print(f"  zelfde score ongeacht positie   : {gelijk}  ({100*gelijk/n:.1f}%)")
    print(f"  deck A beter als speler 1        : {beter1}")
    print(f"  deck A beter als speler 2        : {beter2}")
    print(f"  gemiddeld verschil (pos2 - pos1) : {statistics.mean(verschil):+.2f} MC")

    beslist = beter1 + beter2
    if beslist:
        aandeel = beter2 / beslist
        afwijking = abs(aandeel - 0.5) * 100
        print(f"\n  positie 2 wint {100*aandeel:.1f}% van de beslissende paren "
              f"({afwijking:.1f} procentpunt van 50/50)", end="")
        print("  -> SCHEEF" if afwijking > 5 else "  -> ok")


if __name__ == "__main__":
    main()
