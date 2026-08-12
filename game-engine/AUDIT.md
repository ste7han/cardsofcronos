# Engine-audit

Gegenereerd met `audit_engine.py`, `audit_cards.py` en de A/B-test.
Ruim 25.000 gesimuleerde matches.

## Samenvatting

| controle | uitkomst |
|---|---|
| crashes over 25.000 matches | geen |
| negatieve MC op levende Projects | geen |
| eindstand gelijk aan het logboek | altijd |
| determinisme bij gelijke seed | ja |
| **eerlijkheid speler 1 vs speler 2** | **scheef, +1,45 MC voor speler 2** |
| **kaarten zonder enig effect** | **105 van 235 (44%)** |

## 1. Positievoordeel voor speler 2

1500 deckparen, elk twee keer gespeeld met dezelfde seed, één keer met deck A als
speler 1 en één keer als speler 2:

- slechts **25%** van de paren geeft dezelfde score ongeacht positie
- deck A scoorde hoger als speler 2 in **537** gevallen, tegen **355** als speler 1
- gemiddeld voordeel van positie 2: **+1,45 MC**

In spiegelmatches (identieke decks) won speler 2 706 keer tegen 571 voor speler 1.
Dat is circa 4 sigma: geen toeval.

Oorzaak-richting: `apply_phase` in match_simulator.py werkt binnen elke fase eerst
deck 1 af en dan deck 2. Wie als tweede handelt, rekent op een bord dat al door de
tegenstander is aangepast. **In PvP is de host altijd speler 1, dus de gast heeft
structureel de betere plek.**

## 2. Kaarten zonder effect — 105 van 235

Methode: elke kaart in een deck gezet en de match twee keer gedraaid met dezelfde
seed — één keer met het effect intact, één keer met `parsed_power` leeggemaakt.
Verandert de eindstand nooit, dan heeft de kaart geen enkel gevolg. Kaarten die in
willekeurige decks niets deden zijn daarna nogmaals getest in een deck van hun eigen
factie; slechts 6 kwamen daarmee alsnog tot leven.

### Naar oorzaak

| aantal | oorzaak |
|---|---|
| 63 | voorwaarde herkend maar nooit gehaald |
| 31 | onbekende voorwaarde |
| 8 | stilzwijgend genegeerd |
| 3 | overig / niet in ronde-1-steekproef |

### Per factie

| factie | dood / totaal |
|---|---|
| EVT | 6 / 29 |
| Clove | 9 / 15 |
| CF | 9 / 15 |
| Wolfswap | 9 / 15 |
| RR | 6 / 15 |
| Howlers | 9 / 15 |
| FFS | 8 / 15 |
| CM | 3 / 15 |
| Nova | 8 / 15 |
| Cr00ts | 7 / 15 |
| Lionel | 10 / 15 |
| CAW777 | 10 / 15 |
| DAK | 6 / 15 |
| INF | 3 / 15 |
| COM | 2 / 10 |

### Volledige lijst

- `COC_CAW777_C1` (Project/Common) — cond `total_mc_ends_in`, act `add_mc`
  - "If your total MC ends in 7, gain +3 MC."
- `COC_CAW777_C2` (Project/Common) — cond `self_mc_eq`, act `double_mc`
  - "If this Project’s MC is exactly 7 after buffs, double it."
- `COC_CAW777_C3` (Project/Common) — cond `survives_destruction`, act `add_mc`
  - "If this Project survives, it gains +7 MC."
- `COC_CAW777_E1` (Project/Epic) — cond `total_mc_mod`, act `double_mc`
  - "If your MC total is a multiple of 7 at Final Calculation, double this Project's MC."
- `COC_CAW777_Founder_E1` (Founder/Epic) — cond `first_debuff_targeting_side`, act `reflect`
  - "Reflect the first debuff targeting your side if your MC ends in 7."
- `COC_CAW777_Founder_L1` (Founder/Legendary) — cond `survivor_count_eq`, act `add_mc`
  - "If exactly 3 Projects survive, each gains +7 MC."
- `COC_CAW777_Founder_M1` (Founder/Mythical) — cond `own_projects_mc_end_7`, act `triple_mc`
  - "If 3 or more of your Projects' MC values end in 7, triple their MC."
- `COC_CAW777_Founder_R1` (Founder/Rare) — cond `mc_multiple`, act `add_mc`
  - "If your total MC is a multiple of 7 after buffs, gain +5 MC."
- `COC_CAW777_M1` (Project/Mythical) — cond `projects_with_7_mc`, act `destroy`
  - "If 3 or more of your Projects have a 7 in their MC at Final Calculation, destroy 2 random "
- `COC_CAW777_R1` (Project/Rare) — cond `survivor_count_eq`, act `add_mc`
  - "If your total number of surviving Projects is 3, gain +7 MC."
- `COC_CF_C2` (Project/Common) — cond `targeted_by_debuff`, act `negate_and_destroy_self`
  - "If targeted by a debuff, negate the effect and destroy this card"
- `COC_CF_C3` (Project/Common) — cond `none`, act `none`
  - ""
- `COC_CF_E1` (Project/Epic) — cond `none`, act `arm_first_debuff_negate_other_projects`
  - "All other Project cards you control are protected from the first debuff"
- `COC_CF_E2` (Project/Epic) — cond `card_on_field`, act `add_mc`
  - "If you control Crooks Founder, gain +15 MC"
- `COC_CF_Founder_E1` (Founder/Epic) — cond `hit_by_debuff`, act `add_mc`
  - "If one of your Projects is hit by a debuff, that card immediately gains +5 MC"
- `COC_CF_Founder_M1` (Founder/Mythical) — cond `first_debuff`, act `reflect_and_amplify`
  - "Reflect the first debuff back at your opponent and double the damage"
- `COC_CF_Founder_R1` (Founder/Rare) — cond `first_debuff`, act `reduce_debuff_percentage`
  - "The first debuff that targets one of your Projects is reduced by 50%"
- `COC_CF_M1` (Project/Mythical) — cond `more_projects_than_opponent`, act `steal_mc`
  - "If you have more Project cards than your opponent:"
- `COC_CF_R3` (Project/Rare) — cond `in_play`, act `subtract_mc`
  - "minus 5 MC to a random enemy Project if this is in play"
- `COC_CM_Founder_E1` (Founder/Epic) — cond `own_mc_loss_count`, act `add_mc_random_two`
  - "If two or more of your Projects lose MC this match,"
- `COC_CM_Founder_R1` (Founder/Rare) — cond `causes_mc_loss`, act `add_mc`
  - "When one of your cards causes MC loss to any card (friend or foe), gain +1 MC on all Monst"
- `COC_CM_R2` (Project/Rare) — cond `own_project_loses_mc`, act `add_mc_stack`
  - "Every time one of your Projects loses MC, this gains +2 MC (max +10)"
- `COC_COM_Curry_L1` (Support/Legendary) — cond `none`, act `immune_destruction`
  - "Your lowest MC Project becomes immune to destruction this match."
- `COC_COM_Vinz_L1` (Support/Legendary) — cond `rarity`, act `double_buff`
  - "Double the MC bonus of all legendary project cards on your side."
- `COC_Clove_C1` (Project/Common) — cond `has_tag`, act `add_mc`
  - "plus 2mc if you have a community card on the field"
- `COC_Clove_C2` (Project/Common) — cond `none`, act `no power`
  - ""
- `COC_Clove_C3` (Project/Common) — cond `is_only_rarity`, act `add_mc`
  - "plus 3mc if this is your only common card on the field"
- `COC_Clove_Founder_C1` (Founder/Common) — cond `has_mc_below`, act `add_mc`
  - "If any of your Project cards have 10 MC or less, each gains +2 MC"
- `COC_Clove_Founder_E1` (Founder/Epic) — cond `first_debuff_hit`, act `negate`
  - "The first debuff that would hit one of your Project cards is completely negated"
- `COC_Clove_Founder_R1` (Founder/Rare) — cond `has_card_type`, act `add_mc`
  - "If your deck includes an Event, randomly select 1 Project card to gain +5 MC"
- `COC_Clove_M1` (Project/Mythical) — cond `limit_loss`, act `limit_loss`
  - "Cant lose more than 5mc points"
- `COC_Clove_R2` (Project/Rare) — cond `count_rarity`, act `add_mc_per_card`
  - "plus 2mc for each other Rare card on the field"
- `COC_Clove_R3` (Project/Rare) — cond `not_has_tags`, act `add_mc`
  - "If you do not have an Event card, gain +4 MC"
- `COC_Cr00ts_E2` (Project/Epic) — cond `targeted_by_debuff`, act `destroy`
  - "If targeted by a debuff, immediately destroy the lowest MC enemy Project."
- `COC_Cr00ts_Founder_L1` (Founder/Legendary) — cond `cr00ts_destroyed_count`, act `add_mc`
  - "If two or more Cr00ts Projects are destroyed during the match, all surviving Projects gain"
- `COC_Cr00ts_Founder_M1` (Founder/Mythical) — cond `enemy_destroyed_count`, act `destroy_and_steal`
  - "If 3 or more enemy Projects are destroyed during the match, immediately destroy one random"
- `COC_Cr00ts_Founder_R1` (Founder/Rare) — cond `project_debuffed`, act `add_mc`
  - "If one of your Projects is debuffed, grant +3 MC to two random Projects."
- `COC_Cr00ts_L1` (Project/Legendary) — cond `final_calc`, act `steal_mc`
  - "Steal +5 MC from each enemy Project below 20 MC at final calculation."
- `COC_Cr00ts_M1` (Project/Mythical) — cond `enemy_destroyed_count`, act `destroy_and_gain`
  - "If 3 or more enemy Projects were destroyed during the match, destroy all remaining enemy P"
- `COC_Cr00ts_R3` (Project/Rare) — cond `during_debuff_phase`, act `swap_mc`
  - "During debuff phase, swap the MC values of your lowest and highest enemy Projects."
- `COC_DAK_Founder_C1` (Founder/Common) — cond `tag_on_field`, act `add_mc`
  - "At the start of the match, give +3 MC to your lowest MC Ape Project."
- `COC_DAK_Founder_E1` (Founder/Epic) — cond `first_destruction_attempt`, act `reflect`
  - "Reflect the first destruction attempt targeting your Projects back at the attacker."
- `COC_DAK_Founder_L1` (Founder/Legendary) — cond `enemy_destroyed_count`, act `double_mc`
  - "If 2 enemy Projects are destroyed, randomly double one of your surviving Projects' MC."
- `COC_DAK_Founder_M1` (Founder/Mythical) — cond `enemy_destroyed_count`, act `destroy_and_add_mc`
  - "If 3 or more enemy Projects are destroyed, destroy another one and gain +20 MC."
- `COC_DAK_M1` (Project/Mythical) — cond `projects_destroyed`, act `destroy_and_add_mc`
  - "If 3 or more Projects (any side) are destroyed, destroy another random enemy Project and g"
- `COC_DAK_R3` (Project/Rare) — cond `project_count`, act `add_mc`
  - "If you have exactly 3 Projects after counter phase, gain +8 MC."
- `COC_EVT_Buy_the_Dip` (Support/Rare) — cond `lost_mc_due_to_effect`, act `add_mc_btd`
  - "All of your Project cards that have lost MC due to effects this match regain +4 MC."
- `COC_EVT_Echo_of_the_Past` (Support/Epic) — cond `None`, act `base_mc_of_lowest`
  - "Copy the base MC of your lowest Project and add it to your highest Project."
- `COC_EVT_Gas_War` (Support/Rare) — cond `not_has_tags`, act `disable_effects`
  - "All community cards lose their effects. If you control no Influencer cards, gain +5 MC on "
- `COC_EVT_Market_Whisper` (Support/Common) — cond `total_mc < opponent`, act `add_mc`
  - "If your total MC is lower than your opponent's, gain +3 MC on your highest Project"
- `COC_EVT_Sideways_Chop` (Support/Common) — cond `None`, act `None`
  - "This card does absolutely nothing."
- `COC_EVT_Whale_Games` (Support/Legendary) — cond `None`, act `random_double_or_destroy`
  - "Randomly select one Project from each player. One is doubled in MC, the other is destroyed"
- `COC_FFS_E1` (Project/Epic) — cond `any_project_takes_damage`, act `add_mc`
  - "If any of your Projects take damage this match, gain +10 MC"
- `COC_FFS_Founder_C1` (Founder/Common) — cond `own_project_lost_mc`, act `add_mc`
  - "If one of your Projects has lost MC due to a card effect,"
- `COC_FFS_Founder_E1` (Founder/Epic) — cond `cards_lost_mc`, act `add_mc`
  - "If 2 or more of your cards lose MC from effects, gain +4 MC on each card that didn’t"
- `COC_FFS_Founder_L1` (Founder/Legendary) — cond `any_card_mc_lt`, act `destroy`
  - " if any card on your side is reduced below 5 MC,"
- `COC_FFS_Founder_M1` (Founder/Mythical) — cond `own_projects_lost_mc`, act `add_mc`
  - "If 3 or more of your Projects lose MC during the match,"
- `COC_FFS_Founder_R1` (Founder/Rare) — cond `meme_tagged`, act `add_mc`
  - "At the start of the match, give +2 MC to all Meme-tagged cards"
- `COC_FFS_L1` (Project/Legendary) — cond `own_projects_lost_mc`, act `add_mc`
  - "If 2 or more of your own Projects have lost MC due to card effects, gain +15 MC"
- `COC_FFS_R1` (Project/Rare) — cond `loses_mc_from_effect`, act `destroy`
  - "If this card loses MC from an effect, destroy a random Common enemy"
- `COC_Howlers_C2` (Project/Common) — cond `total_mc_lt_opponent`, act `add_mc`
  - "If your total MC is lower than your opponent’s, gain +4 MC"
- `COC_Howlers_FounderL1` (Founder/Legendary) — cond `has_all_rarities`, act `add_mc`
  - "If your deck contains exactly one of each rarity,"
- `COC_Howlers_Founder_C1` (Founder/Common) — cond `count_tag`, act `add_mc`
  - "If you have at least 3 cards with the Lunar tag, gain +2 MC on your lowest MC Project"
- `COC_Howlers_Founder_E1` (Founder/Epic) — cond `valid`, act `swap_mc`
  - "swap the MC of your highest and lowest Project card"
- `COC_Howlers_Founder_M1` (Founder/Mythical) — cond `after_all_resolve`, act `invert`
  - "After all other effects resolve, invert all buffs and debuffs on your Projects only"
- `COC_Howlers_Founder_R1` (Founder/Rare) — cond `mc_range`, act `add_mc`
  - "If your Projects include both a card below 10 MC and a card above 30 MC,"
- `COC_Howlers_L1` (Project/Legendary) — cond `exact_rarity_mix`, act `add_mc`
  - "plus 15mc If you control exactly 1 Common, 1 Rare, 1 Epic, 1 Legendary, 1 Mythical"
- `COC_Howlers_R2` (Project/Rare) — cond `count_tag_exact`, act `add_mc`
  - "Gain +6 MC if you have exactly 3 Projects with the Lunar tag"
- `COC_Howlers_R3` (Project/Rare) — cond `highest_mc_project`, act `disable`
  - "Disable the effect highest MC Project on the field (yours or enemy)"
- `COC_INF_21Million_L1` (Support/Legendary) — cond `highest_own_buff`, act `double_buff`
  - "Double the buff from your highest-buffed Project"
- `COC_INF_21Million_M1` (Support/Mythical) — cond `control_all_rarities`, act `destroy`
  - "If you control a Project of every rarity, destroy 2 random enemy Projects."
- `COC_INF_Francis_E1` (Support/Epic) — cond `mc_lt_opponent`, act `steal_mc`
  - "If your total MC is lower than your opponent, steal +5 MC of your highest opponent."
- `COC_Lionel_C2` (Project/Common) — cond `project_targeted_by_debuff`, act `add_mc`
  - "If any of your Projects were targeted by a debuff, gain +2 MC immediately."
- `COC_Lionel_C3` (Project/Common) — cond `lowest_mc_project`, act `prevent_destruction`
  - "Protects your lowest MC Project from being destroyed once."
- `COC_Lionel_E1` (Project/Epic) — cond `survived_destruction_count`, act `add_mc`
  - "If 2 or more of your Projects survived, gain +8 MC."
- `COC_Lionel_E2` (Project/Epic) — cond `first_debuff`, act `reflect_debuff`
  - "Reflects the first debuff targeting any of your Projects back at the attacker."
- `COC_Lionel_Founder_E1` (Founder/Epic) — cond `destruction_attempt`, act `negate`
  - "Negate the first destruction attempt targeting your Projects this match."
- `COC_Lionel_Founder_L1` (Founder/Legendary) — cond `final_calc_survivors`, act `add_mc`
  - "If 2 or more of your Projects survive until Final Calculation, gain +6 MC on all surviving"
- `COC_Lionel_Founder_M1` (Founder/Mythical) — cond `projects_destroyed_count`, act `double_mc`
  - "If none of your Projects were destroyed during the match, double the MC of your highest Pr"
- `COC_Lionel_L1` (Project/Legendary) — cond `final_calc`, act `double_mc`
  - "Double the MC of your lowest surviving Project at Final Calculation."
- `COC_Lionel_R1` (Project/Rare) — cond `control_card_count`, act `add_mc`
  - "If you control at least 2 Commons, this Project gains +5 MC."
- `COC_Lionel_R2` (Project/Rare) — cond `enemy_project_destroyed_once`, act `add_mc`
  - "The first time an enemy Project is destroyed this match, gain +5 MC."
- `COC_Nova_C1` (Project/Common) — cond `tag_on_field`, act `add_mc`
  - "Gain +2 MC if another Nova card is on your field."
- `COC_Nova_Founder_C1` (Founder/Common) — cond `count_card_rarity`, act `add_mc`
  - "If your deck contains 2 or more Common Nova cards, gain +2 MC on one random own Project."
- `COC_Nova_Founder_E1` (Founder/Epic) — cond `nova_destroyed`, act `add_mc`
  - "If a Nova Project was destroyed this match, give +4 MC to all remaining Nova cards."
- `COC_Nova_Founder_L1` (Founder/Legendary) — cond `target_nova_project`, act `reflect_debuff`
  - "Double the effect of any one Nova-tagged Project. If it's an Epic or higher, reflect 1 deb"
- `COC_Nova_Founder_M1` (Founder/Mythical) — cond `unique_rarity_count_gte`, act `multi_action`
  - "If you control Projects of 4 different rarities, destroy the lowest enemy Project and gain"
- `COC_Nova_Founder_R1` (Founder/Rare) — cond `project_mc_lt`, act `add_mc`
  - "If any of your Projects are below 10 MC, each gains +2 MC."
- `COC_Nova_M1` (Project/Mythical) — cond `none`, act `swap`
  - "Exchange the highest MC card on your opponent’s side, with your lowest MC project."
- `COC_Nova_R1` (Project/Rare) — cond `has_card_type`, act `add_mc`
  - "If you control an Event card, this gains +4 MC."
- `COC_RR_Founder_C1` (Founder/Common) — cond `lowest_project_mc_lt`, act `add_mc`
  - "If your lowest MC Project is below 10, give it +4 MC"
- `COC_RR_Founder_E1` (Founder/Epic) — cond `own_destroyed_count`, act `revive_half_mc`
  - "If 2 of your Projects were destroyed, one randomly:"
- `COC_RR_Founder_L1` (Founder/Legendary) — cond `enemy_destroyed_count`, act `add_mc`
  - "If you destroy at least 1 enemy Project this match,"
- `COC_RR_Founder_M1` (Founder/Mythical) — cond `COC_RR_M1_exploded`, act `destroy_and_gain_mc`
  - "If COC_RR_M1 explodes this match:"
- `COC_RR_Founder_R1` (Founder/Rare) — cond `on_project_destroyed`, act `add_mc`
  - "The first time one of your Projects is destroyed,"
- `COC_RR_L1` (Project/Legendary) — cond `own_destroyed_count`, act `add_mc`
  - "If you have at least 2 destroyed Project cards, this gains +12 MC"
- `COC_Wolfswap_C2` (Project/Common) — cond `destroyed_friendly_wolfswap`, act `add_mc`
  - "If another Wolfswap Project is destroyed, this gains +6 MC"
- `COC_Wolfswap_C3` (Project/Common) — cond `destruction_targeting`, act `override_mc_value`
  - "Counts as the highest MC card for destruction targeting"
- `COC_Wolfswap_Founder_C1` (Founder/Common) — cond `first_friendly_destroyed`, act `add_mc`
  - "The first time one of your Projects is destroyed, gain +6 MC on a random surviving Project"
- `COC_Wolfswap_Founder_E1` (Founder/Epic) — cond `destroyed_friendly_count`, act `add_mc`
  - "If 2 of your Projects have been destroyed, gain +4 MC on each surviving one"
- `COC_Wolfswap_Founder_L1` (Founder/Legendary) — cond `destroyed_enemy_by_friendly`, act `add_mc`
  - "If 1 of your Projects destroys an enemy Project, your lowest project gain +10 MC"
- `COC_Wolfswap_Founder_M1` (Founder/Mythical) — cond `destroyed_friendly_count`, act `destroy`
  - "If 4 of your cards are destroyed during the match,"
- `COC_Wolfswap_Founder_R1` (Founder/Rare) — cond `effect_targeted_highest`, act `redirect`
  - "redirect the first effect targeting your highest Project to your lowest instead."
- `COC_Wolfswap_R1` (Project/Rare) — cond `mc_lower_than_self`, act `destroy`
  - "Destroy an enemy Project with MC lower than this one"
- `COC_Wolfswap_R3` (Project/Rare) — cond `effect_targeted_highest`, act `redirect`
  - "Redirect all effects targeting your highest Project to this card"

---

## Vervolg: 30 ontbrekende voorwaarden geïmplementeerd

Na deze audit zijn de ontbrekende voorwaarden in `condition.py` toegevoegd en zijn
vijf bestaande, kapotte implementaties gerepareerd:

| voorwaarde | wat er mis was |
|---|---|
| `count_rarity` | accepteerde alleen "Rare ≥ 2"; een kale "Rare" werd afgewezen |
| `card_on_field` | zocht "crooks founder" als substring in "COC_CF_Founder_C1" |
| `destroyed_friendly_count` | logde "condition met" maar gaf niets terug, dus viel door naar False |
| `self_debuffed` | las `was_debuffed`, een vlag die de engine nergens zet |
| `mc_range` | toetste de MC van de bronkaart zelf; die kan nooit tegelijk onder 10 en boven 30 zijn |

Resultaat, gemeten met `check_fixed.py` (35 effecten, elk 30 decks van eigen factie):

- **20 van de 35 werken nu**, waar het er eerst 0 waren
- dode kaarten over alle 235: **110 -> 91**

De overige 15 stranden niet meer op de voorwaarde maar op de laag erna:

- 4 halen hun voorwaarde nu wél en krijgen "no valid targets" — hun `target_type`
  (`highest_lowest`, `own_projects`, `meme_tagged`) kent `targeting.py` niet
- `COC_CF_Founder_E1` heeft `target_type: self`, maar de tekst zegt dat de
  gedebuffde Project +5 MC krijgt; een Founder heeft zelf geen MC
- 2 wachten op de actie `redirect`, die niet bestaat
- de rest heeft een voorwaarde die klopt maar zelden voorkomt (≥4 eigen kaarten
  vernietigd, een Project van elke rarity, COC_RR_M1 die ontploft)

### Volgende laag: target_types

Dezelfde soort fout zit in `targeting.py`: **42 `target_type`-waarden komen in de
kaartdata voor maar niet in de engine**, samen goed voor circa 43 kaarten. Een
onbekend doel geeft "no valid targets" en de kaart doet niets.

---

## Vervolg 2: 41 ontbrekende target_types geïmplementeerd

Dezelfde fout zat in `targeting.py`: een onbekend `target_type` gaf een lege lijst,
waarna de engine "skipped — no valid targets" logde en de kaart niets deed.
41 waarden uit de kaartdata ontbraken, samen goed voor 42 kaarten.

Toegevoegd: `all_own`, `own_projects`, `others`, `surviving`, `all_survivors`,
`all_surviving_friendly_projects`, `all_remaining`, `all_friendly_projects_below_mc`,
`highest`, `highest_own`, `highest_lowest`, `random_surviving_project`,
`random_survivor`, `random_own_2`, `random_two_own_projects`, `random_2_survivors`,
`random_destroyed`, `remaining_machine`, `all_machine_except_self`, `remaining_nova`,
`all_monster_tagged`, `meme_tagged`, `all_legendary_projects`, `lowest_friendly_ape`,
`double_effect`, `all_enemy`, `each_opponent_project`, `enemy_lowest`,
`enemy_highest_mc`, `enemy_founder`, `random_common_enemy`, `random_enemy_survivor`,
`random_project`, `target`, `enemy_highest_vs_own_lowest`, `random_enemy + lowest_own`,
`random_2_enemy + self`, `attacker`, `original_debuff_source`, `one_project`, `none`.

De tags in de data heten anders dan in de kaartteksten — "Ape" is de tag `DAK`,
"Monster" is `Crazzzy Monsters` — dus de selectors matchen op deel-overeenkomst.

## Stand na beide reparatierondes

| | voor | na |
|---|---|---|
| kaarten die de uitslag beïnvloeden | 107 | **143** |
| kaarten die aantoonbaar niets doen | 110 | **66** |

Invarianten, determinisme en de engine-testsuite blijven schoon.

Wel een neveneffect: het positievoordeel van speler 2 is toegenomen van 4,4 naar
7,3 procentpunt in spiegelmatches. Dat is logisch — nu meer kaarten daadwerkelijk
iets doen, weegt het voordeel van als tweede handelen zwaarder. Die scheefheid
staat los van de kaarten en zit in de fasevolgorde.

## Wat er nog ligt: de actielaag

De resterende 18 kaarten stranden op ontbrekende acties, niet op voorwaarden of
doelen: `redirect` (2x), `revive_half_mc`, `destroy_and_gain`, `destroy_and_steal`,
`reflect`, `disable`. De rest heeft een voorwaarde die klopt maar zeldzaam is.

---

## Vervolg 3: het positievoordeel weggenomen

`apply_phase` werkte binnen elke fase eerst deck 1 af en dan deck 2. Wie als
tweede handelt rekent op een bord dat de tegenstander al heeft aangepast, en dat
bleek een meetbaar voordeel. In PvP is de host altijd speler 1, dus de gast had
structureel de betere plek.

De beurtvolgorde wisselt nu per fase, met een geloot begin. Zo krijgt elke speler
precies drie van de zes fases als eerste; het muntje hangt aan de match-seed, dus
alles blijft reproduceerbaar.

Gemeten met `audit_position.py` — 1500 deckparen, elk twee keer gespeeld met
dezelfde seed, één keer met deck A als speler 1 en één keer als speler 2:

| | voor | na |
|---|---|---|
| gemiddeld verschil (positie 2 − positie 1) | **+1,45 MC** | **−0,03 MC** |
| positie 2 wint van de beslissende paren | 60,2% | 50,9% |
| afwijking in spiegelmatches (6000 matches) | 7,3 procentpunt | **0,5 procentpunt** |

Beide resteren binnen de ruismarge. Invarianten, determinisme, de engine-testsuite
en de 44 unit-tests op de voorwaarden blijven schoon.

---

## Vervolg 4: de actielaag

Dezelfde fout, één laag dieper: een `action_type` dat `action.py` niet kende viel
door de hele keten zonder iets te doen. De kaart werd wél als "triggered" gelogd,
maar had geen enkel gevolg. 25 acties ontbraken, goed voor 27 kaarten.

Geïmplementeerd: `remove_mc_percent`, `add_mc_per_card_type`, `add_mc_lowest`,
`add_mc_dak`, `add_mc_random_two`, `add_mc_btd`, `subtract_mc_and_add`,
`self_destruct_and_add_mc`, `add_mc_stack`, `destroy_and_gain`,
`destroy_and_steal`, `caw_r2_effect`, `steal_mc_caw_e2`,
`steal_and_give_to_lowest`, `base_mc_of_lowest`, `subtract_and_opponent_buff`,
`multi_action`, `limit_loss`, `reduce_debuff_percentage`, `prevent_destruction`
en `override_mc_value`.

`limit_loss` en `reduce_debuff_percentage` worden afgedwongen in
`track_mc_change` — het enige punt waar elke MC-wijziging langskomt.
`prevent_destruction` wordt aan het eind van elke fase nageleefd: een beschermde
kaart die vernietigd werd komt terug en verbruikt daarbij zijn schild.

### En een fase die nooit matchte

Zes kaarten hebben `phase: "Any"`. `_effects_for_phase` vergeleek dat letterlijk
met "start", "buff" enzovoort, dus die kaarten werden nooit overwogen — geen
effect, geen skip-regel, niets. Het zijn passieve eigenschappen ("kan niet meer
dan 5 MC verliezen", "beschermt je laagste Project"), dus ze worden nu in de
Start-fase gezet.

Eerder in deze audit concludeerde ik dat die kaarten "elders als passief effect
werken". Dat was onjuist; de A/B-test toonde aan dat ze geen enkel gevolg hadden.

## Eindstand

| | begin | nu |
|---|---|---|
| kaarten die de uitslag beïnvloeden | 107 | **139** |
| kaarten die aantoonbaar niets doen | 110 | **62** |
| positievoordeel speler 2 | +1,45 MC | +0,35 MC (binnen ruis) |

Geen crashes, geen negatieve MC, eindstand altijd gelijk aan het logboek,
determinisme intact, 44/44 unit-tests op de voorwaarden.

## Wat er nog ligt

Vier effecten vragen om onderschepping diep in de engine en zijn niet gebouwd:

- `redirect` (2 kaarten) — effecten die op je hoogste Project mikken omleiden
- `reflect` / `reflect_and_amplify` — de eerste debuff terugkaatsen naar de bron
- `override_mc_value` — de vlag wordt gezet, maar de targeting-selectors kijken
  er nog niet naar

Verder zijn er kaarten met een voorwaarde die klopt maar zelden voorkomt: vier
eigen kaarten vernietigd, een Project van élke rarity, drie vijandelijke
Projects vernietigd.
