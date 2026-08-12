"""Toont dat het verliesplafond nu ook geldt op paden die niet via
track_mc_change lopen — een rechtstreekse toewijzing aan current_mc."""
import os, sys
BASE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,BASE); os.chdir(BASE)
from match_simulator import Kaart

k = Kaart({"card_id":"COC_Test","card_type":"Project","current_mc":40.0,"_max_total_loss":5.0})
print("verliesplafond 5, vier klappen van 4 MC, rechtstreeks toegewezen:")
for i in range(4):
    voor = k["current_mc"]
    k["current_mc"] = voor - 4          # precies zoals de 44 paden die de tracker overslaan
    print(f"   klap {i+1}: {voor:.1f} -> {k['current_mc']:.1f}")
assert abs((40.0 - k["current_mc"]) - 5.0) < 0.001, "plafond niet nageleefd"

k2 = Kaart({"card_id":"COC_Test2","card_type":"Project","current_mc":30.0,"_debuff_reduction":0.5})
voor = k2["current_mc"]; k2["current_mc"] = voor - 10
print(f"\ndebuff-korting 50%: -10 MC wordt {voor - k2['current_mc']:.1f} MC verlies")
assert abs(k2["current_mc"] - 25.0) < 0.001
voor = k2["current_mc"]; k2["current_mc"] = voor - 10
print(f"tweede klap (korting is op): -10 MC wordt {voor - k2['current_mc']:.1f} MC verlies")
assert abs(k2["current_mc"] - 15.0) < 0.001

k3 = Kaart({"card_id":"COC_Test3","card_type":"Project","current_mc":20.0})
k3["current_mc"] = 12.7
print(f"\nzonder schild blijft een waarde exact: {k3['current_mc']!r}")
assert k3["current_mc"] == 12.7

# --- spelerbrede schilden (negate) ---------------------------------------
gedeeld = {"over": 1}
a = Kaart({"card_id":"COC_A","card_type":"Project","current_mc":30.0,"_gedeeld_debuffschild":gedeeld})
b = Kaart({"card_id":"COC_B","card_type":"Project","current_mc":20.0,"_gedeeld_debuffschild":gedeeld})
print("\ngedeeld debuff-schild over twee eigen Projects (één lading):")
voor = a["current_mc"]; a["current_mc"] = voor - 8
print(f"   A krijgt -8: {voor:.1f} -> {a['current_mc']:.1f}  (genegeerd)")
assert a["current_mc"] == 30.0
voor = b["current_mc"]; b["current_mc"] = voor - 8
print(f"   B krijgt -8: {voor:.1f} -> {b['current_mc']:.1f}  (schild is op)")
assert b["current_mc"] == 12.0
voor = a["current_mc"]; a["current_mc"] = voor - 5
print(f"   A opnieuw -5: {voor:.1f} -> {a['current_mc']:.1f}  (komt nu wel aan)")
assert a["current_mc"] == 25.0
print("\nalle controles geslaagd")
