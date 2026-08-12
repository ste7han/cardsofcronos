"""
Tweede ronde voor de kaarten die in willekeurige decks niets deden.

Veel voorwaarden gaan over synergie ("3 kaarten met de Lunar-tag", "2 Common
Nova-kaarten", "een Community-kaart op het veld"). In een willekeurig deck komt
dat zelden voor. Hier bouwen we per kaart juist een deck van dezelfde factie,
zoals een speler die de kaart wil laten werken het zou doen, plus een variant
met veel vernietiging in het vijandelijke deck voor de "als er kaarten
vernietigd zijn"-voorwaarden.

Vuurt een kaart dan nog steeds nooit, dan is hij kapot en niet zeldzaam.
"""
import os
import zlib
import contextlib, io, json, multiprocessing as mp, os, random, re, sys

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

CARDS = json.load(open("COC_Cards_parsed.json", encoding="utf-8"))
BY_ID = {c["card_id"]: c for c in CARDS}


def factie(cid):
    return cid.replace("COC_", "").split("_")[0]


def van_type(t, pool=None):
    bron = pool if pool is not None else CARDS
    return [c["card_id"] for c in bron if c["card_type"] == t]


# Kaarten die veel kapotmaken, voor de "destroyed"-voorwaarden.
SLOPERS = [c["card_id"] for c in CARDS
           if "destroy" in json.dumps(c.get("parsed_power") or []).lower()
           and c["card_type"] in ("Support", "Project")]


def bouw_deck(cid, rng, synergie=True):
    """Deck rond de kaart: zoveel mogelijk uit dezelfde factie."""
    f = factie(cid)
    familie = [c for c in CARDS if factie(c["card_id"]) == f and c["card_id"] != cid]
    rest = [c for c in CARDS if factie(c["card_id"]) != f]
    deck = [cid]
    for t, n in (("Project", 5), ("Support", 5), ("Founder", 1)):
        hebben = sum(1 for x in deck if BY_ID[x]["card_type"] == t)
        nodig = n - hebben
        if nodig <= 0:
            continue
        voorkeur = [x for x in van_type(t, familie) if x not in deck]
        rng.shuffle(voorkeur)
        gekozen = voorkeur[:nodig]
        if len(gekozen) < nodig:
            aanvulling = [x for x in van_type(t, rest) if x not in deck and x not in gekozen]
            gekozen += rng.sample(aanvulling, nodig - len(gekozen))
        deck += gekozen
    return deck


def vijand_deck(cid, rng, slopers=False):
    verboden = {cid}
    if slopers:
        p = [x for x in SLOPERS if BY_ID[x]["card_type"] == "Project" and x not in verboden]
        s = [x for x in SLOPERS if BY_ID[x]["card_type"] == "Support" and x not in verboden]
        rng.shuffle(p); rng.shuffle(s)
        proj = (p + [x for x in van_type("Project") if x not in p and x not in verboden])[:5]
        sup = (s + [x for x in van_type("Support") if x not in s and x not in verboden])[:5]
    else:
        proj = rng.sample([x for x in van_type("Project") if x not in verboden], 5)
        sup = rng.sample([x for x in van_type("Support") if x not in verboden], 5)
    fnd = rng.sample([x for x in van_type("Founder") if x not in verboden], 1)
    return proj + sup + fnd


def onderzoek(args):
    cid, runs = args
    import match_simulator as ms
    from match_simulator import simulate_match_with_decks, calculate_total_mc

    orig = next((c.get("parsed_power") for c in ms.ALL_CARDS if c.get("card_id") == cid), None)
    if orig is None:
        return cid, 0

    rng = random.Random(zlib.crc32(cid.encode()))
    verschil = 0
    for i in range(runs):
        eigen = bouw_deck(cid, rng)
        ander = vijand_deck(cid, rng, slopers=(i % 2 == 1))
        d1, d2 = (eigen, ander) if i % 3 else (ander, eigen)
        uit = []
        for power in (orig, []):
            for c in ms.ALL_CARDS:
                if c.get("card_id") == cid:
                    c["parsed_power"] = power
                    break
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    _, a, b = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=31000 + i)
                uit.append((round(calculate_total_mc(a), 2), round(calculate_total_mc(b), 2)))
            except Exception as e:
                uit.append(("crash", str(e)[:30]))
        for c in ms.ALL_CARDS:
            if c.get("card_id") == cid:
                c["parsed_power"] = orig
                break
        if uit[0] != uit[1]:
            verschil += 1
    return cid, verschil


if __name__ == "__main__":
    dode = [l.split("`")[1] for l in open(sys.argv[1], encoding="utf-8") if l.startswith("- `")]
    runs = 24
    with mp.Pool(7) as pool:
        res = pool.map(onderzoek, [(cid, runs) for cid in dode], chunksize=3)

    herleeft = [(c, n) for c, n in res if n > 0]
    blijft_dood = [c for c, n in res if n == 0]

    print(f"# Tweede ronde: {len(dode)} dode kaarten in een deck van eigen factie")
    print(f"# {len(dode)} x {runs} decks x 2 = {len(dode)*runs*2} matches\n")
    print(f"  werkt alsnog met de juiste steun : {len(herleeft)}   -> was zeldzaam, niet kapot")
    print(f"  blijft ook dan volledig dood     : {len(blijft_dood)}   -> KAPOT\n")

    print("## Kaarten die ook met een deck op maat niets doen\n")
    for cid in sorted(blijft_dood):
        c = BY_ID[cid]
        eff = (c.get("parsed_power") or [{}])[0]
        desc = (c.get("description") or "").splitlines()
        print(f"- `{cid}` ({c['card_type']}/{c.get('rarity')}) cond=`{eff.get('condition_type')}` "
              f"act=`{eff.get('action_type')}`\n    \"{(desc[0] if desc else '')[:88]}\"")
