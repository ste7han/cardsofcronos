"""
Wat gebeurt er als je een drempel anders zet?

    ./venv/bin/python audit_drempels.py [matches] > DREMPELS.md

Twee metingen:

  1. Hoe de onderliggende grootheden in een match verdeeld zijn — hoe vaak
     worden er 1, 2, 3 Projects vernietigd, hoeveel rarities bestuur je, hoe
     vaak eindigt je totale MC op 7. Zonder die verdeling is elke drempel een
     slag in de lucht.
  2. Per kaart: hoe vaak de voorwaarde zou slagen bij verschillende waarden.
     De kaartdata wordt daarvoor tijdelijk aangepast en daarna hersteld.
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
import zlib

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

CARDS = json.load(open("COC_Cards_parsed.json", encoding="utf-8"))
BY_ID = {c["card_id"]: c for c in CARDS}
BY_TYPE = {t: [c["card_id"] for c in CARDS if c["card_type"] == t]
           for t in ("Project", "Support", "Founder")}
NEEDED = (("Project", 5), ("Support", 5), ("Founder", 1))

# Welke waarden zijn het proberen waard, per kaart.
KANDIDATEN = {
    "COC_Wolfswap_Founder_M1": ("≥4", ["≥1", "≥2", "≥3", "≥4"]),
    "COC_Wolfswap_Founder_E1": ("≥2", ["≥1", "≥2"]),
    "COC_Cr00ts_Founder_M1":   (">=3", [">=1", ">=2", ">=3"]),
    "COC_DAK_Founder_M1":      (">=3", [">=1", ">=2", ">=3"]),
    "COC_Cr00ts_Founder_L1":   (">=2", [">=1", ">=2"]),
    "COC_EVT_Chain_Reaction":  ("cards_destroyed >= 3",
                                ["cards_destroyed >= 1", "cards_destroyed >= 2", "cards_destroyed >= 3"]),
    "COC_CAW777_Founder_M1":   (">=3", [">=1", ">=2", ">=3"]),
    "COC_Nova_Founder_R1":     ("10", ["10", "15", "20"]),
    "COC_Nova_Founder_C1":     ("common_nova_>=2", ["common_nova_>=1", "common_nova_>=2"]),
}

GESLAAGD = re.compile(r"triggered|→|boosts|reduces|steals|destroy|gains|loses|swap|reflect|"
                      r"protected|cannot lose|negates|redirect|counts as", re.I)
OVERGESLAGEN = re.compile(r"⛔|could not act|skipped|no valid targets|held back")
OPSTELLING = re.compile(r"^\s*•|starts with base MC|💰")


def factie(cid):
    return cid.replace("COC_", "").split("_")[0]


def deck_op_maat(cid, rng):
    f = factie(cid)
    familie = [c for c in CARDS if factie(c["card_id"]) == f and c["card_id"] != cid]
    rest = [c for c in CARDS if factie(c["card_id"]) != f]
    deck = [cid]
    for t, n in NEEDED:
        heb = sum(1 for x in deck if BY_ID[x]["card_type"] == t)
        if n - heb <= 0:
            continue
        voorkeur = [c["card_id"] for c in familie if c["card_type"] == t and c["card_id"] not in deck]
        rng.shuffle(voorkeur)
        kies = voorkeur[:n - heb]
        if len(kies) < n - heb:
            aanvul = [c["card_id"] for c in rest if c["card_type"] == t and c["card_id"] not in deck + kies]
            kies += rng.sample(aanvul, n - heb - len(kies))
        deck += kies
    return deck


def willekeurig_deck(rng):
    return (rng.sample(BY_TYPE["Project"], 5) + rng.sample(BY_TYPE["Support"], 5)
            + rng.sample(BY_TYPE["Founder"], 1))


# ---------------------------------------------------------------- verdeling
def meet_verdeling(seed):
    from match_simulator import simulate_match_with_decks
    rng = random.Random(seed)
    d1, d2 = willekeurig_deck(rng), willekeurig_deck(rng)
    try:
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            _, a, b = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=seed)
    except Exception:
        return None
    uit = {}
    for label, deck in (("eigen", a), ("vijand", b)):
        proj = [c for c in deck if c.get("card_type") == "Project"]
        uit[f"{label}_kapot"] = len([c for c in proj if c.get("destroyed")])
        levend = [c for c in proj if not c.get("destroyed")]
        uit[f"{label}_rarities"] = len({str(c.get("rarity")) for c in levend})
        totaal = sum(c.get("current_mc", 0) for c in levend)
        uit[f"{label}_eindigt_op_7"] = int(round(totaal)) % 10 == 7
        uit[f"{label}_onder_10"] = len([c for c in levend if c.get("current_mc", 0) < 10])
        uit[f"{label}_mc_eindigt_7"] = len([c for c in levend
                                            if int(abs(c.get("current_mc", 0))) % 10 == 7])
    uit["totaal_kapot"] = uit["eigen_kapot"] + uit["vijand_kapot"]
    return uit


# ------------------------------------------------------------ drempelsweep
def probeer(args):
    cid, waarde, runs = args
    import match_simulator as ms
    from match_simulator import simulate_match_with_decks

    kaart = next((c for c in ms.ALL_CARDS if c.get("card_id") == cid), None)
    if not kaart or not kaart.get("parsed_power"):
        return cid, waarde, 0, runs
    # Bij twee kaarten staat de drempel in het type-veld ("cards_destroyed >= 3")
    # in plaats van in de waarde. Dan moet je dát veld aanpassen.
    veld = "condition_type" if re.search(r"[<>=]", str(kaart["parsed_power"][0].get("condition_type") or "")) \
        else "condition_value"
    origineel = kaart["parsed_power"][0].get(veld)
    kaart["parsed_power"][0][veld] = waarde

    rng = random.Random(zlib.crc32(cid.encode()))
    raak = 0
    for i in range(runs):
        eigen = deck_op_maat(cid, rng)
        ander = (rng.sample([x for x in BY_TYPE["Project"] if x != cid], 5)
                 + rng.sample([x for x in BY_TYPE["Support"] if x != cid], 5)
                 + rng.sample([x for x in BY_TYPE["Founder"] if x != cid], 1))
        d1, d2 = (eigen, ander) if i % 2 == 0 else (ander, eigen)
        try:
            with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                logs, _, _ = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=61000 + i)
        except Exception:
            continue
        for regel in "\n".join(logs).split("\n"):
            if cid not in regel or OPSTELLING.search(regel) or OVERGESLAGEN.search(regel):
                continue
            if GESLAAGD.search(regel):
                raak += 1
                break
    kaart["parsed_power"][0][veld] = origineel
    return cid, waarde, raak, runs


def main():
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 40
    kernen = max(1, (os.cpu_count() or 2) - 1)

    with mp.Pool(kernen) as pool:
        verdelingen = [v for v in pool.map(meet_verdeling, range(2000), chunksize=32) if v]

    print("# Voorstel voor de drempels, met cijfers\n")
    print(f"Gebaseerd op {len(verdelingen)} willekeurige matches voor de verdelingen en")
    print(f"{runs} matches per kandidaatwaarde met een deck van de eigen factie.\n")

    print("## Hoe een match er gemiddeld uitziet\n")

    def verdeel(sleutel, label, maxi=6):
        teller = collections.Counter(v[sleutel] for v in verdelingen)
        tot = len(verdelingen)
        print(f"\n**{label}**\n")
        print("| waarde | aandeel van de matches | minstens zoveel |")
        print("|---|---|---|")
        loop = 0
        for k in range(0, maxi + 1):
            n = teller.get(k, 0)
            minstens = sum(teller.get(j, 0) for j in range(k, maxi + 2))
            print(f"| {k} | {100*n/tot:.0f}% | {100*minstens/tot:.0f}% |")

    verdeel("eigen_kapot", "Hoeveel van je eigen Projects sneuvelen per match")
    verdeel("vijand_kapot", "Hoeveel vijandelijke Projects sneuvelen per match")
    verdeel("totaal_kapot", "Vernietigde Projects in totaal, beide kanten", 8)
    verdeel("eigen_rarities", "Hoeveel verschillende rarities je aan het eind bestuurt", 5)
    verdeel("eigen_onder_10", "Hoeveel van je Projects onder de 10 MC eindigen")
    verdeel("eigen_mc_eindigt_7", "Hoeveel van je Projects een MC hebben die op 7 eindigt")

    zeven = sum(1 for v in verdelingen if v["eigen_eindigt_op_7"])
    print(f"\n**Je totale MC eindigt op 7** in {100*zeven/len(verdelingen):.0f}% van de matches "
          f"(toeval zou 10% zijn).\n")

    print("\n## Per kaart: wat elke drempel oplevert\n")
    taken = [(cid, w, runs) for cid, (_, kandidaten) in KANDIDATEN.items() for w in kandidaten]
    with mp.Pool(kernen) as pool:
        resultaten = pool.map(probeer, taken, chunksize=1)

    per_kaart = collections.defaultdict(list)
    for cid, waarde, raak, tot in resultaten:
        per_kaart[cid].append((waarde, raak / tot))

    for cid, (huidig, _) in KANDIDATEN.items():
        c = BY_ID[cid]
        print(f"\n### `{cid}`\n")
        print(f"> {(c.get('description') or '').splitlines()[0][:100]}\n")
        print("| drempel | slaagt in |")
        print("|---|---|")
        for waarde, aandeel in per_kaart[cid]:
            merk = "  ← huidig" if waarde == huidig else ""
            print(f"| `{waarde}` | {aandeel*100:.0f}%{merk} |")


if __name__ == "__main__":
    main()
