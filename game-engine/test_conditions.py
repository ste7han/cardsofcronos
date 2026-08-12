"""
Unit-test voor de voorwaarden die eerder ontbraken.

    ./venv/bin/python test_conditions.py

Bouwt een kunstmatige spelsituatie en roept check_condition_core direct aan, los
van een hele match. Zo zie je of de voorwaarde zelf klopt, onafhankelijk van de
vraag of zo'n situatie in een echte match voorkomt.
"""
import os
import sys
from types import SimpleNamespace

BASE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE)
os.chdir(BASE)

from condition import check_condition_core  # noqa: E402


def kaart(cid, mc=10, soort="Project", rarity="Common", tags=(), **extra):
    c = {"card_id": cid, "current_mc": mc, "base_mc": mc, "card_type": soort,
         "rarity": rarity, "tags": list(tags), "destroyed": False}
    c.update(extra)
    return c


def speler(veld, naam="Player 1"):
    return SimpleNamespace(field=veld, deck=veld, name=naam, destroyed_cards=[],
                           first_debuff_data=None, original_mc_snapshot={},
                           mc_loss_total=0, get_total_mc=lambda: sum(
                               c.get("current_mc", 0) for c in veld
                               if c.get("card_type") == "Project" and not c.get("destroyed")))


def check(bron, ctype, cvalue, eigen, vijand, fase="Buff"):
    return check_condition_core(
        bron, ctype, cvalue, eigen, vijand,
        player=speler(eigen), field=eigen,
        opponent_field=vijand, opponent=speler(vijand, "Player 2"),
        effect={"phase": fase}, context={"phase": fase}, log=[])


GEVALLEN = []


def geval(naam, verwacht, bron, ctype, cvalue, eigen, vijand, fase="Buff"):
    GEVALLEN.append((naam, verwacht, bron, ctype, cvalue, eigen, vijand, fase))


# --- opzetjes -------------------------------------------------------------
zelf = kaart("COC_Self", 20)
rare_a = kaart("COC_RareA", 12, rarity="Rare")
rare_b = kaart("COC_RareB", 8, rarity="Rare")
meme = kaart("COC_Meme", 9, tags=["Meme"])
crooks1 = kaart("COC_Cr1", 5, tags=["Crooks"])
crooks2 = kaart("COC_Cr2", 6, tags=["Crooks"])
crooks3 = kaart("COC_Cr3", 7, tags=["Crooks"])
kapot_w = kaart("COC_Wolf_dood", 0, tags=["Wolfswap"], destroyed=True)
kapot_c = kaart("COC_Croots_dood", 0, tags=["Cr00ts"], destroyed=True)
geraakt = kaart("COC_Geraakt", 4, _ever_debuffed=True, _mc_lost_total=6)
laag = kaart("COC_Laag", 3)
hoog = kaart("COC_Hoog", 44)
zeven = kaart("COC_Zeven", 17)
founder_cf = kaart("COC_CF_Founder_C1", 0, soort="Founder", tags=["Crooks"])

geval("in_play", True, zelf, "in_play", "True", [zelf], [])
geval("in_play bij vernietigde kaart", False,
      kaart("COC_Dood", 0, destroyed=True), "in_play", "True", [], [])
geval("survives_destruction", True, zelf, "survives_destruction", "True", [zelf], [])
geval("valid (>=2 projecten)", True, zelf, "valid", "True", [zelf, laag], [])
geval("valid (maar 1 project)", False, zelf, "valid", "True", [zelf], [])
geval("meme_tagged", True, zelf, "meme_tagged", "True", [zelf, meme], [])
geval("meme_tagged zonder Meme", False, zelf, "meme_tagged", "True", [zelf, laag], [])
geval("count_tag_on_field Crooks >= 3", True, zelf, "count_tag_on_field", "Crooks >= 3",
      [crooks1, crooks2, crooks3], [])
geval("count_tag_on_field te weinig", False, zelf, "count_tag_on_field", "Crooks >= 3",
      [crooks1, crooks2], [])
geval("count_rarity Rare >= 2", True, rare_a, "count_rarity", "Rare ≥ 2", [rare_a, rare_b], [])
geval("count_rarity Rare (ander aanwezig)", True, zelf, "count_rarity", "Rare", [zelf, rare_a], [])
geval("count_rarity Rare (geen ander)", False, zelf, "count_rarity", "Rare", [zelf], [])
geval("card_on_field Crooks Founder", True, zelf, "card_on_field", "Crooks Founder",
      [zelf, founder_cf], [])
geval("card_on_field afwezig", False, zelf, "card_on_field", "Crooks Founder", [zelf], [])
geval("destroyed_friendly_count >=2", True, zelf, "destroyed_friendly_count", "≥2",
      [zelf, kaart("a", 0, destroyed=True), kaart("b", 0, destroyed=True)], [])
geval("destroyed_friendly_count te weinig", False, zelf, "destroyed_friendly_count", "≥2",
      [zelf, kaart("a", 0, destroyed=True)], [])
geval("own_destroyed_count >=2", True, zelf, "own_destroyed_count", ">=2",
      [zelf, kaart("a", 0, destroyed=True), kaart("b", 0, destroyed=True)], [])
geval("destroyed_friendly_wolfswap", True, zelf, "destroyed_friendly_wolfswap", "True",
      [zelf, kapot_w], [])
geval("cr00ts_destroyed_count >=2", True, zelf, "cr00ts_destroyed_count", ">=2",
      [zelf, kapot_c], [kaart("COC_C2_dood", 0, tags=["Cr00ts"], destroyed=True)])
geval("destroyed_enemy_by_friendly", True, zelf, "destroyed_enemy_by_friendly", "True",
      [zelf], [kaart("vijand", 0, destroyed=True)])
geval("projects_destroyed >=3", True, zelf, "projects_destroyed", ">=3",
      [zelf, kaart("a", 0, destroyed=True), kaart("b", 0, destroyed=True)],
      [kaart("c", 0, destroyed=True)])
geval("survivor_count_eq 3", True, zelf, "survivor_count_eq", "3", [zelf, laag, hoog], [])
geval("survivor_count_eq 3 (er zijn er 2)", False, zelf, "survivor_count_eq", "3", [zelf, laag], [])
geval("hit_by_debuff", True, zelf, "hit_by_debuff", "True", [zelf, geraakt], [])
geval("hit_by_debuff (niemand geraakt)", False, zelf, "hit_by_debuff", "True", [zelf, laag], [])
geval("self_debuffed", True, geraakt, "self_debuffed", "True", [geraakt], [])
geval("loses_mc_from_effect", True, geraakt, "loses_mc_from_effect", "True", [geraakt], [])
geval("cards_lost_mc >=2", True, zelf, "cards_lost_mc", ">=2",
      [geraakt, kaart("ook", 3, _mc_lost_total=2)], [])
geval("causes_mc_loss (vijand verloor MC)", True, zelf, "causes_mc_loss", "True",
      [zelf], [kaart("vijand", 3, _mc_lost_total=5)])
geval("total_mc_lt_opponent", True, zelf, "total_mc_lt_opponent", "True",
      [laag], [hoog])
geval("total_mc_lt_opponent (juist hoger)", False, zelf, "total_mc_lt_opponent", "True",
      [hoog], [laag])
geval("lowest_project_mc_lt 10", True, zelf, "lowest_project_mc_lt", "10", [laag, hoog], [])
geval("lowest_project_mc_lt 10 (allemaal hoog)", False, zelf, "lowest_project_mc_lt", "10",
      [hoog, kaart("ook_hoog", 33)], [])
geval("mc_range <10 en >30", True, zelf, "mc_range", "<10_and_>30", [laag, hoog], [])
geval("mc_range (alleen laag)", False, zelf, "mc_range", "<10_and_>30", [laag], [])
geval("total_mc_mod 7 (14 MC)", True, zelf, "total_mc_mod", "7",
      [kaart("a", 7), kaart("b", 7)], [])
geval("total_mc_mod 7 (13 MC)", False, zelf, "total_mc_mod", "7",
      [kaart("a", 7), kaart("b", 6)], [])
geval("own_projects_mc_end_7 >=3", True, zelf, "own_projects_mc_end_7", ">=3",
      [kaart("a", 17), kaart("b", 27), kaart("c", 7)], [])
geval("own_projects_mc_end_7 (maar 2)", False, zelf, "own_projects_mc_end_7", ">=3",
      [kaart("a", 17), kaart("b", 27), kaart("c", 8)], [])
geval("after_all_resolve", True, zelf, "after_all_resolve", "True", [zelf], [], "Final")
geval("during_debuff_phase", True, zelf, "during_debuff_phase", "True", [zelf], [], "Debuff")
geval("COC_RR_M1_exploded", True, zelf, "COC_RR_M1_exploded", "True",
      [zelf, kaart("COC_RR_M1", 0, destroyed=True)], [])
geval("COC_RR_M1_exploded (niet ontploft)", False, zelf, "COC_RR_M1_exploded", "True",
      [zelf], [])
geval("control_all_rarities", True, zelf, "control_all_rarities", "True",
      [kaart("a", 1, rarity="Common"), kaart("b", 1, rarity="Rare"), kaart("c", 1, rarity="Epic"),
       kaart("d", 1, rarity="Legendary"), kaart("e", 1, rarity="Mythical")], [])


def main():
    goed = fout = 0
    for naam, verwacht, bron, ctype, cvalue, eigen, vijand, fase in GEVALLEN:
        try:
            import contextlib, io
            with contextlib.redirect_stdout(io.StringIO()):
                uit = bool(check(bron, ctype, cvalue, eigen, vijand, fase))
        except Exception as e:
            print(f"  FOUT  {naam:<44} crash: {type(e).__name__}: {e}")
            fout += 1
            continue
        if uit == verwacht:
            goed += 1
        else:
            fout += 1
            print(f"  FOUT  {naam:<44} verwacht {verwacht}, kreeg {uit}")
    print(f"\n{goed} van de {goed+fout} geslaagd")
    return 1 if fout else 0


if __name__ == "__main__":
    sys.exit(main())
