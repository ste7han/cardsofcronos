"""
Vangnet voor de refactor van de schade-afhandeling.

    ./venv/bin/python snapshot.py maak   vooraf.json
    ./venv/bin/python snapshot.py check  vooraf.json

Legt de uitslag van een paar duizend matches vast en vergelijkt die later
opnieuw. Een refactor die alleen de schild-paden raakt hoort elke match zonder
schildkaarten exact gelijk te laten.
"""
import contextlib
import io
import json
import multiprocessing as mp
import os
import random
import sys
import zlib

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

CARDS = json.load(open("COC_Cards_parsed.json", encoding="utf-8"))
BY_TYPE = {t: [c["card_id"] for c in CARDS if c["card_type"] == t]
           for t in ("Project", "Support", "Founder")}

# Kaarten waarvan het gedrag juist wél mag veranderen door de lopende wijziging:
# passieve schilden, plus alles wat afhangt van "heeft een kaart MC verloren" —
# dat wordt nu op elk pad bijgehouden in plaats van alleen in track_mc_change.
_ACTIES = ("limit_loss", "reduce_debuff_percentage", "reflect", "reflect_and_amplify",
           "prevent_destruction", "override_mc_value", "redirect", "negate")
_VOORWAARDEN = ("own_project_lost_mc", "own_project_loses_mc", "lost_mc_due_to_effect",
                "cards_lost_mc", "own_projects_lost_mc", "any_project_takes_damage",
                "hit_by_debuff", "loses_mc_from_effect", "causes_mc_loss", "self_debuffed",
                "own_mc_loss_count", "own_debuffed_count", "tag_on_field", "has_card_type",
                "count_tag", "first_debuff_hit",
                "any_card_mc_lt", "enemy_project_destroyed_once", "final_calc",
                "more_projects_than_opponent", "on_project_destroyed", "project_count",
                "survived_destruction_count", "targeted_by_debuff")
SCHILDEN = {c["card_id"] for c in CARDS
            for e in (c.get("parsed_power") or [])
            if str(e.get("action_type") or "") in _ACTIES
            or str(e.get("condition_type") or "") in _VOORWAARDEN}


def deck(rng):
    return (rng.sample(BY_TYPE["Project"], 5)
            + rng.sample(BY_TYPE["Support"], 5)
            + rng.sample(BY_TYPE["Founder"], 1))


def taak(args):
    d1, d2, seed = args
    from match_simulator import simulate_match_with_decks, calculate_total_mc
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            _, a, b = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=seed)
        return [seed, round(calculate_total_mc(a), 3), round(calculate_total_mc(b), 3)]
    except Exception as e:
        return [seed, "crash", str(e)[:60]]


def maak_taken(n):
    rng = random.Random(zlib.crc32(b"snapshot"))
    return [(deck(rng), deck(rng), i) for i in range(n)]


def main():
    modus = sys.argv[1] if len(sys.argv) > 1 else "maak"
    pad = sys.argv[2] if len(sys.argv) > 2 else "snapshot.json"
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 2000

    taken = maak_taken(n)
    with mp.Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        uitslagen = pool.map(taak, taken, chunksize=32)

    if modus == "maak":
        json.dump({"taken": [[d1, d2, s] for d1, d2, s in taken], "uitslagen": uitslagen},
                  open(pad, "w"))
        print(f"{n} matches vastgelegd in {pad}")
        return 0

    vooraf = json.load(open(pad))
    oud = {u[0]: u for u in vooraf["uitslagen"]}
    met_schild = gelijk = anders_met_schild = anders_zonder = 0
    voorbeelden = []
    for (d1, d2, seed), nieuw in zip(taken, uitslagen):
        heeft_schild = bool((set(d1) | set(d2)) & SCHILDEN)
        met_schild += 1 if heeft_schild else 0
        if oud.get(seed) == nieuw:
            gelijk += 1
        elif heeft_schild:
            anders_met_schild += 1
        else:
            anders_zonder += 1
            if len(voorbeelden) < 5:
                voorbeelden.append(f"seed {seed}: was {oud.get(seed)[1:]} nu {nieuw[1:]}")

    print(f"{n} matches vergeleken\n")
    print(f"  identiek                          : {gelijk}")
    print(f"  anders, mét een schildkaart       : {anders_met_schild}   (verwacht)")
    print(f"  anders, ZONDER schildkaart        : {anders_zonder}   {'<-- REGRESSIE' if anders_zonder else '(goed)'}")
    print(f"\n  ter info: {met_schild} van de {n} matches bevat een schildkaart")
    for v in voorbeelden:
        print("   ", v)
    return 1 if anders_zonder else 0


if __name__ == "__main__":
    sys.exit(main())
