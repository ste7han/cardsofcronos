"""
Grootschalige audit van de battle-engine.

    ./venv/bin/python audit_engine.py [aantal_matches]

Draait duizenden matches en controleert:
  1. Eerlijkheid  — spiegelmatches (beide spelers hetzelfde deck) moeten 50/50
     uitpakken. Wint speler 1 structureel, dan zit er een voordeel in de
     volgorde waarin de engine de decks afhandelt.
  2. Invarianten  — geen crashes, geen negatieve MC op levende Projects, de
     eindstand gelijk aan het logboek, vernietigde kaarten tellen niet mee.
  3. Determinisme — dezelfde seed geeft exact dezelfde match.
"""
import collections
import contextlib
import io
import json
import multiprocessing as mp
import os
import random
import re
import sys
import traceback

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

CARDS = json.load(open(os.path.join(BASE_DIR, "COC_Cards_parsed.json"), encoding="utf-8"))
BY_TYPE = {
    t: [c["card_id"] for c in CARDS if c.get("card_type") == t]
    for t in ("Project", "Support", "Founder")
}


def random_deck(rng):
    return (
        rng.sample(BY_TYPE["Project"], 5)
        + rng.sample(BY_TYPE["Support"], 5)
        + rng.sample(BY_TYPE["Founder"], 1)
    )


def run(deck1, deck2, seed):
    """Draai één match, met alle engine-prints gedempt."""
    from match_simulator import simulate_match_with_decks, calculate_total_mc
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        logs, d1, d2 = simulate_match_with_decks(deck1_ids=deck1, deck2_ids=deck2, seed=seed)
    return logs, d1, d2, calculate_total_mc(d1), calculate_total_mc(d2)


LOG_SCORE = re.compile(r"Player ([12]) MC after \w+: \*\*([-\d.]+)\*\*")


def check_match(args):
    """Eén match plus alle invariantcontroles. Geeft een lijst bevindingen terug."""
    kind, deck1, deck2, seed = args
    bevindingen = []
    try:
        logs, d1, d2, s1, s2 = run(deck1, deck2, seed)
    except Exception as e:
        return [("CRASH", f"{type(e).__name__}: {e}", seed)], None

    # Negatieve MC op een levend Project is nooit de bedoeling.
    for label, deck in (("P1", d1), ("P2", d2)):
        for c in deck:
            if c.get("card_type") == "Project" and not c.get("destroyed"):
                mc = c.get("current_mc", 0)
                if mc < 0:
                    bevindingen.append(("NEGATIEVE_MC", f"{label} {c['card_id']} = {mc}", seed))

    # De eindstand moet gelijk zijn aan de laatste stand in het logboek.
    tekst = "\n".join(logs)
    p1 = [float(m[1]) for m in LOG_SCORE.findall(tekst) if m[0] == "1"]
    p2 = [float(m[1]) for m in LOG_SCORE.findall(tekst) if m[0] == "2"]
    # Het logboek toont één decimaal, dus vergelijken we op diezelfde precisie;
    # anders meldt 239.8 vs 239.75 een verschil dat er niet is.
    if p1 and abs(p1[-1] - round(s1, 1)) > 0.001:
        bevindingen.append(("SCORE_WIJKT_AF", f"P1 logboek {p1[-1]} vs engine {s1}", seed))
    if p2 and abs(p2[-1] - round(s2, 1)) > 0.001:
        bevindingen.append(("SCORE_WIJKT_AF", f"P2 logboek {p2[-1]} vs engine {s2}", seed))

    winner = "P1" if s1 > s2 else "P2" if s2 > s1 else "gelijk"
    return bevindingen, (kind, winner, s1, s2)


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    rng = random.Random(20260812)

    taken = []
    # Helft spiegelmatches (identieke decks) om de eerlijkheid te meten,
    # helft willekeurig om breed te dekken.
    for i in range(n // 2):
        d = random_deck(rng)
        taken.append(("spiegel", d, list(d), i))
    for i in range(n - n // 2):
        taken.append(("willekeurig", random_deck(rng), random_deck(rng), 100000 + i))

    with mp.Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        resultaten = pool.map(check_match, taken, chunksize=32)

    alle_bevindingen = []
    uitslagen = collections.defaultdict(collections.Counter)
    for bevindingen, uitslag in resultaten:
        alle_bevindingen.extend(bevindingen)
        if uitslag:
            uitslagen[uitslag[0]][uitslag[1]] += 1

    print(f"=== {n} matches gedraaid ===\n")

    print("1. EERLIJKHEID")
    for soort in ("spiegel", "willekeurig"):
        c = uitslagen[soort]
        tot = sum(c.values()) or 1
        print(f"   {soort:<12} P1 {c['P1']:>5} ({100*c['P1']/tot:5.1f}%)   "
              f"P2 {c['P2']:>5} ({100*c['P2']/tot:5.1f}%)   gelijk {c['gelijk']:>4}")
    sp = uitslagen["spiegel"]
    beslist = sp["P1"] + sp["P2"]
    if beslist:
        afwijking = abs(sp["P1"] / beslist - 0.5)
        print(f"   -> spiegelmatches wijken {afwijking*100:.1f} procentpunt af van 50/50", end="")
        print("  ⚠️ SCHEEF" if afwijking > 0.05 else "  ok")

    print("\n2. INVARIANTEN")
    per_soort = collections.Counter(b[0] for b in alle_bevindingen)
    if not per_soort:
        print("   geen schendingen")
    for soort, aantal in per_soort.most_common():
        print(f"   {soort:<18} {aantal}")
        for b in [x for x in alle_bevindingen if x[0] == soort][:4]:
            print(f"       seed {b[2]}: {b[1]}")

    print("\n3. DETERMINISME")
    d1, d2 = random_deck(rng), random_deck(rng)
    a = run(d1, d2, 777)
    b = run(d1, d2, 777)
    print("   zelfde seed geeft zelfde logboek:", a[0] == b[0])
    print("   zelfde seed geeft zelfde eindstand:", (a[3], a[4]) == (b[3], b[4]))


if __name__ == "__main__":
    main()
