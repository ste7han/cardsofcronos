# Hoe vaak slaagt de voorwaarde van elke kaart?

Elke kaart 40 keer gespeeld in een willekeurig deck en 40 keer in een deck
van dezelfde factie. Gesorteerd op het laagste percentage.

Totaal 18800 matches.


## Nooit (15 kaarten)

De voorwaarde slaagt in geen enkele match, ook niet met steun van de eigen factie.

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_CM_C1` | 0% | 0% | `on_destroyed` | COC_CM_C1 was not destroyed — effect requires destru |
| `COC_Clove_C3` | 0% | 0% | `is_only_rarity` = Common | Player 1 does not have only 'Common' rarity |
| `COC_Cr00ts_C2` | 0% | 0% | `on_destroyed` | COC_Cr00ts_C2 was not destroyed — effect requires de |
| `COC_Cr00ts_Founder_E1` | 0% | 0% | `first_enemy_debuff` | Armed — waiting for the first debuff |
| `COC_EVT_Sideways_Chop` | 0% | 0% | `None` |  |
| `COC_Howlers_L1` | 0% | 0% | `exact_rarity_mix` = Common:1,Rare:1,Epic:1,Legendary:1,Mythical:1 | Player 1 does not have exact rarity mix: Common:1,Ra |
| `COC_INF_21Million_M1` | 0% | 0% | `control_all_rarities` | control_all_rarities (missing: Epic, Mythical) |
| `COC_RR_C3` | 0% | 0% | `on_destroyed` |  |
| `COC_RR_R3` | 0% | 0% | `on_destroyed` | COC_RR_R3 was not destroyed — effect requires destru |
| `COC_Wolfswap_C1` | 0% | 0% | `self_destroyed` |  |
| `COC_Wolfswap_R1` | 0% | 0% | `mc_lower_than_self` | COC_Wolfswap_R1 held back — Opponent’s MC was not lo |
| `COC_CAW777_Founder_E1` | 0% | 2% | `first_debuff_targeting_side` = mc_ends_in_7 | First debuff target does not end with mc_ends_in_7 |
| `COC_Clove_R3` | 0% | 2% | `not_has_tags` = Event | Tag 'Event' found, should not be present |
| `COC_RR_Founder_M1` | 0% | 2% | `COC_RR_M1_exploded` | COC_RR_M1_exploded (True) |
| `COC_Howlers_R2` | 0% | 5% | `count_tag_exact` = Lunar=3 | Not exactly 3 Projects with tag 'Lunar' |

## Zelden — onder de 20% (19 kaarten)

Werkt, maar vraagt een situatie die zelden ontstaat.

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_Cr00ts_M1` | 2% | 5% | `enemy_destroyed_count` = >=3 | Fewer than >=3 enemy Projects destroyed |
| `COC_CAW777_M1` | 2% | 10% | `projects_with_7_mc` = >=2 | Fewer than >=2 Projects with MC ending in 7 |
| `COC_Lionel_C2` | 5% | 5% | `project_targeted_by_debuff` | COC_Lionel_C2 skipped: No friendly Project was targe |
| `COC_Cr00ts_R2` | 5% | 12% | `first_debuff_targeting_project` | Armed — waiting for the first debuff |
| `COC_CAW777_Founder_R1` | 5% | 22% | `mc_multiple` = 7 | Total MC = 101.0, not divisible by 7 |
| `COC_CAW777_C1` | 8% | 5% | `total_mc_ends_in` = 7 | Total MC ends on 8, needed 7 |
| `COC_DAK_R3` | 8% | 10% | `project_count` = 3 | Does not have exactly 3 Projects after Counter Phase |
| `COC_CAW777_R1` | 8% | 12% | `survivor_count_eq` = 3 | survivor_count_eq (3) |
| `COC_CF_C1` | 8% | 12% | `not_has_tags` = Influencer | Tag 'Influencer' found, should not be present |
| `COC_CF_C2` | 8% | 12% | `targeted_by_debuff` | COC_CF_C2 skipped (Not targeted by debuff) |
| `COC_Cr00ts_Founder_M1` | 8% | 15% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_CAW777_E1` | 10% | 10% | `total_mc_mod` = 7 | total_mc_mod (7) |
| `COC_Wolfswap_Founder_M1` | 10% | 12% | `destroyed_friendly_count` = ≥2 | destroyed_friendly_count (≥2) |
| `COC_CAW777_Founder_M1` | 10% | 15% | `own_projects_mc_end_7` = >=2 | own_projects_mc_end_7 (>=2) |
| `COC_CAW777_Founder_L1` | 12% | 15% | `survivor_count_eq` = 3 | survivor_count_eq (3) |
| `COC_DAK_E2` | 12% | 18% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_CM_M1` | 15% | 15% | `projects_destroyed_count` = >=3 | Player 2’s COC_CM_M1 — not enough destroyed cards |
| `COC_Nova_R3` | 18% | 10% | `nova_destroyed` | No Nova Projects were destroyed |
| `COC_FFS_C3` | 18% | 40% | `is_lowest_mc_in_deck` | COC_FFS_C3 is not the lowest MC Project in deck |

## Soms — 20 tot 60% (36 kaarten)

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_DAK_Founder_M1` | 20% | 12% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_DAK_L1` | 20% | 12% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_EVT_Chain_Reaction` | 20% | 28% | `cards_destroyed >= 2` | cards_destroyed >= 2 (True) |
| `COC_RR_L1` | 22% | 10% | `own_destroyed_count` = >=2 | own_destroyed_count (>=2) |
| `COC_Wolfswap_Founder_E1` | 22% | 20% | `destroyed_friendly_count` = ≥2 | destroyed_friendly_count (≥2) |
| `COC_Lionel_R2` | 25% | 45% | `enemy_project_destroyed_once` | No enemy Project has been destroyed yet |
| `COC_DAK_Founder_L1` | 28% | 8% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_CF_M1` | 28% | 18% | `more_projects_than_opponent` | COC_CF_M1 skipped (Not more Projects than opponent) |
| `COC_RR_Founder_E1` | 28% | 18% | `own_destroyed_count` = >=2 | own_destroyed_count (>=2) |
| `COC_CM_Founder_M1` | 30% | 10% | `projects_destroyed_count` = >=3 | Less than required Projects destroyed (>=3) |
| `COC_INF_21Million_E1` | 30% | 25% | `first_debuff_targeting_project` | Armed — waiting for the first debuff |
| `COC_DAK_M1` | 32% | 5% | `projects_destroyed` = >=3 | projects_destroyed (>=3) |
| `COC_FFS_M1` | 32% | 10% | `total_team_mc_lt_opponent` | Your total MC is not lower than opponent |
| `COC_Howlers_C3` | 32% | 35% | `is_lowest_mc_card` | COC_Howlers_C3 is not the lowest MC Project |
| `COC_Nova_C3` | 32% | 38% | `is_lowest` | ⬇ Not your lowest MC Project |
| `COC_CAW777_E2` | 38% | 35% | `event_card_count` = 3 | Player 2 does not have exactly 3 Event cards |
| `COC_Cr00ts_C1` | 38% | 57% | `survives_debuff` | survives_debuff (True) |
| `COC_Wolfswap_Founder_C1` | 40% | 35% | `first_friendly_destroyed` | No friendly Project was the first to be destroyed |
| `COC_RR_Founder_L1` | 40% | 38% | `enemy_destroyed_count` = >=1 | Fewer than >=1 enemy Projects destroyed |
| `COC_CM_Founder_E1` | 40% | 57% | `own_mc_loss_count` = >=2 | Fewer than >=2 own Projects lost MC |
| `COC_Wolfswap_C2` | 42% | 10% | `destroyed_friendly_wolfswap` | destroyed_friendly_wolfswap (True) |
| `COC_Nova_E2` | 42% | 55% | `enemy_highest_mc_gte` = 35 | Enemy’s highest Project MC not ≥ 35 |
| `COC_COM_Curry_E1` | 45% | 35% | `first_debuff_targeting_project` | Armed — waiting for the first debuff |
| `COC_Cr00ts_Founder_L1` | 48% | 5% | `cr00ts_destroyed_count` = >=1 | cr00ts_destroyed_count (>=1) |
| `COC_DAK_C1` | 48% | 50% | `self_debuffed` | self_debuffed (True) |
| `COC_Nova_Founder_E1` | 50% | 5% | `nova_destroyed` | ↳   Skipping add_mc: COC_Nova_Founder_E1 is not a Pr |
| `COC_COM_Vinz_L1` | 50% | 40% | `rarity` = Legendary | No Project with rarity 'Legendary' on your field |
| `COC_Lionel_C1` | 52% | 42% | `mc_less_than_equal` = 15 | COC_Lionel_C1 MC 18.0 is not ≤ 15 |
| `COC_EVT_Market_Whisper` | 52% | 62% | `total_mc < opponent` | Player 2 MC is not lower than opponent |
| `COC_Nova_R2` | 52% | 85% | `count_rarity` = Rare ≥ 2 | count_rarity (Rare ≥ 2) |
| `COC_COM_Vinz_R1` | 55% | 32% | `own_projects_under_mc_gte` = 20 | Need at least 3 Projects under 20 MC |
| `COC_INF_Francis_E1` | 55% | 57% | `mc_lt_opponent` | Player 2 MC is not lower than opponent |
| `COC_CAW777_C2` | 55% | 72% | `self_mc_lte` = 7 | self_mc_lte (7) |
| `COC_Wolfswap_L1` | 57% | 20% | `enemy_destroyed_count` = ≥2 | Fewer than ≥2 enemy Projects destroyed |
| `COC_Clove_C1` | 57% | 60% | `has_tag` = Community | COC_Clove_C1 lacks tag 'Community' |
| `COC_Howlers_C2` | 57% | 65% | `total_mc_lt_opponent` | total_mc_lt_opponent (True) |

## Vaak — 60% of meer (165 kaarten)

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_DAK_R2` | 60% | 35% | `enemy_destroyed` | enemy_destroyed (True) |
| `COC_CM_C2` | 60% | 45% | `is_lowest_mc_card` | COC_CM_C2 is not the lowest MC Project |
| `COC_Wolfswap_E2` | 62% | 48% | `enemy_project_destroyed` | No enemy Projects destroyed |
| `COC_FFS_R1` | 62% | 50% | `loses_mc_from_effect` | loses_mc_from_effect (True) |
| `COC_CM_R3` | 62% | 52% | `any_card_destroyed` | any_card_destroyed (True) |
| `COC_RR_Founder_R1` | 62% | 52% | `on_project_destroyed` | No Project destroyed on your side |
| `COC_Cr00ts_E2` | 62% | 65% | `targeted_by_debuff` | COC_Cr00ts_E2 skipped (Not targeted by debuff) |
| `COC_Nova_C2` | 65% | 70% | `tag_on_field` = Community | No tag 'Community' found on field |
| `COC_DAK_C3` | 65% | 82% | `survived` |  |
| `COC_Cr00ts_L1` | 65% | 92% | `final_calc` = enemy_lt_20 | Final condition not met: enemy_lt_20 |
| `COC_INF_21Million_R1` | 68% | 88% | `own_rarity` = Rare | No Projects of rarity 'rare' found on your field |
| `COC_Nova_Founder_M1` | 70% | 30% | `unique_rarity_count_gte` = 4 | ↳   Skipping add_mc: COC_Nova_Founder_M1 is not a Pr |
| `COC_Clove_R2` | 70% | 57% | `count_rarity` = Rare | count_rarity (Rare) |
| `COC_FFS_Founder_M1` | 70% | 65% | `own_projects_lost_mc` = >=3 | Not enough of your Projects lost MC due to effects ( |
| `COC_CAW777_R3` | 70% | 68% | `any_mc_ends_in` = 7 | No Project on field ends with MC 7 |
| `COC_CM_E2` | 70% | 75% | `own_debuffed_count` = >=2 | Fewer than >=2 own Projects were debuffed |
| `COC_CM_C3` | 70% | 95% | `none` |  |
| `COC_EVT_Buy_the_Dip` | 72% | 72% | `lost_mc_due_to_effect` = 0 | MC loss condition not met (0 required) |
| `COC_Wolfswap_Founder_L1` | 78% | 42% | `destroyed_enemy_by_friendly` | destroyed_enemy_by_friendly (True) |
| `COC_FFS_L1` | 78% | 80% | `own_projects_lost_mc` = >=2 | Not enough of your Projects lost MC due to effects ( |
| `COC_FFS_C1` | 80% | 78% | `other_projects_lose_mc` |  |
| `COC_FFS_Founder_E1` | 80% | 80% | `cards_lost_mc` = >=2 | cards_lost_mc (>=2) |
| `COC_Lionel_M1` | 80% | 92% | `final_calc_survivors` = >=4 |  |
| `COC_RR_C1` | 80% | 95% | `is_lowest_mc_in_deck` | COC_RR_C1 is not the lowest MC Project in deck |
| `COC_Howlers_Founder_R1` | 82% | 68% | `mc_range` = <10_and_>30 | mc_range (<10_and_>30) |
| `COC_Clove_E1` | 82% | 82% | `count_tag` = Community | No Projects with tag 'Community' found |
| `COC_RR_Founder_C1` | 82% | 82% | `lowest_project_mc_lt` = 10 | lowest_project_mc_lt (10) |
| `COC_Wolfswap_R2` | 82% | 82% | `lowest_friendly_and_enemy_exist` | lowest_friendly_and_enemy_exist (True) |
| `COC_Nova_Founder_C1` | 85% | 10% | `count_card_rarity` = common_nova_>=2 | ↳   Skipping add_mc: COC_Nova_Founder_C1 is not a Pr |
| `COC_CAW777_L1` | 85% | 65% | `lowest_mc_lte` = 7 | lowest_mc_lte (7) |
| `COC_Lionel_E1` | 85% | 75% | `survived_destruction_count` = >=2 |  |
| `COC_CF_R2` | 85% | 88% | `own_card_debuffed` |  |
| `COC_Nova_Founder_R1` | 85% | 90% | `project_mc_lt` = 10 | ↳   Skipping add_mc: COC_Nova_Founder_R1 is not a Pr |
| `COC_CAW777_C3` | 88% | 65% | `survives_destruction` |  |
| `COC_Lionel_R1` | 88% | 90% | `control_card_count` = Common >= 2 | Need common >= 2 on field; have 1 |
| `COC_EVT_FUD` | 88% | 92% | `mc_gte` = 20 | Player 2’s COC_EVT_FUD — is disabled and cannot trig |
| `COC_Cr00ts_Founder_R1` | 88% | 95% | `project_debuffed` | COC_Cr00ts_Founder_R1 skipped: No friendly Projects  |
| `COC_COM_Vinz_M1` | 90% | 90% | `support_same_rarity` | support_same_rarity (True) |
| `COC_Cr00ts_E1` | 92% | 85% | `survived` |  |
| `COC_Lionel_L1` | 92% | 88% | `final_calc` = lowest_survivor |  |
| `COC_DAK_E1` | 92% | 90% | `enemy_project_mc_lt` = 20 | No enemy Project MC below 20 |
| `COC_FFS_E1` | 92% | 90% | `any_project_takes_damage` |  |
| `COC_Howlers_M1` | 92% | 90% | `none` |  |
| `COC_FFS_E2` | 92% | 92% | `enemy_mc_lt_self` | enemy_mc_lt_self (True) |
| `COC_Wolfswap_E1` | 92% | 92% | `enemy_has_rarity` = Epic | ↳   COC_Wolfswap_E1 skipped — no valid targets. |
| `COC_EVT_Flash_Crash` | 92% | 98% | `mc_gte` = 20 | No Projects with MC ≥ 20 found |
| `COC_CF_E1` | 92% | 100% | `none` |  |
| `COC_Howlers_FounderL1` | 95% | 82% | `has_all_rarities` | Armed — waiting for the first debuff |
| `COC_CF_R3` | 95% | 98% | `in_play` |  |
| `COC_Lionel_E2` | 95% | 98% | `first_debuff` |  |
| `COC_Nova_C1` | 98% | 18% | `tag_on_field` = Nova ≥ 2 |  |
| `COC_RR_R1` | 98% | 45% | `deck_tag_count` = Machine >= 2 |  |
| `COC_CM_R2` | 98% | 80% | `own_project_loses_mc` |  |
| `COC_CF_Founder_E1` | 98% | 82% | `hit_by_debuff` | hit_by_debuff (True) |
| `COC_Howlers_E1` | 98% | 92% | `enemy_has_two` |  |
| `COC_INF_21Million_C1` | 98% | 92% | `control_tag` = Meme | No own Project has tag 'Meme' |
| `COC_CM_R1` | 98% | 95% | `immediate` |  |
| `COC_Clove_E2` | 98% | 95% | `none` |  |
| `COC_INF_Pampa_L1` | 98% | 95% | `None` | Player 1’s COC_INF_Pampa_L1 — is disabled and cannot |
| `COC_Nova_R1` | 98% | 95% | `has_card_type` = Event | No card of type 'Event' found |
| `COC_RR_E2` | 98% | 95% | `enemy_has_projects` |  |
| `COC_EVT_Ding_Ding_Ding!` | 98% | 98% | `random_project` | Player 2’s COC_EVT_Ding_Ding_Ding! — is disabled and |
| `COC_EVT_Rug_Pull` | 98% | 98% | `None` | Player 2’s COC_EVT_Rug_Pull — is disabled and cannot |
| `COC_FFS_R2` | 98% | 98% | `always` |  |
| `COC_INF_21Million_L1` | 98% | 98% | `highest_own_buff` | Player 2’s COC_INF_21Million_L1 — is disabled and ca |
| `COC_COM_Curry_C1` | 98% | 100% | `control_project_cards` | Player 2’s COC_COM_Curry_C1 — is disabled and cannot |
| `COC_COM_Curry_M1` | 98% | 100% | `all_projects` | Player 1’s COC_COM_Curry_M1 — is disabled and cannot |
| `COC_COM_Curry_R1` | 98% | 100% | `card_type` = Project | Player 2’s COC_COM_Curry_R1 — is disabled and cannot |
| `COC_Cr00ts_R1` | 98% | 100% | `None` |  |
| `COC_Cr00ts_R3` | 98% | 100% | `during_debuff_phase` |  |
| `COC_EVT_Echo_of_the_Past` | 98% | 100% | `None` | Player 1’s COC_EVT_Echo_of_the_Past — is disabled an |
| `COC_EVT_Forked_Reality` | 98% | 100% | `None` | Player 2’s COC_EVT_Forked_Reality — is disabled and  |
| `COC_EVT_Paper_Hands` | 98% | 100% | `lowest_own_exists` | Player 2’s COC_EVT_Paper_Hands — is disabled and can |
| `COC_EVT_Protocol_Reset` | 98% | 100% | `always` | Player 2’s COC_EVT_Protocol_Reset — is disabled and  |
| `COC_EVT_Seismic_Rebalance` | 98% | 100% | `None` | Player 2’s COC_EVT_Seismic_Rebalance — is disabled a |
| `COC_EVT_Whale_Games` | 98% | 100% | `None` | ↳   COC_EVT_Whale_Games skipped — no valid targets. |
| `COC_FFS_C2` | 98% | 100% | `always` |  |
| `COC_Howlers_Founder_E1` | 98% | 100% | `valid` | valid (True) |
| `COC_INF_Francis_R1` | 98% | 100% | `enemy_highest_mc` | Player 1’s COC_INF_Francis_R1 — is disabled and cann |
| `COC_Lionel_Founder_R1` | 98% | 100% | `project_debuffed` | COC_Lionel_Founder_R1 skipped: No friendly Projects  |
| `COC_Wolfswap_M1` | 98% | 100% | `enemy_projects_count` = >=1 |  |
| `COC_Clove_Founder_L1` | 100% | 2% | `has_tag_count` = Clove:2 |  |
| `COC_Clove_L1` | 100% | 2% | `has_card_on_field` = Clove_Founder |  |
| `COC_Howlers_C1` | 100% | 8% | `tags_match` = lowest_highest=Lunar |  |
| `COC_CF_E2` | 100% | 10% | `card_on_field` = Crooks Founder |  |
| `COC_CF_R1` | 100% | 10% | `count_tag_on_field` = Crooks >= 3 |  |
| `COC_Clove_R1` | 100% | 12% | `has_card_on_field` = Clove_Founder |  |
| `COC_Howlers_Founder_C1` | 100% | 22% | `count_tag` = Lunar>=3 |  |
| `COC_EVT_Gas_War` | 100% | 25% | `not_has_tags` = Influencer | ↳   COC_EVT_Gas_War skipped — no valid targets. |
| `COC_COM_Vinz_E1` | 100% | 95% | `tag` = Meme |  |
| `COC_EVT_Market_Correction` | 100% | 95% | `none` | Player 2’s COC_EVT_Market_Correction — is disabled a |
| `COC_INF_Pampa_C1` | 100% | 95% | `None` |  |
| `COC_INF_Pampa_M1` | 100% | 95% | `each_enemy_project` |  |
| `COC_Nova_L1` | 100% | 95% | `rarity_count` = >= 3 |  |
| `COC_CM_Founder_R1` | 100% | 98% | `causes_mc_loss` |  |
| `COC_COM_Vinz_C1` | 100% | 98% | `lowest_mc_project` = self | Player 1’s COC_COM_Vinz_C1 — is disabled and cannot  |
| `COC_EVT_All_Time_High` | 100% | 98% | `None` |  |
| `COC_EVT_Bear_Market` | 100% | 98% | `None` | Player 1’s COC_EVT_Bear_Market — is disabled and can |
| `COC_EVT_Bull_Market` | 100% | 98% | `None` |  |
| `COC_EVT_High_risk_high_reward` | 100% | 98% | `none` | Player 2’s COC_EVT_High_risk_high_reward — is disabl |
| `COC_EVT_Rekt_Week` | 100% | 98% | `None` |  |
| `COC_Howlers_E2` | 100% | 98% | `None` |  |
| `COC_Nova_E1` | 100% | 98% | `has_tag` = Nova |  |
| `COC_RR_R2` | 100% | 98% | `None` |  |
| `COC_CAW777_Founder_C1` | 100% | 100% | `none` | ↳   COC_CAW777_Founder_C1 skipped — no valid targets |
| `COC_CAW777_R2` | 100% | 100% | `immediate` |  |
| `COC_CF_C3` | 100% | 100% | `none` |  |
| `COC_CF_Founder_C1` | 100% | 100% | `None` |  |
| `COC_CF_Founder_L1` | 100% | 100% | `none` |  |
| `COC_CF_Founder_M1` | 100% | 100% | `first_debuff` |  |
| `COC_CF_Founder_R1` | 100% | 100% | `first_debuff` |  |
| `COC_CF_L1` | 100% | 100% | `different_card_types` = count |  |
| `COC_CM_E1` | 100% | 100% | `none` |  |
| `COC_CM_Founder_C1` | 100% | 100% | `own_project_destroyed` |  |
| `COC_CM_Founder_L1` | 100% | 100% | `own_project_destroyed` |  |
| `COC_CM_L1` | 100% | 100% | `random_common_own_exists` |  |
| `COC_COM_Curry_L1` | 100% | 100% | `none` |  |
| `COC_Clove_C2` | 100% | 100% | `none` |  |
| `COC_Clove_Founder_C1` | 100% | 100% | `has_mc_below` = 10 | ↳   COC_Clove_Founder_C1 skipped — no valid targets. |
| `COC_Clove_Founder_E1` | 100% | 100% | `first_debuff_hit` = Project |  |
| `COC_Clove_Founder_M1` | 100% | 100% | `none` | ↳   COC_Clove_Founder_M1 skipped — no valid targets. |
| `COC_Clove_Founder_R1` | 100% | 100% | `has_card_type` = Event |  |
| `COC_Clove_M1` | 100% | 100% | `limit_loss` |  |
| `COC_Cr00ts_C3` | 100% | 100% | `None` | ↳   COC_Cr00ts_C3 rallied the Cr00ts, but no Common  |
| `COC_Cr00ts_Founder_C1` | 100% | 100% | `start_of_match` | ↳   COC_Cr00ts_Founder_C1 rallied the Cr00ts, but no |
| `COC_DAK_C2` | 100% | 100% | `coin_flip` |  |
| `COC_DAK_Founder_C1` | 100% | 100% | `tag_on_field` = Ape |  |
| `COC_DAK_Founder_E1` | 100% | 100% | `first_destruction_attempt` |  |
| `COC_DAK_Founder_R1` | 100% | 100% | `own_project_destroyed` |  |
| `COC_DAK_R1` | 100% | 100% | `none` |  |
| `COC_EVT_Boost_of_Faith` | 100% | 100% | `None` |  |
| `COC_EVT_DeFi_Summer` | 100% | 100% | `count_rarity_in_deck` = Rare_or_Epic >= 2 | Player 2’s COC_EVT_DeFi_Summer — is disabled and can |
| `COC_EVT_Diamond_Hands` | 100% | 100% | `highest_immune` | Player 1’s COC_EVT_Diamond_Hands — is disabled and c |
| `COC_EVT_FOMO` | 100% | 100% | `mc_less_than` = 15 | ↳   COC_EVT_FOMO skipped — no valid targets. |
| `COC_EVT_Liquidity_Crisis` | 100% | 100% | `mc_between` = 15,30 | Player 1’s COC_EVT_Liquidity_Crisis — is disabled an |
| `COC_EVT_Market_Surge` | 100% | 100% | `None` |  |
| `COC_EVT_Minor_Glitch` | 100% | 100% | `None` | Player 2’s COC_EVT_Minor_Glitch — is disabled and ca |
| `COC_EVT_Pump_&_Dump` | 100% | 100% | `None` |  |
| `COC_FFS_Founder_C1` | 100% | 100% | `own_project_lost_mc` | ↳   COC_FFS_Founder_C1 skipped — no valid targets. |
| `COC_FFS_Founder_L1` | 100% | 100% | `any_card_mc_lt` = 5 |  |
| `COC_FFS_Founder_R1` | 100% | 100% | `meme_tagged` | ↳   Skipping add_mc: COC_FFS_Founder_R1 is not a Pro |
| `COC_FFS_R3` | 100% | 100% | `none` |  |
| `COC_Howlers_Founder_M1` | 100% | 100% | `after_all_resolve` |  |
| `COC_Howlers_R1` | 100% | 100% | `none` | self_mc_lte (7) |
| `COC_Howlers_R3` | 100% | 100% | `highest_mc_project` = any | ↳   Player 1’s COC_Howlers_R3 effects are disabled. |
| `COC_INF_Francis_C1` | 100% | 100% | `enemy_has_projects` | Player 1’s COC_INF_Francis_C1 — is disabled and cann |
| `COC_INF_Francis_L1` | 100% | 100% | `None` | ↳   COC_INF_Francis_L1 disables Player 1’s Support C |
| `COC_INF_Francis_M1` | 100% | 100% | `None` |  |
| `COC_INF_Pampa_E1` | 100% | 100% | `own_project_destroyed` | Player 1’s COC_INF_Pampa_E1 — is disabled and cannot |
| `COC_INF_Pampa_R1` | 100% | 100% | `none` | Player 1’s COC_INF_Pampa_R1 — is disabled and cannot |
| `COC_Lionel_C3` | 100% | 100% | `lowest_mc_project` |  |
| `COC_Lionel_Founder_C1` | 100% | 100% | `control_card_count` = 1,Project | ↳   COC_Lionel_Founder_C1 skipped — no valid targets |
| `COC_Lionel_Founder_E1` | 100% | 100% | `destruction_attempt` = first |  |
| `COC_Lionel_Founder_L1` | 100% | 100% | `final_calc_survivors` = >=2 |  |
| `COC_Lionel_Founder_M1` | 100% | 100% | `projects_destroyed_count` = 0 | ↳   COC_Lionel_Founder_M1 skipped — no valid targets |
| `COC_Lionel_R3` | 100% | 100% | `none` |  |
| `COC_Nova_Founder_L1` | 100% | 100% | `target_nova_project` = any | ↳   Skipping add_mc: COC_Nova_Founder_L1 is not a Pr |
| `COC_Nova_M1` | 100% | 100% | `none` |  |
| `COC_RR_C2` | 100% | 100% | `coin_flip` |  |
| `COC_RR_E1` | 100% | 100% | `deck_tag` = Machine |  |
| `COC_RR_M1` | 100% | 100% | `None` = 0.1 | COC_RR_M1_exploded (True) |
| `COC_Wolfswap_C3` | 100% | 100% | `destruction_targeting` |  |
| `COC_Wolfswap_Founder_R1` | 100% | 100% | `effect_targeted_highest` |  |
| `COC_Wolfswap_R3` | 100% | 100% | `effect_targeted_highest` |  |
| `COC_Zero_Day` | 100% | 100% | `None` |  |
