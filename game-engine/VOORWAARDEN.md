# Hoe vaak slaagt de voorwaarde van elke kaart?

Elke kaart 30 keer gespeeld in een willekeurig deck en 30 keer in een deck
van dezelfde factie. Gesorteerd op het laagste percentage.

Totaal 14100 matches.


## Nooit (5 kaarten)

De voorwaarde slaagt in geen enkele match, ook niet met steun van de eigen factie.

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_CAW777_Founder_E1` | 0% | 0% | `first_debuff_targeting_side` = mc_ends_in_7 | First debuff target does not end with mc_ends_in_7 |
| `COC_CAW777_Founder_M1` | 0% | 0% | `own_projects_mc_end_7` = >=3 | own_projects_mc_end_7 (>=3) |
| `COC_EVT_Sideways_Chop` | 0% | 0% | `None` |  |
| `COC_INF_21Million_M1` | 0% | 0% | `control_all_rarities` | control_all_rarities (missing: Epic, Mythical) |
| `COC_Wolfswap_Founder_M1` | 0% | 0% | `destroyed_friendly_count` = ≥4 | destroyed_friendly_count (≥4) |

## Zelden — onder de 20% (5 kaarten)

Werkt, maar vraagt een situatie die zelden ontstaat.

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_EVT_Chain_Reaction` | 3% | 3% | `cards_destroyed >= 3` | Fewer than 3 cards destroyed |
| `COC_Cr00ts_Founder_M1` | 3% | 10% | `enemy_destroyed_count` = >=3 | Fewer than >=3 enemy Projects destroyed |
| `COC_DAK_Founder_M1` | 7% | 0% | `enemy_destroyed_count` = >=3 | Fewer than >=3 enemy Projects destroyed |
| `COC_Cr00ts_Founder_L1` | 13% | 0% | `cr00ts_destroyed_count` = >=2 | cr00ts_destroyed_count (>=2) |
| `COC_Wolfswap_Founder_E1` | 13% | 20% | `destroyed_friendly_count` = ≥2 | destroyed_friendly_count (≥2) |

## Soms — 20 tot 60% (12 kaarten)

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_CAW777_Founder_L1` | 20% | 23% | `survivor_count_eq` = 3 | survivor_count_eq (3) |
| `COC_INF_21Million_E1` | 30% | 33% | `first_debuff_targeting_project` | Armed — waiting for the first debuff |
| `COC_Wolfswap_Founder_C1` | 30% | 40% | `first_friendly_destroyed` | No friendly Project was the first to be destroyed |
| `COC_CM_Founder_M1` | 33% | 7% | `projects_destroyed_count` = >=3 | Less than required Projects destroyed (>=3) |
| `COC_RR_Founder_M1` | 33% | 7% | `COC_RR_M1_exploded` | COC_RR_M1_exploded (True) |
| `COC_DAK_Founder_L1` | 37% | 13% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_CM_Founder_E1` | 37% | 53% | `own_mc_loss_count` = >=2 | Fewer than >=2 own Projects lost MC |
| `COC_COM_Curry_E1` | 40% | 43% | `first_debuff_targeting_project` | Armed — waiting for the first debuff |
| `COC_Nova_Founder_E1` | 43% | 3% | `nova_destroyed` | No Nova Projects were destroyed |
| `COC_COM_Vinz_L1` | 50% | 50% | `rarity` = Legendary | No Project with rarity 'Legendary' on your field |
| `COC_EVT_Market_Whisper` | 53% | 60% | `total_mc < opponent` | Player 2 MC is not lower than opponent |
| `COC_COM_Vinz_R1` | 57% | 50% | `own_projects_under_mc_gte` = 20 | Need at least 3 Projects under 20 MC |

## Vaak — 60% of meer (213 kaarten)

| kaart | op maat | willekeurig | voorwaarde | reden dat het niet lukt |
|---|---|---|---|---|
| `COC_EVT_Buy_the_Dip` | 67% | 77% | `lost_mc_due_to_effect` = 0 | MC loss condition not met (0 required) |
| `COC_Nova_Founder_M1` | 70% | 27% | `unique_rarity_count_gte` = 4 | ↳   Skipping add_mc: COC_Nova_Founder_M1 is not a Pr |
| `COC_RR_Founder_E1` | 73% | 27% | `own_destroyed_count` = >=2 | own_destroyed_count (>=2) |
| `COC_FFS_Founder_M1` | 73% | 57% | `own_projects_lost_mc` = >=3 | Not enough of your Projects lost MC due to effects ( |
| `COC_Cr00ts_Founder_E1` | 73% | 73% | `first_enemy_debuff` | Armed — waiting for the first debuff |
| `COC_RR_Founder_L1` | 80% | 43% | `enemy_destroyed_count` = >=1 | Fewer than >=1 enemy Projects destroyed |
| `COC_INF_Francis_E1` | 80% | 77% | `mc_lt_opponent` | Player 1 MC is not lower than opponent |
| `COC_FFS_Founder_E1` | 80% | 83% | `cards_lost_mc` = >=2 | cards_lost_mc (>=2) |
| `COC_INF_21Million_R1` | 80% | 90% | `own_rarity` = Rare | No Projects of rarity 'rare' found on your field |
| `COC_EVT_FUD` | 80% | 97% | `mc_gte` = 20 | Player 2’s COC_EVT_FUD — is disabled and cannot trig |
| `COC_RR_Founder_R1` | 83% | 60% | `on_project_destroyed` | No Project destroyed on your side |
| `COC_Howlers_Founder_R1` | 83% | 63% | `mc_range` = <10_and_>30 | mc_range (<10_and_>30) |
| `COC_CAW777_Founder_R1` | 83% | 77% | `mc_multiple` = 7 | Total MC = 88.0, not divisible by 7 |
| `COC_CAW777_M1` | 83% | 97% | `projects_with_7_mc` = >=3 | Fewer than >=3 Projects with MC ending in 7 |
| `COC_Nova_Founder_C1` | 87% | 10% | `count_card_rarity` = common_nova_>=2 | ↳   Skipping add_mc: COC_Nova_Founder_C1 is not a Pr |
| `COC_Wolfswap_Founder_L1` | 87% | 40% | `destroyed_enemy_by_friendly` | destroyed_enemy_by_friendly (True) |
| `COC_CAW777_E1` | 87% | 93% | `total_mc_mod` = 7 | total_mc_mod (7) |
| `COC_Cr00ts_R2` | 87% | 97% | `first_debuff_targeting_project` | Armed — waiting for the first debuff |
| `COC_RR_Founder_C1` | 90% | 87% | `lowest_project_mc_lt` = 10 | lowest_project_mc_lt (10) |
| `COC_COM_Vinz_M1` | 90% | 90% | `support_same_rarity` | support_same_rarity (True) |
| `COC_Nova_Founder_R1` | 90% | 90% | `project_mc_lt` = 10 | ↳   Skipping add_mc: COC_Nova_Founder_R1 is not a Pr |
| `COC_DAK_R3` | 90% | 93% | `project_count` = 3 | Does not have exactly 3 Projects after Counter Phase |
| `COC_Howlers_R2` | 90% | 93% | `count_tag_exact` = Lunar=3 | Not exactly 3 Projects with tag 'Lunar' |
| `COC_DAK_L1` | 90% | 97% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_EVT_Flash_Crash` | 90% | 100% | `mc_gte` = 20 | No Projects with MC ≥ 20 found |
| `COC_Howlers_FounderL1` | 93% | 77% | `has_all_rarities` | Not all rarities present |
| `COC_Cr00ts_E2` | 93% | 87% | `targeted_by_debuff` | COC_Cr00ts_E2 skipped (Not targeted by debuff) |
| `COC_Howlers_L1` | 93% | 90% | `exact_rarity_mix` = Common:1,Rare:1,Epic:1,Legendary:1,Mythical:1 | Player 1 does not have exact rarity mix: Common:1,Ra |
| `COC_Wolfswap_R1` | 93% | 93% | `mc_lower_than_self` | COC_Wolfswap_R1 held back — Opponent’s MC was not lo |
| `COC_Lionel_R2` | 93% | 100% | `enemy_project_destroyed_once` | No enemy Project has been destroyed yet |
| `COC_CF_Founder_E1` | 97% | 83% | `hit_by_debuff` | ↳   Skipping add_mc: COC_CF_Founder_E1 is not a Proj |
| `COC_Cr00ts_M1` | 97% | 90% | `enemy_destroyed_count` = >=3 | Fewer than >=3 enemy Projects destroyed |
| `COC_FFS_R1` | 97% | 90% | `loses_mc_from_effect` | loses_mc_from_effect (True) |
| `COC_CM_M1` | 97% | 93% | `projects_destroyed_count` = >=3 | Player 2’s COC_CM_M1 — not enough destroyed cards |
| `COC_DAK_E2` | 97% | 93% | `enemy_destroyed_count` = >=2 | Fewer than >=2 enemy Projects destroyed |
| `COC_INF_21Million_C1` | 97% | 93% | `control_tag` = Meme | No own Project has tag 'Meme' |
| `COC_Wolfswap_L1` | 97% | 93% | `enemy_destroyed_count` = ≥2 | Fewer than ≥2 enemy Projects destroyed |
| `COC_CF_C1` | 97% | 97% | `not_has_tags` = Influencer | Tag 'Influencer' found, should not be present |
| `COC_Clove_C3` | 97% | 97% | `is_only_rarity` = Common | Player 1 does not have only 'Common' rarity |
| `COC_Cr00ts_Founder_R1` | 97% | 97% | `project_debuffed` | COC_Cr00ts_Founder_R1 skipped: No friendly Projects  |
| `COC_DAK_E1` | 97% | 97% | `enemy_project_mc_lt` = 20 | No enemy Project MC below 20 |
| `COC_EVT_Ding_Ding_Ding!` | 97% | 97% | `random_project` | Player 2’s COC_EVT_Ding_Ding_Ding! — is disabled and |
| `COC_FFS_M1` | 97% | 97% | `total_team_mc_lt_opponent` | Your total MC is not lower than opponent |
| `COC_INF_Pampa_L1` | 97% | 97% | `None` | Player 1’s COC_INF_Pampa_L1 — is disabled and cannot |
| `COC_Nova_R3` | 97% | 97% | `nova_destroyed` | No Nova Projects were destroyed |
| `COC_CF_M1` | 97% | 100% | `more_projects_than_opponent` | COC_CF_M1 skipped (Not more Projects than opponent) |
| `COC_CM_E2` | 97% | 100% | `own_debuffed_count` = >=2 | Fewer than >=2 own Projects were debuffed |
| `COC_COM_Curry_L1` | 97% | 100% | `none` | Player 2’s COC_COM_Curry_L1 — is disabled and cannot |
| `COC_EVT_FOMO` | 97% | 100% | `mc_less_than` = 15 | Player 1’s COC_EVT_FOMO — is disabled and cannot tri |
| `COC_EVT_Forked_Reality` | 97% | 100% | `None` | Player 2’s COC_EVT_Forked_Reality — is disabled and  |
| `COC_EVT_Paper_Hands` | 97% | 100% | `lowest_own_exists` | Player 2’s COC_EVT_Paper_Hands — is disabled and can |
| `COC_EVT_Protocol_Reset` | 97% | 100% | `always` | Player 2’s COC_EVT_Protocol_Reset — is disabled and  |
| `COC_EVT_Seismic_Rebalance` | 97% | 100% | `None` | Player 2’s COC_EVT_Seismic_Rebalance — is disabled a |
| `COC_EVT_Whale_Games` | 97% | 100% | `None` | ↳   COC_EVT_Whale_Games skipped — no valid targets. |
| `COC_Howlers_Founder_E1` | 97% | 100% | `valid` | valid (True) |
| `COC_INF_21Million_L1` | 97% | 100% | `highest_own_buff` | Player 2’s COC_INF_21Million_L1 — is disabled and ca |
| `COC_INF_Francis_R1` | 97% | 100% | `enemy_highest_mc` | Player 1’s COC_INF_Francis_R1 — is disabled and cann |
| `COC_Nova_E2` | 97% | 100% | `enemy_highest_mc_gte` = 35 | Enemy’s highest Project MC not ≥ 35 |
| `COC_Clove_Founder_L1` | 100% | 3% | `has_tag_count` = Clove:2 |  |
| `COC_Howlers_Founder_C1` | 100% | 23% | `count_tag` = Lunar>=3 |  |
| `COC_EVT_Gas_War` | 100% | 27% | `not_has_tags` = Influencer | ↳   COC_EVT_Gas_War skipped — no valid targets. |
| `COC_CF_E2` | 100% | 80% | `card_on_field` = Crooks Founder |  |
| `COC_Clove_L1` | 100% | 90% | `has_card_on_field` = Clove_Founder |  |
| `COC_CAW777_L1` | 100% | 93% | `lowest_mc_lte` = 7 | lowest_mc_lte (7) |
| `COC_CAW777_R1` | 100% | 93% | `survivor_count_eq` = 3 | survivor_count_eq (3) |
| `COC_CF_C2` | 100% | 93% | `targeted_by_debuff` | COC_CF_C2 skipped (Not targeted by debuff) |
| `COC_Clove_R1` | 100% | 93% | `has_card_on_field` = Clove_Founder |  |
| `COC_DAK_M1` | 100% | 93% | `projects_destroyed` = >=3 | projects_destroyed (>=3) |
| `COC_EVT_Market_Correction` | 100% | 93% | `none` |  |
| `COC_Lionel_R1` | 100% | 93% | `control_card_count` = Common >= 2 | Condition met |
| `COC_RR_L1` | 100% | 93% | `own_destroyed_count` = >=2 | own_destroyed_count (>=2) |
| `COC_RR_R3` | 100% | 93% | `on_destroyed` | COC_RR_R3 was not destroyed — effect requires destru |
| `COC_CF_R1` | 100% | 97% | `count_tag_on_field` = Crooks >= 3 |  |
| `COC_CM_Founder_R1` | 100% | 97% | `causes_mc_loss` |  |
| `COC_COM_Vinz_E1` | 100% | 97% | `tag` = Meme |  |
| `COC_Clove_R2` | 100% | 97% | `count_rarity` = Rare | count_rarity (Rare) |
| `COC_Clove_R3` | 100% | 97% | `not_has_tags` = Event | Tag 'Event' found, should not be present |
| `COC_Cr00ts_C2` | 100% | 97% | `on_destroyed` | COC_Cr00ts_C2 was not destroyed — effect requires de |
| `COC_DAK_R2` | 100% | 97% | `enemy_destroyed` | enemy_destroyed (True) |
| `COC_EVT_All_Time_High` | 100% | 97% | `None` |  |
| `COC_EVT_Bear_Market` | 100% | 97% | `None` | Player 1’s COC_EVT_Bear_Market — is disabled and can |
| `COC_EVT_Bull_Market` | 100% | 97% | `None` |  |
| `COC_EVT_High_risk_high_reward` | 100% | 97% | `none` | Player 2’s COC_EVT_High_risk_high_reward — is disabl |
| `COC_EVT_Rekt_Week` | 100% | 97% | `None` |  |
| `COC_EVT_Rug_Pull` | 100% | 97% | `None` |  |
| `COC_FFS_C3` | 100% | 97% | `is_lowest_mc_in_deck` | COC_FFS_C3 is not the lowest MC Project in deck |
| `COC_INF_Pampa_C1` | 100% | 97% | `None` |  |
| `COC_INF_Pampa_M1` | 100% | 97% | `each_enemy_project` |  |
| `COC_Nova_C2` | 100% | 97% | `tag_on_field` = Community | No tag 'Community' found on field |
| `COC_Wolfswap_C2` | 100% | 97% | `destroyed_friendly_wolfswap` | destroyed_friendly_wolfswap (True) |
| `COC_CAW777_C1` | 100% | 100% | `total_mc_ends_in` = 7 | Total MC ends on 2, needed 7 |
| `COC_CAW777_C2` | 100% | 100% | `self_mc_eq` = 7 | COC_CAW777_C2 MC is not exactly 7 |
| `COC_CAW777_C3` | 100% | 100% | `survives_destruction` |  |
| `COC_CAW777_E2` | 100% | 100% | `event_card_count` = 3 | Player 2 does not have exactly 3 Event cards |
| `COC_CAW777_Founder_C1` | 100% | 100% | `none` | ↳   COC_CAW777_Founder_C1 skipped — no valid targets |
| `COC_CAW777_R2` | 100% | 100% | `immediate` |  |
| `COC_CAW777_R3` | 100% | 100% | `any_mc_ends_in` = 7 | No Project on field ends with MC 7 |
| `COC_CF_C3` | 100% | 100% | `none` |  |
| `COC_CF_E1` | 100% | 100% | `none` |  |
| `COC_CF_Founder_C1` | 100% | 100% | `None` |  |
| `COC_CF_Founder_L1` | 100% | 100% | `none` |  |
| `COC_CF_Founder_M1` | 100% | 100% | `first_debuff` |  |
| `COC_CF_Founder_R1` | 100% | 100% | `first_debuff` |  |
| `COC_CF_L1` | 100% | 100% | `different_card_types` = count |  |
| `COC_CF_R2` | 100% | 100% | `own_card_debuffed` |  |
| `COC_CF_R3` | 100% | 100% | `in_play` |  |
| `COC_CM_C1` | 100% | 100% | `on_destroyed` | COC_CM_C1 was not destroyed — effect requires destru |
| `COC_CM_C2` | 100% | 100% | `is_lowest_mc_card` | COC_CM_C2 is not the lowest MC Project |
| `COC_CM_C3` | 100% | 100% | `none` |  |
| `COC_CM_E1` | 100% | 100% | `none` |  |
| `COC_CM_Founder_C1` | 100% | 100% | `own_project_destroyed` |  |
| `COC_CM_Founder_L1` | 100% | 100% | `own_project_destroyed` |  |
| `COC_CM_L1` | 100% | 100% | `random_common_own_exists` |  |
| `COC_CM_R1` | 100% | 100% | `immediate` |  |
| `COC_CM_R2` | 100% | 100% | `own_project_loses_mc` |  |
| `COC_CM_R3` | 100% | 100% | `any_card_destroyed` | any_card_destroyed (True) |
| `COC_COM_Curry_C1` | 100% | 100% | `control_project_cards` |  |
| `COC_COM_Curry_M1` | 100% | 100% | `all_projects` | Player 1’s COC_COM_Curry_M1 — is disabled and cannot |
| `COC_COM_Curry_R1` | 100% | 100% | `card_type` = Project |  |
| `COC_COM_Vinz_C1` | 100% | 100% | `lowest_mc_project` = self | Player 1’s COC_COM_Vinz_C1 — is disabled and cannot  |
| `COC_Clove_C1` | 100% | 100% | `has_tag` = Community | COC_Clove_C1 lacks tag 'Community' |
| `COC_Clove_C2` | 100% | 100% | `none` |  |
| `COC_Clove_E1` | 100% | 100% | `count_tag` = Community | No Projects with tag 'Community' found |
| `COC_Clove_E2` | 100% | 100% | `none` |  |
| `COC_Clove_Founder_C1` | 100% | 100% | `has_mc_below` = 10 | ↳   COC_Clove_Founder_C1 skipped — no valid targets. |
| `COC_Clove_Founder_E1` | 100% | 100% | `first_debuff_hit` = Project |  |
| `COC_Clove_Founder_M1` | 100% | 100% | `none` |  |
| `COC_Clove_Founder_R1` | 100% | 100% | `has_card_type` = Event | ↳   Skipping destroy: COC_Clove_Founder_R1 is not a  |
| `COC_Clove_M1` | 100% | 100% | `limit_loss` |  |
| `COC_Cr00ts_C1` | 100% | 100% | `survives_debuff` | survives_debuff (True) |
| `COC_Cr00ts_C3` | 100% | 100% | `None` | ↳   COC_Cr00ts_C3 rallied the Cr00ts, but no Common  |
| `COC_Cr00ts_E1` | 100% | 100% | `survived` |  |
| `COC_Cr00ts_Founder_C1` | 100% | 100% | `start_of_match` | ↳   COC_Cr00ts_Founder_C1 rallied the Cr00ts, but no |
| `COC_Cr00ts_L1` | 100% | 100% | `final_calc` = enemy_lt_20 | Final condition not met: enemy_lt_20 |
| `COC_Cr00ts_R1` | 100% | 100% | `None` |  |
| `COC_Cr00ts_R3` | 100% | 100% | `during_debuff_phase` |  |
| `COC_DAK_C1` | 100% | 100% | `self_debuffed` | self_debuffed (True) |
| `COC_DAK_C2` | 100% | 100% | `coin_flip` |  |
| `COC_DAK_C3` | 100% | 100% | `survived` |  |
| `COC_DAK_Founder_C1` | 100% | 100% | `tag_on_field` = Ape |  |
| `COC_DAK_Founder_E1` | 100% | 100% | `first_destruction_attempt` |  |
| `COC_DAK_Founder_R1` | 100% | 100% | `own_project_destroyed` |  |
| `COC_DAK_R1` | 100% | 100% | `none` |  |
| `COC_EVT_Boost_of_Faith` | 100% | 100% | `None` |  |
| `COC_EVT_DeFi_Summer` | 100% | 100% | `count_rarity_in_deck` = Rare_or_Epic >= 2 | Player 2’s COC_EVT_DeFi_Summer — is disabled and can |
| `COC_EVT_Diamond_Hands` | 100% | 100% | `highest_immune` | Player 1’s COC_EVT_Diamond_Hands — is disabled and c |
| `COC_EVT_Echo_of_the_Past` | 100% | 100% | `None` | Player 1’s COC_EVT_Echo_of_the_Past — is disabled an |
| `COC_EVT_Liquidity_Crisis` | 100% | 100% | `mc_between` = 15,30 | Player 1’s COC_EVT_Liquidity_Crisis — is disabled an |
| `COC_EVT_Market_Surge` | 100% | 100% | `None` |  |
| `COC_EVT_Minor_Glitch` | 100% | 100% | `None` | Player 2’s COC_EVT_Minor_Glitch — is disabled and ca |
| `COC_EVT_Pump_&_Dump` | 100% | 100% | `None` |  |
| `COC_FFS_C1` | 100% | 100% | `other_projects_lose_mc` |  |
| `COC_FFS_C2` | 100% | 100% | `always` |  |
| `COC_FFS_E1` | 100% | 100% | `any_project_takes_damage` |  |
| `COC_FFS_E2` | 100% | 100% | `enemy_mc_lt_self` | enemy_mc_lt_self (True) |
| `COC_FFS_Founder_C1` | 100% | 100% | `own_project_lost_mc` | ↳   COC_FFS_Founder_C1 skipped — no valid targets. |
| `COC_FFS_Founder_L1` | 100% | 100% | `any_card_mc_lt` = 5 |  |
| `COC_FFS_Founder_R1` | 100% | 100% | `meme_tagged` | ↳   Skipping add_mc: COC_FFS_Founder_R1 is not a Pro |
| `COC_FFS_L1` | 100% | 100% | `own_projects_lost_mc` = >=2 | Not enough of your Projects lost MC due to effects ( |
| `COC_FFS_R2` | 100% | 100% | `always` |  |
| `COC_FFS_R3` | 100% | 100% | `none` |  |
| `COC_Howlers_C1` | 100% | 100% | `tags_match` = lowest_highest=Lunar |  |
| `COC_Howlers_C2` | 100% | 100% | `total_mc_lt_opponent` | total_mc_lt_opponent (True) |
| `COC_Howlers_C3` | 100% | 100% | `is_lowest_mc_card` | COC_Howlers_C3 is not the lowest MC Project |
| `COC_Howlers_E1` | 100% | 100% | `enemy_has_two` |  |
| `COC_Howlers_E2` | 100% | 100% | `None` |  |
| `COC_Howlers_Founder_M1` | 100% | 100% | `after_all_resolve` |  |
| `COC_Howlers_M1` | 100% | 100% | `none` |  |
| `COC_Howlers_R1` | 100% | 100% | `none` | COC_Howlers_R1 MC is not exactly 7 |
| `COC_Howlers_R3` | 100% | 100% | `highest_mc_project` = any | ↳   Player 1’s COC_Howlers_R3 effects are disabled. |
| `COC_INF_Francis_C1` | 100% | 100% | `enemy_has_projects` | Player 1’s COC_INF_Francis_C1 — is disabled and cann |
| `COC_INF_Francis_L1` | 100% | 100% | `None` | ↳   COC_INF_Francis_L1 disables Player 2’s Support C |
| `COC_INF_Francis_M1` | 100% | 100% | `None` |  |
| `COC_INF_Pampa_E1` | 100% | 100% | `own_project_destroyed` | Player 1’s COC_INF_Pampa_E1 — is disabled and cannot |
| `COC_INF_Pampa_R1` | 100% | 100% | `none` | Player 1’s COC_INF_Pampa_R1 — is disabled and cannot |
| `COC_Lionel_C1` | 100% | 100% | `mc_less_than_equal` = 15 | COC_Lionel_C1 MC 18.0 is not ≤ 15 |
| `COC_Lionel_C2` | 100% | 100% | `project_targeted_by_debuff` | COC_Lionel_C2 skipped: No friendly Project was targe |
| `COC_Lionel_C3` | 100% | 100% | `lowest_mc_project` |  |
| `COC_Lionel_E1` | 100% | 100% | `survived_destruction_count` = >=2 |  |
| `COC_Lionel_E2` | 100% | 100% | `first_debuff` |  |
| `COC_Lionel_Founder_C1` | 100% | 100% | `control_card_count` = 1,Project | ↳   COC_Lionel_Founder_C1 skipped — no valid targets |
| `COC_Lionel_Founder_E1` | 100% | 100% | `destruction_attempt` = first |  |
| `COC_Lionel_Founder_L1` | 100% | 100% | `final_calc_survivors` = >=2 |  |
| `COC_Lionel_Founder_M1` | 100% | 100% | `projects_destroyed_count` = 0 |  |
| `COC_Lionel_Founder_R1` | 100% | 100% | `project_debuffed` | COC_Lionel_Founder_R1 skipped: No friendly Projects  |
| `COC_Lionel_L1` | 100% | 100% | `final_calc` = lowest_survivor |  |
| `COC_Lionel_M1` | 100% | 100% | `final_calc_survivors` = >=4 |  |
| `COC_Lionel_R3` | 100% | 100% | `none` |  |
| `COC_Nova_C1` | 100% | 100% | `tag_on_field` = Nova ≥ 2 | No tag 'Nova ≥ 2' found on field |
| `COC_Nova_C3` | 100% | 100% | `is_lowest` | ⬇ Not your lowest MC Project |
| `COC_Nova_E1` | 100% | 100% | `has_tag` = Nova |  |
| `COC_Nova_Founder_L1` | 100% | 100% | `target_nova_project` = any | ↳   Skipping add_mc: COC_Nova_Founder_L1 is not a Pr |
| `COC_Nova_L1` | 100% | 100% | `rarity_count` = >= 3 |  |
| `COC_Nova_M1` | 100% | 100% | `none` |  |
| `COC_Nova_R1` | 100% | 100% | `has_card_type` = Event | No card of type 'Event' found |
| `COC_Nova_R2` | 100% | 100% | `count_rarity` = Rare ≥ 2 | count_rarity (Rare ≥ 2) |
| `COC_RR_C1` | 100% | 100% | `is_lowest_mc_in_deck` | COC_RR_C1 is not the lowest MC Project in deck |
| `COC_RR_C2` | 100% | 100% | `coin_flip` |  |
| `COC_RR_C3` | 100% | 100% | `on_destroyed` |  |
| `COC_RR_E1` | 100% | 100% | `deck_tag` = Machine |  |
| `COC_RR_E2` | 100% | 100% | `enemy_has_projects` |  |
| `COC_RR_M1` | 100% | 100% | `None` = 0.1 | COC_RR_M1_exploded (True) |
| `COC_RR_R1` | 100% | 100% | `deck_tag_count` = Machine >= 2 |  |
| `COC_RR_R2` | 100% | 100% | `None` |  |
| `COC_Wolfswap_C1` | 100% | 100% | `self_destroyed` |  |
| `COC_Wolfswap_C3` | 100% | 100% | `destruction_targeting` |  |
| `COC_Wolfswap_E1` | 100% | 100% | `enemy_has_rarity` = Epic | ↳   COC_Wolfswap_E1 skipped — no valid targets. |
| `COC_Wolfswap_E2` | 100% | 100% | `enemy_project_destroyed` | No enemy Projects destroyed |
| `COC_Wolfswap_Founder_R1` | 100% | 100% | `effect_targeted_highest` |  |
| `COC_Wolfswap_M1` | 100% | 100% | `enemy_projects_count` = >=1 |  |
| `COC_Wolfswap_R2` | 100% | 100% | `lowest_friendly_and_enemy_exist` |  |
| `COC_Wolfswap_R3` | 100% | 100% | `effect_targeted_highest` |  |
| `COC_Zero_Day` | 100% | 100% | `None` | Player 2’s COC_Zero_Day — is disabled and cannot tri |
