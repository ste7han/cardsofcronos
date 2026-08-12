"""
A/B-test per kaart: doet het effect uberhaupt iets?

Voor elke kaart draaien we dezelfde match twee keer met dezelfde seed — een keer
met het effect intact, een keer met parsed_power leeggemaakt. Verandert de
eindstand nooit, over meerdere verschillende decks, dan heeft de kaart
aantoonbaar geen enkel gevolg voor de uitslag.

Dit is onafhankelijk van hoe de engine logt, dus geen last van kaarten die onder
een mooiere naam in het logboek staan.
"""
import os
import contextlib, io, json, multiprocessing as mp, os, random, sys

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

CARDS = json.load(open("COC_Cards_parsed.json", encoding="utf-8"))
BY_ID = {c["card_id"]: c for c in CARDS}
BY_TYPE = {t: [c["card_id"] for c in CARDS if c["card_type"] == t] for t in ("Project", "Support", "Founder")}
NEEDED = {"Project": 5, "Support": 5, "Founder": 1}


def decks_voor(cid, rng):
    soort = BY_ID[cid]["card_type"]
    eigen = [cid]
    for t, n in NEEDED.items():
        pool = [c for c in BY_TYPE[t] if c != cid]
        eigen += rng.sample(pool, n - (1 if t == soort else 0))
    ander = (rng.sample([c for c in BY_TYPE["Project"] if c != cid], 5)
             + rng.sample([c for c in BY_TYPE["Support"] if c != cid], 5)
             + rng.sample([c for c in BY_TYPE["Founder"] if c != cid], 1))
    return eigen, ander


def onderzoek(args):
    cid, runs = args
    import match_simulator as ms
    from match_simulator import simulate_match_with_decks, calculate_total_mc

    origineel = None
    for c in ms.ALL_CARDS:
        if c.get("card_id") == cid:
            origineel = c.get("parsed_power")
            break
    if origineel is None:
        return cid, 0, runs, "kaart niet in ALL_CARDS"

    rng = random.Random(hash(cid) & 0xFFFF)
    verschil = gelijk = 0

    for i in range(runs):
        eigen, ander = decks_voor(cid, rng)
        d1, d2 = (eigen, ander) if i % 2 == 0 else (ander, eigen)
        seed = 9000 + i
        uitkomsten = []
        for power in (origineel, []):
            for c in ms.ALL_CARDS:
                if c.get("card_id") == cid:
                    c["parsed_power"] = power
                    break
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    _, a, b = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=seed)
                uitkomsten.append((round(calculate_total_mc(a), 2), round(calculate_total_mc(b), 2)))
            except Exception as e:
                uitkomsten.append(("crash", str(e)[:40]))
        # herstel
        for c in ms.ALL_CARDS:
            if c.get("card_id") == cid:
                c["parsed_power"] = origineel
                break
        if uitkomsten[0] == uitkomsten[1]:
            gelijk += 1
        else:
            verschil += 1

    return cid, verschil, gelijk, None


if __name__ == "__main__":
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 12
    with mp.Pool(7) as pool:
        res = pool.map(onderzoek, [(c["card_id"], runs) for c in CARDS], chunksize=4)

    inert, zwak, werkt = [], [], []
    for cid, verschil, gelijk, fout in res:
        if fout:
            continue
        if verschil == 0:
            inert.append(cid)
        elif verschil <= max(1, runs // 6):
            zwak.append((cid, verschil))
        else:
            werkt.append(cid)

    print(f"=== {len(CARDS)} kaarten, elk {runs} decks, elk 2x gespeeld = {len(CARDS)*runs*2} matches ===\n")
    print(f"  verandert de uitslag                  : {len(werkt)}")
    print(f"  verandert zelden ({runs}x getest)       : {len(zwak)}")
    print(f"  verandert NOOIT iets (aantoonbaar dood): {len(inert)}\n")

    print("--- KAARTEN DIE AANTOONBAAR NIETS DOEN ---")
    for cid in sorted(inert):
        c = BY_ID[cid]
        eff = [(e.get("phase"), e.get("condition_type"), e.get("action_type")) for e in (c.get("parsed_power") or [])]
        print(f"  {cid:<32} {c['card_type']:<8} {c.get('rarity',''):<10} {eff}")
        print(f"      \"{(c.get('description') or '')[:105]}\"")

    if zwak:
        print("\n--- ZELDEN EFFECT (mogelijk zeer strikte voorwaarde) ---")
        for cid, n in sorted(zwak, key=lambda x: x[1]):
            c = BY_ID[cid]
            print(f"  {cid:<32} {n}/{runs}   {(c.get('description') or '')[:70]}")
