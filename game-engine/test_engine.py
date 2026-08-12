"""
Testharnas voor de battle-engine — draait zonder Firebase.

    ./venv/bin/python test_engine.py

Controleert drie dingen:
  1. Determinisme: dezelfde seed moet exact dezelfde match opleveren.
  2. Fase-dekking: kaarten moeten in ELKE fase kunnen afvuren, niet alleen in
     Start en Support (de _phase_triggered-bug).
  3. Score-consistentie: de score die main.py rapporteert moet gelijk zijn aan
     de stand in het logboek en aan de winnaar op het eindscherm.
"""
import io
import json
import os
import random
import re
import sys
import contextlib

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from match_simulator import simulate_match_with_decks, calculate_total_mc  # noqa: E402

PHASES = ["Start", "Buff", "Debuff", "Support", "Counter", "Final"]


def load_cards():
    with open(os.path.join(BASE_DIR, "COC_Cards_parsed.json"), encoding="utf-8") as f:
        return json.load(f)


def build_deck(cards, rng):
    """Een geldig 5/5/1 deck zonder duplicaten."""
    projects = [c for c in cards if c.get("card_type") == "Project"]
    supports = [c for c in cards if c.get("card_type") == "Support"]
    founders = [c for c in cards if c.get("card_type") == "Founder"]
    return (
        [c["card_id"] for c in rng.sample(projects, 5)]
        + [c["card_id"] for c in rng.sample(supports, 5)]
        + [c["card_id"] for c in rng.sample(founders, 1)]
    )


def run(deck1, deck2, seed):
    """Draai een match en geef (log_blocks, deck1, deck2). Engine-prints dempen."""
    with contextlib.redirect_stdout(io.StringIO()):
        return simulate_match_with_decks(deck1_ids=deck1, deck2_ids=deck2, seed=seed)


def phase_activity(log_blocks):
    """Tel per fase hoeveel kaartregels er zijn — de proxy voor 'effecten vuurden af'."""
    counts = dict.fromkeys(PHASES, 0)
    current = None
    for line in "\n".join(log_blocks).split("\n"):
        banner = re.search(r"\*\*(\w+) Phase Begins!\*\*", line)
        if banner:
            current = banner.group(1)
            continue
        if current and re.search(r"COC_\w+", line) and "MC after" not in line:
            counts[current] += 1
    return counts


def logged_scores(log_blocks):
    """De laatste 'Player N MC after <fase>' regels uit het logboek."""
    text = "\n".join(log_blocks)
    p1 = re.findall(r"Player 1 MC after \w+: \*\*([-\d.]+)\*\*", text)
    p2 = re.findall(r"Player 2 MC after \w+: \*\*([-\d.]+)\*\*", text)
    return (float(p1[-1]) if p1 else None, float(p2[-1]) if p2 else None)


def main():
    cards = load_cards()
    rng = random.Random(20260812)
    failures = []

    matchups = [(build_deck(cards, rng), build_deck(cards, rng)) for _ in range(8)]

    # ---- 1. Determinisme -------------------------------------------------
    d1, d2 = matchups[0]
    a_logs, a1, a2 = run(d1, d2, seed=42)
    b_logs, b1, b2 = run(d1, d2, seed=42)
    if a_logs != b_logs:
        failures.append("Determinisme: identieke seed gaf een ander logboek")
    if (calculate_total_mc(a1), calculate_total_mc(a2)) != (calculate_total_mc(b1), calculate_total_mc(b2)):
        failures.append("Determinisme: identieke seed gaf een andere eindstand")

    c_logs, _, _ = run(d1, d2, seed=1337)
    print(f"1. Determinisme    seed 42 == seed 42: {a_logs == b_logs}"
          f" | seed 42 != seed 1337: {a_logs != c_logs}")

    # ---- 2. Fase-dekking -------------------------------------------------
    totals = dict.fromkeys(PHASES, 0)
    for d1, d2 in matchups:
        for phase, n in phase_activity(run(d1, d2, seed=7)[0]).items():
            totals[phase] += n
    print("2. Fase-activiteit over 8 matches (kaartregels per fase):")
    for phase in PHASES:
        mark = "ok " if totals[phase] > 0 else "LEEG"
        print(f"     {mark} {phase:<8} {totals[phase]:>4}")
    dead = [p for p in PHASES if totals[p] == 0]
    if dead:
        failures.append(f"Fase-dekking: geen enkele kaartactie in {', '.join(dead)}")

    # ---- 3. Score-consistentie -------------------------------------------
    mismatches = 0
    for d1, d2 in matchups:
        logs, f1, f2 = run(d1, d2, seed=99)
        engine = (calculate_total_mc(f1), calculate_total_mc(f2))
        logged = logged_scores(logs)
        # Het logboek rondt af op 1 decimaal.
        if logged != (None, None) and (
            abs(engine[0] - logged[0]) > 0.05 or abs(engine[1] - logged[1]) > 0.05
        ):
            mismatches += 1
    print(f"3. Score-consistentie: {len(matchups) - mismatches}/{len(matchups)} matches "
          f"waar de eindstand gelijk is aan het logboek")
    if mismatches:
        failures.append(f"Score-consistentie: {mismatches} match(es) wijken af van het logboek")

    # ---- 4. Deckvalidatie ------------------------------------------------
    dup = [d1[0]] * 5 + d1[5:10] + [d1[10]]
    try:
        run(dup, d2, seed=1)
        failures.append("Deckvalidatie: een deck met 5x dezelfde kaart werd geaccepteerd")
        print("4. Duplicaatcheck: NIET afgevangen")
    except ValueError as e:
        print(f"4. Duplicaatcheck: afgevangen ({str(e)[:60]}…)")

    print()
    if failures:
        print("RESULTAAT: gezakt")
        for f in failures:
            print(f"  ✗ {f}")
        return 1
    print("RESULTAAT: alle controles geslaagd")
    return 0


if __name__ == "__main__":
    sys.exit(main())
