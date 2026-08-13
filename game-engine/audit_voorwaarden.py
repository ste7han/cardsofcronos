"""
Hoe vaak slaagt de voorwaarde van elke kaart?

    ./venv/bin/python audit_voorwaarden.py [matches_per_kaart] > VOORWAARDEN.md

Elke kaart wordt in twee soorten decks gespeeld:

  willekeurig — de kaart tussen willekeurige andere kaarten
  op maat     — een deck van dezelfde factie, zoals een speler het zou bouwen

Het verschil tussen die twee zegt of een kaart afhankelijk is van synergie. Een
kaart die in beide gevallen nooit afvuurt heeft een voorwaarde die in de praktijk
onbereikbaar is — of dat de bedoeling is, is een ontwerpvraag.
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

GESLAAGD = re.compile(r"triggered|→|boosts|reduces|steals|destroy|gains|loses|swap|reflect|"
                      r"protected|cannot lose|negates|redirect|counts as", re.I)
OVERGESLAGEN = re.compile(r"⛔|could not act|skipped|no valid targets|held back")
OPSTELLING = re.compile(r"^\s*•|starts with base MC|💰")


def factie(cid):
    return cid.replace("COC_", "").split("_")[0]


def deck_willekeurig(cid, rng):
    soort = BY_ID[cid]["card_type"]
    deck = [cid]
    for t, n in NEEDED:
        pool = [x for x in BY_TYPE[t] if x != cid]
        deck += rng.sample(pool, n - (1 if t == soort else 0))
    return deck


def deck_op_maat(cid, rng):
    f = factie(cid)
    familie = [c for c in CARDS if factie(c["card_id"]) == f and c["card_id"] != cid]
    rest = [c for c in CARDS if factie(c["card_id"]) != f]
    deck = [cid]
    for t, n in NEEDED:
        heb = sum(1 for x in deck if BY_ID[x]["card_type"] == t)
        nodig = n - heb
        if nodig <= 0:
            continue
        voorkeur = [c["card_id"] for c in familie if c["card_type"] == t and c["card_id"] not in deck]
        rng.shuffle(voorkeur)
        kies = voorkeur[:nodig]
        if len(kies) < nodig:
            aanvul = [c["card_id"] for c in rest if c["card_type"] == t and c["card_id"] not in deck + kies]
            kies += rng.sample(aanvul, nodig - len(kies))
        deck += kies
    return deck


def onderzoek(args):
    cid, runs = args
    from match_simulator import simulate_match_with_decks

    # De engine logt per kaart precies een poortregel: "— triggered" als de
    # voorwaarde slaagt, "— could not act" als hij faalt. Daarop tellen, niet op
    # losse effectregels: die noemen de kaart ook als ze hem alleen ráken
    # ("COC_Nova_Founder_R1 boosts ... COC_Nova_C1"), waardoor een kaart die zelf
    # nooit afvuurt tot 100% werd gerekend zodra bondgenoten hem opbuffden.
    poort = re.compile(re.escape(cid) + r"\s*[—–-]\s*triggered", re.I)

    uit = {}
    for naam, bouwer in (("willekeurig", deck_willekeurig), ("op_maat", deck_op_maat)):
        rng = random.Random(zlib.crc32((cid + naam).encode()))
        geslaagd = 0
        redenen = collections.Counter()
        for i in range(runs):
            eigen = bouwer(cid, rng)
            ander = (rng.sample([x for x in BY_TYPE["Project"] if x != cid], 5)
                     + rng.sample([x for x in BY_TYPE["Support"] if x != cid], 5)
                     + rng.sample([x for x in BY_TYPE["Founder"] if x != cid], 1))
            d1, d2 = (eigen, ander) if i % 2 == 0 else (ander, eigen)
            try:
                with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
                    logs, _, _ = simulate_match_with_decks(deck1_ids=d1, deck2_ids=d2, seed=41000 + i)
            except Exception:
                continue
            raak = False
            for regel in "\n".join(logs).split("\n"):
                if cid not in regel or OPSTELLING.search(regel):
                    continue
                if poort.search(regel):
                    raak = True
                elif OVERGESLAGEN.search(regel):
                    reden = re.sub(r".*could not act\s*—\s*", "", regel.replace("**", "")).strip()
                    reden = re.sub(r"[\U0001F000-\U0001FAFF☀-➿️]", "", reden).strip()
                    redenen[reden[:58] or "overgeslagen"] += 1
            geslaagd += 1 if raak else 0
        uit[naam] = (geslaagd, redenen.most_common(1)[0][0] if redenen else "")
    return cid, uit


def main():
    runs = int(sys.argv[1]) if len(sys.argv) > 1 else 30
    with mp.Pool(max(1, (os.cpu_count() or 2) - 1)) as pool:
        res = pool.map(onderzoek, [(c["card_id"], runs) for c in CARDS], chunksize=4)

    rijen = []
    for cid, uit in res:
        w, _ = uit["willekeurig"]
        m, reden = uit["op_maat"]
        rijen.append((m / runs, w / runs, cid, reden))
    rijen.sort()

    print(f"# Hoe vaak slaagt de voorwaarde van elke kaart?\n")
    print(f"Elke kaart {runs} keer gespeeld in een willekeurig deck en {runs} keer in een deck")
    print(f"van dezelfde factie. Gesorteerd op het laagste percentage.\n")
    print(f"Totaal {len(CARDS) * runs * 2} matches.\n")

    groepen = [
        ("Nooit", lambda m: m == 0,
         "De voorwaarde slaagt in geen enkele match, ook niet met steun van de eigen factie."),
        ("Zelden — onder de 20%", lambda m: 0 < m < 0.2,
         "Werkt, maar vraagt een situatie die zelden ontstaat."),
        ("Soms — 20 tot 60%", lambda m: 0.2 <= m < 0.6, ""),
        ("Vaak — 60% of meer", lambda m: m >= 0.6, ""),
    ]
    for titel, test, toelichting in groepen:
        groep = [r for r in rijen if test(r[0])]
        print(f"\n## {titel} ({len(groep)} kaarten)\n")
        if toelichting:
            print(f"{toelichting}\n")
        print("| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |")
        print("|---|---|---|---|---|")
        for m, w, cid, reden in groep:
            c = BY_ID[cid]
            eff = (c.get("parsed_power") or [{}])[0]
            cond = f"`{eff.get('condition_type')}`"
            if eff.get("condition_value") not in (None, "", "True"):
                cond += f" = {eff.get('condition_value')}"
            print(f"| `{cid}` | {m*100:.0f}% | {w*100:.0f}% | {cond} | {reden[:52]} |")


if __name__ == "__main__":
    main()
