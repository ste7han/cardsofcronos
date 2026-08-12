"""Controleert gericht of de kaarten met een eerder ontbrekende voorwaarde nu werken.

    ./venv/bin/python check_fixed.py
"""
import zlib
import contextlib, io, json, multiprocessing as mp, os, random, sys

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

CARDS = json.load(open("COC_Cards_parsed.json", encoding="utf-8"))
BY = {c["card_id"]: c for c in CARDS}
BT = {t: [c["card_id"] for c in CARDS if c["card_type"] == t] for t in ("Project", "Support", "Founder")}

DOEL = """COC_Lionel_Founder_E1 COC_Clove_Founder_E1 COC_Clove_M1 COC_Lionel_C3
COC_CF_Founder_R1 COC_CF_Founder_M1 COC_DAK_Founder_E1""".split()


def factie(cid):
    return cid.replace("COC_", "").split("_")[0]


def deck_rond(cid, rng):
    f = factie(cid)
    fam = [c for c in CARDS if factie(c["card_id"]) == f and c["card_id"] != cid]
    rest = [c for c in CARDS if factie(c["card_id"]) != f]
    deck = [cid]
    for t, n in (("Project", 5), ("Support", 5), ("Founder", 1)):
        heb = sum(1 for x in deck if BY[x]["card_type"] == t)
        nodig = n - heb
        if nodig <= 0:
            continue
        voork = [c["card_id"] for c in fam if c["card_type"] == t and c["card_id"] not in deck]
        rng.shuffle(voork)
        kies = voork[:nodig]
        if len(kies) < nodig:
            aanv = [c["card_id"] for c in rest if c["card_type"] == t and c["card_id"] not in deck + kies]
            kies += rng.sample(aanv, nodig - len(kies))
        deck += kies
    return deck


def taak(cid):
    import match_simulator as ms
    from match_simulator import simulate_match_with_decks, calculate_total_mc

    orig = next((c.get("parsed_power") for c in ms.ALL_CARDS if c.get("card_id") == cid), None)
    rng = random.Random(zlib.crc32(cid.encode()))
    verschil, runs = 0, 30
    for i in range(runs):
        eigen = deck_rond(cid, rng)
        ander = (rng.sample([x for x in BT["Project"] if x != cid], 5)
                 + rng.sample([x for x in BT["Support"] if x != cid], 5)
                 + rng.sample([x for x in BT["Founder"] if x != cid], 1))
        d1, d2 = (eigen, ander) if i % 2 == 0 else (ander, eigen)
        uit = []
        for power in (orig, []):
            for c in ms.ALL_CARDS:
                if c.get("card_id") == cid:
                    c["parsed_power"] = power
                    break
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    _, a, b = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=77000 + i)
                uit.append((round(calculate_total_mc(a), 2), round(calculate_total_mc(b), 2)))
            except Exception as e:
                uit.append(("crash", str(e)[:30]))
        for c in ms.ALL_CARDS:
            if c.get("card_id") == cid:
                c["parsed_power"] = orig
                break
        if uit[0] != uit[1]:
            verschil += 1
    return cid, verschil, runs


if __name__ == "__main__":
    with mp.Pool(7) as pool:
        res = pool.map(taak, DOEL)
    leeft = [(c, n, r) for c, n, r in res if n > 0]
    dood = [(c, n, r) for c, n, r in res if n == 0]
    print(f"{len(DOEL)} kaarten met een eerder ontbrekende voorwaarde, elk 30 decks van eigen factie\n")
    print(f"  werkt nu     : {len(leeft)}")
    print(f"  nog steeds 0 : {len(dood)}\n")
    for c, n, r in sorted(leeft, key=lambda x: -x[1]):
        print(f"   OK  {c:<30} {n}/{r} matches beinvloed")
    print()
    for c, n, r in dood:
        eff = (BY[c].get("parsed_power") or [{}])[0]
        print(f"   --  {c:<30} nog geen effect   cond={eff.get('condition_type')} act={eff.get('action_type')}")
