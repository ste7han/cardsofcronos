import re

from targeting import get_targets
from constants import RARITY_ORDER
from action import check_lost_mc_due_to_effect
from utils import log_event, pretty_log, CardLogGroup, maybe_reflect_first_debuff

# De kaartteksten gebruiken andere namen dan de tags in de data. "Ape" is hoe de
# DAK-factie (Defi Ape Kings) in de teksten heet; er bestaat geen tag "Ape".
TAG_ALIASSEN = {
    "ape": "DAK",
    "apes": "DAK",
    "monster": "Crazzzy Monsters",
    "monsters": "Crazzzy Monsters",
    "robot": "Reckless Robots",
    "robots": "Reckless Robots",
}


def los_tag_op(naam, kaarten):
    """Vertaalt een tagnaam uit een kaarttekst naar de tag zoals die in de data staat."""
    if not naam:
        return naam
    schoon = str(naam).strip()
    bestaande = {str(t) for k in (kaarten or []) if isinstance(k, dict) for t in (k.get("tags") or [])}
    if schoon in bestaande:
        return schoon
    for t in bestaande:
        if t.lower() == schoon.lower():
            return t
    return TAG_ALIASSEN.get(schoon.lower(), schoon)


def heeft_tag(kaart, naam):
    if not isinstance(kaart, dict):
        return False
    doel = str(naam or "").strip().lower()
    if not doel:
        return False
    tags = [str(t).strip().lower() for t in (kaart.get("tags") or [])]
    if doel in tags:
        return True
    alias = TAG_ALIASSEN.get(doel)
    return bool(alias) and alias.strip().lower() in tags


def log_condition(context, log, card, condition_type, result, details=""):
    """
    Standardized logging for condition checks.
    """
    status = "✅ PASS" if result else "❌ FAIL"
    msg = f"🧩 {card.get('card_id', '???')} [{condition_type}] → {status} {details}"
    log_event(context, log, "condition", msg, card=card)


# ---- safety helpers (drop-in) ----
def _as_card_dict(x):
    """Return a dict card; if x is a list like [card], unwrap it, else {}."""
    if isinstance(x, dict):
        return x
    if isinstance(x, list) and x and isinstance(x[0], dict):
        return x[0]
    return {}

def _as_card_list(seq):
    """Normalize any sequence to a flat list of dict cards."""
    out = []
    if not isinstance(seq, list):
        seq = [seq] if seq is not None else []
    for c in seq:
        if isinstance(c, dict):
            out.append(c)
        elif isinstance(c, list) and c and isinstance(c[0], dict):
            out.append(c[0])
    return out





def check_condition(card, effect, player, opponent, deck, field, context=None, log=None):
    """
    Hardened entry point: always coerces card/decks/fields to dict/list[dict]
    so downstream .get(...) calls never hit lists.
    """
    # --- normalize inputs ---
    effect = effect or {}
    context = context or {}
    card = _as_card_dict(card)

    # Player side
    player_deck  = _as_card_list(deck)  # treat the 'deck' arg as the player's deck if provided
    player_field = _as_card_list(field or context.get("field") or getattr(player, "field", []) or [])

    # Opponent side: prefer explicit context keys, then fall back to attributes
    opponent_field = _as_card_list(context.get("opponent_field") or getattr(opponent, "field", []) or [])
    opponent_deck  = _as_card_list(context.get("opponent_deck") or opponent_field)

    # Log
    if log is None:
        log = context.get("log", [])
    context["log"] = log

    # Keep normalized values in context for any downstream readers
    context["player"] = player
    context["opponent"] = opponent
    context["field"] = player_field
    context["opponent_field"] = opponent_field
    context["effect"] = effect
    context["source_card"] = card

    condition_type  = str(effect.get("condition_type") or "").strip()
    condition_value = effect.get("condition_value")

    # Safe debug (avoid KeyError if card_id missing)
    cid = card.get("card_id", "?")
    print(f"[DEBUG] check_condition() called for {cid} → {condition_type}: {condition_value}")

    # Delegate to your existing core
    return check_condition_core(
        card, condition_type, condition_value, player_deck, opponent_deck,
        player=player, field=player_field, opponent_field=opponent_field,
        opponent=opponent, effect=effect, context=context, log=log
    )






def get_highest_friendly_project_mc(player):
    valid_projects = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
    if not valid_projects:
        return 0
    return max([c.get("current_mc", 0) for c in valid_projects])



def check_condition_core(card, condition_type, condition_value, deck, opponent_deck,
                         player=None, field=None, opponent_field=None, opponent=None,
                         effect=None, context=None, log=None):
    
    if context is None:
        context = {}  # ✅ Prevent AttributeError

    # All your original logic here...

    print(f"[TRACE] Checking condition: {condition_type} | Card: {card.get('card_id')}")

    if field is None:
        field = deck
    if opponent_field is None:
         opponent_field = opponent_deck

    if condition_type in [None, "none"]:
        return True
    
    if condition_type == "field_effect" and condition_value == "invert_buffs_debuffs":
        return True


    if condition_type == "has_tag":
        return condition_value in card.get("tags", [])

    elif condition_type == "tag_on_field":
        # "Nova ≥ 2", maar ook een kale tagnaam. Let op: de kaarttekst kan een
        # andere naam gebruiken dan de data — "Ape" is de tag "DAK".
        parts = str(condition_value or "").split()
        if len(parts) == 3:
            tag, operator, amount = parts
            count = sum(1 for c in deck if heeft_tag(c, tag))
            try:
                return eval(f"{count} {operator} {int(amount)}")
            except Exception:
                return False
        tag = parts[0] if parts else ""
        return any(heeft_tag(c, tag) for c in deck)

    elif condition_type == "deck_tag":
        return any(condition_value in c.get("tags", []) for c in deck)

    elif condition_type == "self_destruct":
        return condition_value.lower() == "true"

    elif condition_type == "highest_own_buff":
        return True  # TODO: implement actual check

    elif condition_type == "self" and condition_value == "destroy_common":
        print(f"[DEBUG] Checking destroy_common condition for {card['card_id']}")
        
        for c in field:
            if not isinstance(c, dict):
                print(f"→ Skipped invalid card: {c}")
                continue
            print(f"→ Card: {c.get('card_id')} | Rarity: {c.get('rarity')} | Destroyed: {c.get('destroyed')}")

        common_cards = [
            c for c in field
            if isinstance(c, dict)
            and c.get("rarity", "").lower() == "common"
            and c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c != card  # ✅ Avoid destroying yourself
        ]
        
        print(f"[RESULT] Found {len(common_cards)} other common projects")
        return len(common_cards) > 0



    if not condition_type:
        return True


        
    elif condition_type == "friendly_rarity_count_gte":
        try:
            if isinstance(condition_value, str) and "," in condition_value:
                rarity, threshold = [x.strip() for x in condition_value.split(",")]
                threshold = int(threshold)
            else:
                print(f"[ERROR] Invalid condition_value format: {condition_value}")
                return False

            if field is None:
                field = deck

            count = sum(
                1 for c in field
                if c.get("card_type") == "Project"
                and RARITY_ORDER.get(c.get("rarity")) is not None
                and RARITY_ORDER[c["rarity"]] <= RARITY_ORDER[rarity]
                and not c.get("destroyed")
            )
            print(f"[DEBUG] Matching {count} cards of rarity <= {rarity}, threshold = {threshold}")
            return count >= threshold
        except Exception as e:
            print(f"[ERROR] Exception in friendly_rarity_count_gte: {e}")
            return False
        
    elif condition_type == "rarity":
        target_rarity = condition_value.strip().lower()
        for c in player.field:
            if c.get("card_type") == "Project" and not c.get("destroyed") and c.get("rarity", "").lower() == target_rarity:
                return True
        return False
    

    elif condition_type in ("own_projects_under_mc_gte", "project_mc_lt_count"):
        raw = str(condition_value or "").strip()
        parts = [p.strip() for p in raw.replace("|", ",").split(",") if p.strip()]
        try:
            threshold = float(parts[0])
        except Exception:
            threshold = 20.0  # sensible default
        min_count = int(parts[1]) if len(parts) > 1 else 3  # default to 3 if missing

        cnt = sum(
            1 for c in player.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("current_mc", 0) < threshold
        )
        return cnt >= min_count




        
    elif condition_type == "total_team_mc_lt_opponent":
        phase = (effect.get("phase") or context.get("current_phase") or "").lower()
        key = f"{card['card_id']}_{phase}_triggered"

        own_mc = player.get_total_mc()
        opponent_mc = opponent.get_total_mc()

        if own_mc < opponent_mc:
            if context.get(key, False):
                # 🚫 Already triggered in this phase
                return False
            context[key] = True
            return True
        
        msg = f"⚖️ Your total MC is not lower than opponent ({own_mc:.1f} vs {opponent_mc:.1f})"
        log_event(context, log, "skip", msg, card=card)
        return False


    elif condition_type == "start_of_match":
        current_phase = (effect.get("phase") or context.get("current_phase") or "").lower()
        print(f"[DEBUG] start_of_match check → card={card['card_id']} | phase={current_phase}")

        if current_phase == "start":
            key = f"{card['card_id']}_start_triggered"
            if context.get(key, False):
                print(f"[DEBUG] {card['card_id']} already triggered this phase → skipping")
                return False
            context[key] = True

            group = CardLogGroup(card, "Start")
            context["group"] = group

            targets = get_targets(
                effect.get("target_type"),
                player,
                opponent,
                card,
                self_deck=player.field,
                opponent_deck=opponent.field,
                effect=effect,
            )
            context["targets"] = targets
            print(f"[DEBUG] Found targets for {card['card_id']}: {[t['card_id'] for t in targets]} (count={len(targets)})")

            if not targets:
                group.add(
                    "skip",
                    f"⚠️ {card['card_id']} rallied the Cr00ts, "
                    "but no Common Cr00ts were available to answer the call."
                )
                log.append(group.finalize())
                del context["group"]
                context[f"{card['card_id']}_handled"] = True
                print(f"[DEBUG] {card['card_id']} logged custom skip (no targets)")
                return True   # ✅ signal handled to avoid fallback

            group.add(
                "trigger",
                f"🧪 {card['card_id']} prepares to buff "
                f"{', '.join(t['card_id'] for t in targets)} (+{effect['action_value']} MC)"
            )
            log.append(group.finalize())
            del context["group"]
            context[f"{card['card_id']}_handled"] = True
            print(f"[DEBUG] {card['card_id']} logged trigger for {len(targets)} targets")
            return True

        log_event(
            context,
            log,
            "skip",
            f"start_of_match failed: not Start phase (current={current_phase})",
            card=card
        )
        print(f"[DEBUG] start_of_match condition failed for {card['card_id']} (phase={current_phase})")
        return False


    elif condition_type == "lost_mc_due_to_effect":
        valid_targets = []
        seen_ids = set()

        lost_projects = check_lost_mc_due_to_effect(context, player)
        print(f"[BTD DEBUG] condition_type=lost_mc_due_to_effect → {len(lost_projects)} candidates")

        for proj in lost_projects:
            cid = proj.get("card_id")
            if cid and cid not in seen_ids:
                valid_targets.append(proj)
                seen_ids.add(cid)

        # De BTD-bijhouding hierboven wordt alleen gevuld vanuit track_mc_change,
        # en daar loopt maar een vijfde van de schade langs. De kaart zelf houdt
        # het verlies wél op elk pad bij, dus die gebruiken we als achtervang.
        if not valid_targets:
            veld = list(getattr(player, "field", None) or field or [])
            valid_targets = [c for c in veld
                             if isinstance(c, dict) and c.get("card_type") == "Project"
                             and not c.get("destroyed") and c.get("_mc_lost_total")]

        if valid_targets:
            context["lost_mc_due_to_effect_targets"] = valid_targets
            return True

        return False
    
    elif condition_type == "mc_multiple":
        try:
            divisor = int(condition_value)
            total_mc = player.total_mc()
            if divisor > 0 and total_mc % divisor == 0:
                log_event(
                    context, log, "info",
                    f"🧮 {card['card_id']} → Total MC = {total_mc} is divisible by {divisor} ✅"
                )
                return True
            else:
                log_event(
                    context, log, "info",
                    f"🧮 {card['card_id']} → Total MC = {total_mc} not divisible by {divisor} ❌"
                )
                return False
        except Exception as e:
            log_event(
                context, log, "warn",
                f"⚠️ {card['card_id']} mc_multiple error: {e}"
            )
            return False


    elif condition_type == "other_projects_lose_mc":
        lost_projects = [
            c for c in player.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed")
            and c.get("lost_mc_this_phase", 0) > 0
            and c["card_id"] != card["card_id"]
        ]
        if not lost_projects:
            return f"❌ {card['card_id']} could not trigger — no *other* friendly Projects lost MC this phase."
        return f"✅ {len(lost_projects)} friendly Project(s) lost MC this phase"






        
    elif condition_type == "mc_gte":
        try:
            threshold = float(condition_value)
            # Check if any *target* meets this
            for c in field:
                if (
                    c.get("card_type") == "Project"
                    and not c.get("destroyed")
                    and c.get("current_mc", 0) >= threshold
                ):
                    return True
            return False
        except:
            return False


    elif condition_type == "self_destroyed":
        destroyed = card.get("destroyed", False)
        print(f"[DEBUG] Checking self_destroyed on {card['card_id']} → {destroyed}")
        return destroyed
    


    elif condition_type == "enemy_projects_count":
        try:
            from operator import ge, gt, le, lt, eq

            normalized = (
                str(condition_value)
                .replace("≥", ">=")
                .replace("≤", "<=")
                .replace("＝", "==")
            )

            match = re.match(r"(>=|<=|>|<|==|=)?\s*(\d+)", normalized.strip())
            if not match:
                print(f"[ERROR] Invalid format for enemy_projects_count: {condition_value}")
                return False

            op_str, threshold_str = match.groups()
            threshold = int(threshold_str)

            op_func = {
                ">=": ge,
                ">": gt,
                "<=": le,
                "<": lt,
                "==": eq,
                "=": eq,
                None: ge
            }.get(op_str, ge)

            enemy_projects = [
                c for c in opponent.field
                if c.get("card_type") == "Project" and not c.get("destroyed", False)
            ]
            count = len(enemy_projects)

            result = op_func(count, threshold)
            print(f"[DEBUG] {card['card_id']} checks enemy_projects_count {op_str or '>='}{threshold} → {count} found → {result}")

            if result:
                # ✅ Prevent multiple triggers in the same phase
                phase = effect.get("phase", "").lower()
                key = f"{card['card_id']}_{phase}_triggered"
                if context.get(key, False):
                    print(f"[GUARD] {card['card_id']} already triggered this phase → skipping")
                    return False
                context[key] = True

            return result

        except Exception as e:
            print(f"[ERROR] enemy_projects_count failed: {e}")
            return False



    elif condition_type == "mc_lower_than_self":
        try:
            # Compare the MC of this card vs opponent's total MC
            self_mc = card.get("current_mc", 0)
            opponent_total_mc = opponent.total_mc()
            return self_mc > opponent_total_mc
        except Exception as e:
            print(f"[ERROR] mc_lower_than_self failed for {card['card_id']}: {e}")
            return False


    elif condition_type == "destroyed_friendly_count":
        try:
            threshold = int(condition_value.strip("≥"))
        except:
            threshold = 0

        # player.destroyed_cards wordt niet door alle vernietigingspaden gevuld;
        # het veld zelf is de betrouwbare bron.
        veld = list(getattr(player, "field", None) or field or [])
        destroyed_count = max(
            len([c for c in veld if isinstance(c, dict) and c.get("destroyed")]),
            len(getattr(player, "destroyed_cards", []) or []),
        )

        if destroyed_count < threshold:
            if log is not None:
                log.append(
                    f"⛔ {card.get('card_id', '???')} could not act — "
                    f"needs ≥{threshold} destroyed friendly Projects "
                    f"(currently {destroyed_count})"
                )
            return False
        else:
            if log is not None:
                log.append(
                    f"🧪 {card.get('card_id', '???')} condition met "
                    f"(destroyed friendly count {destroyed_count} ≥ {threshold})"
                )
            # Zonder deze return viel de voorwaarde door naar het einde van de
            # functie, en dat is `return False` — de kaart meldde dus "condition
            # met" en deed vervolgens niets.
            return True






    
    elif condition_type == "mc_lt_opponent":
        player_total = player.total_mc()
        opponent_total = opponent.total_mc()
        result = player_total < opponent_total
        details = f"({player_total} vs {opponent_total})"
        log_condition(context, log, card, condition_type, result, details)
        return result

    
    elif condition_type in ("own_project_loses_mc", "own_project_lost_mc"):
        # Twee schrijfwijzen, tegenwoordige en verleden tijd. Alleen de eerste
        # stond hier; COC_FFS_Founder_C1 gebruikt de tweede en viel daardoor door
        # naar het afsluitende return False — terwijl de reden-functie in
        # match_simulator.py wél "Condition met" meldde. Vandaar dat de kaart
        # werd overgeslagen met de melding dat de voorwaarde gehaald was.
        # De kaart zegt "elke keer dat een van je Projects MC verliest", dus over
        # de hele match. Alleen naar deze fase kijken maakte hem onbruikbaar:
        # het effect staat in de Counter-fase terwijl het verlies in Debuff valt.
        if getattr(player, "mc_loss_this_phase", 0) > 0:
            return True
        veld = list(getattr(player, "field", None) or field or [])
        return any(c.get("_mc_lost_total") or c.get("lost_mc_this_phase")
                   for c in veld if isinstance(c, dict))
    
    elif condition_type == "project_targeted_by_debuff":
        return player.was_any_project_debuffed
    
    elif condition_type == "random_common_own_exists":
        common_projects = [
            c for c in player.field
            if c["card_type"] == "Project"
            and c.get("rarity", "").lower() == "common"
            and not c.get("destroyed")
        ]
        return len(common_projects) > 0

    elif condition_type == "random_common_own_destroyed":
        return context.get("last_target_destroyed") is True

    elif condition_type == "on_self_buff":
        # Check if any effect increased this card's MC in prior phases
        initial_mc = card.get("initial_mc", card.get("base_mc"))
        current_mc = card.get("mc", 0)
        was_buffed = current_mc > initial_mc
        print(f"[DEBUG] {card['card_id']} on_self_buff: MC {initial_mc} → {current_mc} → {was_buffed}")
        return was_buffed
    
    elif condition_type == "mc_between":
        try:
            low, high = map(int, condition_value.split(","))
            return any(
                c.get("card_type") == "Project"
                and not c.get("destroyed", False)
                and low <= c.get("current_mc", 0) <= high
                for c in opponent.field + player.field
            )
        except:
            return False


    
    elif condition_type == "project_debuffed":
        debuffed_count = sum(
            1 for c in player.field
            if c.get("card_type") == "Project" and c.get("was_debuffed", False)
        )
        result = debuffed_count > 0
        details = f"(debuffed={debuffed_count})"
        log_condition(context, log, card, condition_type, result, details)
        return result




    
    elif condition_type == "survived":
        # ✅ Check if the source card survived until Final Phase
        survived = not card.get("destroyed", False)
        print(f"[DEBUG] Checking 'survived' condition for {card['card_id']} → {survived}")
        return survived
    
    elif condition_type == "total_mc_ends_in":
        ending_digit = str(condition_value).strip()
        total_mc = sum(
            c.get("current_mc", 0)
            for c in player.field
            if not c.get("destroyed") and c.get("card_type") == "Project"
        )
        print(f"[DEBUG] Checking total_mc_ends_in → {player.name} recalculated total MC = {total_mc}")
        return str(int(total_mc))[-1] == ending_digit
    
    elif condition_type == "any_mc_ends_in":
        want = int(str(condition_value).strip()) % 10

        # Debug only for CAW777_R3 during Final phase
        if (card.get("card_id") == "COC_CAW777_R3" 
            and (context or {}).get("current_phase") == "Final"):
            pool = [c for c in (player.field + opponent.field)
                    if c.get("card_type") == "Project" and not c.get("destroyed", False)]
            print("[DEBUG] CAW777_R3 ends_in check:",
                [(c["card_id"], int(float(c.get("current_mc", 0))) % 10,
                    c.get("current_mc")) for c in pool])

        for c in player.field + opponent.field:
            if c.get("card_type") == "Project" and not c.get("destroyed", False):
                if int(float(c.get("current_mc", 0))) % 10 == want:
                    return True
        return False


    
    elif condition_type == "deck_tag_count":
        # Format: "TagName >= Number"
        try:
            tag, operator, threshold = condition_value.split()
            threshold = int(threshold)
            count = sum(1 for c in deck if tag in c.get("tags", []))
            result = eval(f"{count} {operator} {threshold}")
            print(f"[DEBUG] {card['card_id']} deck_tag_count {tag}: {count} vs {operator} {threshold} → {result}")
            return result
        except Exception as e:
            print(f"[ERROR] deck_tag_count parsing failed → {e}")
            return False

    elif condition_type == "event_card_count":
        try:
            expected = int(condition_value)
            event_cards = [
                c for c in player.field
                if c["card_type"] == "Support" and "Event" in c.get("tags", []) and not c.get("destroyed")
            ]
            print(f"[DEBUG] {card['card_id']} sees {len(event_cards)} Event cards, needs {expected}")
            return len(event_cards) == expected
        except:
            return False

    elif condition_type == "first_debuff_targeting_side":
        if not player.first_debuff_data:
            return False
        first_target = player.first_debuff_data.get("target")
        if not first_target:
            return False
        mc = first_target.get("current_mc", 0)
        print(f"[DEBUG] {card['card_id']} checks first debuff target MC ending: {mc}")
        return str(int(mc))[-1] == condition_value

    elif condition_type == "control_tag":
        tag = condition_value
        for c in player.field:
            if c.get("card_type") == "Project" and not c.get("destroyed") and tag in c.get("tags", []):
                return True
        return False




    elif condition_type == "highest_mc_project":
        # 'any' = just disable the highest MC Project on the field
        all_projects = [c for c in player.field + opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        if not all_projects:
            return False
        highest = max(all_projects, key=lambda x: x.get("current_mc", 0))
        # ✅ Always returns True since it's automatic
        return True
    
    elif condition_type == "first_debuff":
    # Generic: true if this player’s “first debuff” shield hasn’t been spent.
        armed = not getattr(player, "first_debuff_blocked", False)
        if armed:
            print(f"[DEBUG] {card.get('card_id')} first_debuff: READY (shield unused)")
        else:
            print(f"[DEBUG] {card.get('card_id')} first_debuff: NOT READY (already used)")
        return armed








    
    elif condition_type == "exact_rarity_mix":
        # Example: Common:1,Rare:1,Epic:1,Legendary:1,Mythical:1
        required = {
            part.split(":")[0].strip(): int(part.split(":")[1])
            for part in condition_value.split(",")
        }
        rarity_counts = {}
        for c in player.field:
            r = c.get("rarity")
            if r:
                rarity_counts[r] = rarity_counts.get(r, 0) + 1
        return all(rarity_counts.get(r, 0) == count for r, count in required.items())


        
    
    elif condition_type == "enemy_destroyed_count":
        import operator
        ops = {
            ">=": operator.ge,
            "<=": operator.le,
            ">": operator.gt,
            "<": operator.lt,
            "==": operator.eq,
        }

        # Normalize unicode symbols
        normalized = (
            condition_value.replace("≥", ">=")
                        .replace("≤", "<=")
                        .replace("＝", "==")
                        .replace("＝", "=")
        )

        for symbol, op in sorted(ops.items(), key=lambda x: -len(x[0])):
            if normalized.startswith(symbol):
                try:
                    threshold = int(normalized[len(symbol):].strip())

                    print(f"===> Checking condition_type: {condition_type} for card {card['card_id']}")
                    print("Opponent field:", [c['card_id'] for c in opponent_field])

                    destroyed = len([
                        c for c in opponent_field
                        if c["card_type"] == "Project" and c.get("destroyed")
                    ])

                    print(f"[DEBUG] {card['card_id']} sees {destroyed} destroyed enemy Projects. Condition: {normalized}")
                    result = op(destroyed, threshold)
                    print(f"[DEBUG] enemy_destroyed_count result: {result}")
                    return result
                except Exception as e:
                    print(f"[ERROR] Condition check failed inside try: {e}")
                    return False

        print(f"[ERROR] No matching operator in condition_value: {condition_value}")
        return False
    

    elif condition_type == "enemy_destroyed":
        if opponent is None:
            print(f"[CONDITION] {card['card_id']} skipped — opponent is None.")
            return False

        destroyed = getattr(opponent, "destroyed_cards", [])
        destroyed_projects = [c for c in destroyed if c.get("card_type") == "Project"]

        print(f"[CONDITION] {card['card_id']} checking enemy_destroyed...")
        print(f"           → Opponent destroyed {len(destroyed)} cards total.")
        print(f"           → {len(destroyed_projects)} of those are Projects.")

        if destroyed_projects:
            print(f"[CONDITION] {card['card_id']} triggers — enemy Project destroyed.")
            return True
        else:
            print(f"[CONDITION] {card['card_id']} skipped — no enemy Project destroyed.")
            return False


    elif condition_type == "random_support_enemy":
        card_id = card.get("card_id", "Unknown Card")

        opponent = context.get("opponent")
        if not opponent:
            log_event(context, log, "warn", f"{card_id} condition check failed: opponent missing.")
            return False

        valid = [
            c for c in opponent.field
            if c.get("card_type") == "Support"
            and not c.get("destroyed", False)
            and not c.get("disabled", False)
        ]

        log_event(context, log, "trace", f"[CONDITION] {card_id} checking random_support_enemy — {len(valid)} valid targets.")
        return len(valid) > 0
    
    elif condition_type == "any_card_destroyed":
        destroyed_total = (
            context.get("stats", {}).get("destroyed_total")
            if isinstance(context.get("stats", {}), dict) else None
        )

        if destroyed_total is None:
            destroyed_total = 0
            # Check explicit lists first
            for key in ("destroyed_log", "graveyard", "destroyed_this_match"):
                val = context.get(key, [])
                if isinstance(val, list):
                    destroyed_total += len(val)

            # Scan card containers
            for key in ("all_cards", "field", "own_field", "opponent_field"):
                cards = context.get(key, [])
                if isinstance(cards, list):
                    destroyed_total += sum(1 for c in cards if isinstance(c, dict) and c.get("destroyed"))

            # Per-player scan
            for side_key in ("player1", "player2", "p1", "p2"):
                side = context.get(side_key, {})
                if isinstance(side, dict):
                    for list_key in ("field", "all_cards", "graveyard"):
                        cards = side.get(list_key, [])
                        if isinstance(cards, list):
                            destroyed_total += sum(1 for c in cards if isinstance(c, dict) and c.get("destroyed"))

        is_true = destroyed_total > 0

        if log is not None:
            status = f"✅ {destroyed_total} card(s) destroyed" if is_true else "❌ no cards destroyed yet"
            log_event(context, log, "condition",
                    f"{card['card_id']} any_card_destroyed → {status}")

        return is_true


    elif condition_type == "first_enemy_debuff":
        sentinels = context.setdefault("sentinels", {})
        owner = card.get("owner", "unknown")

        # Only arm once
        if not sentinels.get(owner):
            sentinels[owner] = {
                "card_id": card["card_id"],
                "used": False,
            }
            log_event(context, log, "support",
                    f"🛡️ {card['card_id']} is armed: will reflect the first enemy debuff that targets your Projects.")
        # Do NOT mark as “could not act”; this is an arming step.
        return False  # No immediate action; interception happens later






    elif condition_type == "mc_greater_than":
        threshold = float(condition_value)
        if effect and effect.get("target_type") == "self":
            return card.get("current_mc", 0) > threshold
        return card.get("current_mc", 0) > threshold

    elif condition_type == "mc_less_than":
        threshold = float(condition_value)
        if effect and effect.get("target_type") == "self":
            return card.get("current_mc", 0) < threshold
        return card.get("current_mc", 0) < threshold



    elif condition_type == "last_destroyed":
        result = context.get("last_destroyed") is not None
        print(f"[TRACE] Checking last_destroyed → {result}")
        return result

    
    elif condition_type == "mc_less_than_equal":
        try:
            threshold = float(condition_value)
        except:
            threshold = 15.0  # fallback

        current_mc = card.get("current_mc", 0)

        # Self-targeting case
        if not effect or "target_type" not in effect or effect["target_type"] == "self":
            result = current_mc <= threshold

            if log is not None:
                if result:
                    log_event(
                        context, log, "info",
                        f"✅ {card['card_id']} condition met: MC {current_mc:.1f} ≤ {threshold}"
                    )
                else:
                    log_event(
                        context, log, "skip",
                        f"⛔ {card['card_id']} — could not act — 🧮 MC {current_mc:.1f} > {threshold}"
                    )

            return result

        # Non-self targets
        valid_targets = [
            c for c in get_targets(effect["target_type"], player, opponent, card,
                                player.field, opponent.field, effect)
            if c.get("current_mc", 0) <= threshold
        ]

        if log is not None:
            if valid_targets:
                details = ", ".join(f"{c['card_id']}({c['current_mc']:.1f})" for c in valid_targets)
                log_event(
                    context, log, "info",
                    f"✅ {card['card_id']} condition met: targets [{details}] ≤ {threshold}"
                )
            else:
                log_event(
                    context, log, "skip",
                    f"⛔ {card['card_id']} — could not act — 🧮 no targets ≤ {threshold}"
                )

        return bool(valid_targets)

    
    elif condition_type == "own_card_debuffed":
        if player.was_any_project_debuffed:
            return True, None
        else:
            return False, "💥 No own Project lost MC this phase"


    

    elif condition_type == "unique_rarity_count_gte":
        try:
            threshold = int(condition_value)
            rarities = set(
                c.get("rarity")
                for c in player.field
                if c.get("card_type") == "Project" and not c.get("destroyed")
            )
            return len(rarities) >= threshold
        except:
            return False



    
    elif condition_type == "support_same_rarity":
        supports = [c for c in deck if c["card_type"] == "Support"]
        rarities = [c.get("rarity") for c in supports]
        return any(rarities.count(r) >= 2 for r in set(rarities))


    elif condition_type == "cards_destroyed >= 3":
        destroyed = sum(1 for c in deck + opponent_deck if c.get("destroyed"))
        return destroyed >= 3

    elif condition_type == "lowest_mc_project":
        return True  # already handled by target filtering
    
    elif condition_type == "enemy_project_mc_lt":
        try:
            threshold = float(condition_value)
            print(f"[TRACE] Checking condition: enemy_project_mc_lt | Card: {card['card_id']}")

            print(f"[DEBUG] Opponent field for {card['card_id']}: {[c['card_id'] for c in opponent_field]}")

            enemy_projects = [
                c for c in opponent_field
                if c["card_type"] == "Project" and not c.get("destroyed")
            ]
            for c in enemy_projects:
                print(f"[DEBUG] {c['card_id']} MC = {c.get('current_mc')}")

            valid_targets = [c for c in enemy_projects if c.get("current_mc", 0) < threshold]
            print(f"[DEBUG] {card['card_id']} sees {len(valid_targets)} enemy Projects below MC {threshold}")
            return len(valid_targets) > 0
        except Exception as e:
            print(f"[ERROR] enemy_project_mc_lt failed: {e}")
            return False


    elif condition_type == "random_project":
        return True  # randomness happens in target selection, always allow
    
    elif condition_type == "always":
        return True


    elif condition_type == "effect_targeted_highest":
        # Stond hier als `return False  # placeholder`: de omleidingskaarten
        # waren daarmee hard uitgezet. Het is een passief schild dat zichzelf
        # wapent; het omleiden gebeurt in get_targets.
        return not card.get("destroyed", False)

    elif condition_type == "has_card_type":
        if field is None:
            field = deck
        gezocht = str(condition_value or "").lower()
        if any(c.get("card_type", "").lower() == gezocht for c in field):
            return True
        # De kaarttypes zijn Project, Support en Founder. "Event" is geen type
        # maar een tag, dus zoeken we daar ook op — anders kon COC_Clove_Founder_R1
        # ("als je deck een Event bevat") nooit afvuren.
        return any(heeft_tag(c, gezocht) for c in field)

    
    elif condition_type == "not_has_tag":
        return all(condition_value not in c.get("tags", []) for c in field)
    
    elif condition_type == "enemy_has_rarity":
        for card in opponent.field:
            if card.get("rarity") == condition_value:
                return True
        return False
    
    elif condition_type == "enemy_has_projects":
        alive = [
            c for c in opponent.field
            if c["card_type"] == "Project" and not c.get("destroyed")
        ]
        return len(alive) > 0


    elif condition_type.startswith("tag="):
        tag = condition_type.split("=")[1]
        return any(
            tag in c.get("tags", []) and not c.get("destroyed", False)
            for c in field if c.get("card_type") == "Project"
        )
    
    elif condition_type == "enemy_has_two":
        alive = [
            c for c in opponent.field
            if c["card_type"] == "Project" and not c.get("destroyed")
        ]
        return len(alive) >= 2
    

    elif condition_type == "enemy_highest_mc_gte":
        threshold = float(condition_value)
        targets = get_targets(effect["target_type"], player, opponent, card, player.field, opponent.field, effect)
        if not targets:
            return False
        top = targets[0]
        return top.get("current_mc", 0) >= threshold




    elif condition_type == "is_lowest":
        projects = [c for c in deck if c["card_type"] == "Project" and not c.get("destroyed")]
        if not projects:
            return False
        min_mc = min(p.get("current_mc", 0) for p in projects)
        return card.get("current_mc", 0) == min_mc





    elif condition_type == "total_mc < opponent":
        total_self = sum(c.get("current_mc", 0) for c in deck if c["card_type"] == "Project")
        total_oppo = sum(c.get("current_mc", 0) for c in opponent_deck if c["card_type"] == "Project")
        return total_self < total_oppo

    elif condition_type == "enemy_project_destroyed":
        destroyed = getattr(opponent, "destroyed_cards", [])
        result = bool(destroyed)

        if log is not None:
            log.append(f"[CONDITION] {card['card_id']} enemy_project_destroyed check: {result} "
                    f"(Destroyed count: {len(destroyed)})")

        return result
    
    if condition_type == "immediate":
        return True
    
    elif condition_type == "destroyed_projects_count":
        total_destroyed = len(player.destroyed_cards) + len(opponent.destroyed_cards)
        return total_destroyed >= effect.get("threshold", 3)
    
    elif condition_type == "projects_destroyed_count":
        total_destroyed = len(player.destroyed_cards) + len(opponent.destroyed_cards)
        required = int(condition_value.replace(">=", "").strip())
        return total_destroyed >= required




    elif condition_type == "random_project":
        return True

    elif condition_type == "effect_targeted_highest":
        # Stond hier als `return False  # placeholder`: de omleidingskaarten
        # waren daarmee hard uitgezet. Het is een passief schild dat zichzelf
        # wapent; het omleiden gebeurt in get_targets.
        return not card.get("destroyed", False)

    elif condition_type == "control_card_count":
        expected = condition_value.split(",")
        if len(expected) != 2:
            print(f"[CONDITION ERROR] Invalid format for control_card_count: {condition_value}")
            return False
        try:
            required_count = int(expected[0])
            required_type = expected[1].strip().lower()
        except Exception as e:
            print(f"[CONDITION ERROR] Failed parsing control_card_count: {e}")
            return False

        count = sum(
            1 for c in player.field
            if c.get("card_type", "").lower() == required_type and not c.get("destroyed")
        )
        return count >= required_count




    elif condition_type == "count_rarity_in_deck":
        # Format: "Rare_or_Epic >= 2"
        try:
            rarity_expr, comp_expr = condition_value.split(" >= ")
            rarities = rarity_expr.split("_or_")
            threshold = int(comp_expr.strip())
            count = sum(1 for c in deck if c.get("rarity") in rarities)
            return count >= threshold
        except:
            return False
        
    elif condition_type == "count_rarity":
        # "Rare ≥ 2" maar ook een kale "Rare". Die tweede vorm hoort bij teksten
        # als "plus 2mc voor elke andere Rare kaart op het veld" en werd eerder
        # afgewezen omdat er geen ≥ in stond.
        rauw = str(condition_value or "").replace("≥", ">=").strip()
        m = re.match(r"([A-Za-z]+)\s*(>=|<=|==|>|<)?\s*(\d+)?", rauw)
        if not m:
            return False
        rarity = m.group(1).strip().lower()
        operator = m.group(2) or ">="
        drempel = int(m.group(3)) if m.group(3) else None

        count = sum(
            1 for c in field
            if c.get("card_type") == "Project"
            and not c.get("destroyed")
            and c.get("rarity", "").lower() == rarity
        )
        if drempel is None:
            # Geen getal: er moet minstens één ándere kaart van die rarity liggen.
            eigen_telt_mee = (card.get("rarity", "").lower() == rarity
                              and not card.get("destroyed")
                              and card.get("card_type") == "Project")
            return (count - (1 if eigen_telt_mee else 0)) >= 1

        if operator == "<=": return count <= drempel
        if operator == "<":  return count < drempel
        if operator == ">":  return count > drempel
        if operator == "==": return count == drempel
        return count >= drempel



    elif condition_type == "tag=Utility":
        return any("Utility" in c.get("tags", []) for c in deck)
    
    
    elif condition_type == "not_has_tags":
        tags_to_check = [tag.strip() for tag in condition_value.split(",")]
        # Check if ANY card in the field has ANY of the tags
        for card_on_field in field:
            if any(tag in card_on_field.get("tags", []) for tag in tags_to_check):
                return False  # Tag found → condition not met
        return True  # No matching tags → condition met

    elif condition_type == "count_tag_exact":
        # Format: "Lunar=3"
        try:
            tag, count_str = condition_value.split("=")
            expected = int(count_str.strip())
            matches = [
                c for c in player.field
                if c.get("card_type") == "Project"
                and not c.get("destroyed")
                and tag.strip() in c.get("tags", [])
            ]
            return len(matches) == expected
        except Exception as e:
            print(f"[ERROR] count_tag_exact failed: {e}")
            return False
        
    elif condition_type == "first_debuff_hit":
        # Expected format: first_debuff_hit (Project)
        target_type = condition_value.strip() if condition_value else "Project"

        # ✅ Check if first debuff hasn't been blocked yet
        if not hasattr(player, "first_debuff_blocked"):
            player.first_debuff_blocked = False

        # ✅ Only block once
        if player.first_debuff_blocked:
            return False

        # Hier stond een check of de tegenstander een effect had met target_type
        # letterlijk "Project". In de kaartdata heten doelen echter
        # enemy_lowest, all_projects, random_enemy enzovoort — nooit kaal
        # "Project" — dus deze voorwaarde was vrijwel altijd onwaar en de kaart
        # deed nooit iets.
        #
        # Het is een passief schild: het wapent zichzelf zodra je Projects hebt.
        # Het negeren zelf gebeurt op de kaart (zie Kaart in match_simulator.py),
        # die het schild verbruikt zodra de eerste debuff werkelijk aankomt.
        veld = list(getattr(player, "field", None) or field or [])
        return any(c.get("card_type") == "Project" and not c.get("destroyed")
                   for c in veld if isinstance(c, dict))
    
    elif condition_type == "self_mc_eq":
        try:
            target_value = float(condition_value)
            return card.get("current_mc", 0) == target_value
        except:
            return False
        
    elif condition_type == "mc_extremes":
        # Trigger if any Project has >40 MC or <10 MC
        for c in player.field:
            if c.get("card_type") != "Project" or c.get("destroyed"):
                continue
            mc = c.get("current_mc", 0)
            if mc >= 40 or mc <= 10:
                return True
        return False
    
    elif condition_type == "coin_flip":
        # Coin flip condition always returns True (effect decides win/loss)
        print(f"[DEBUG] {card['card_id']} triggers coin_flip condition → always True (flip happens during action)")
        return True

    
    elif condition_type == "first_debuff_targeting_project":
        # Check if this is the first debuff targeting one of your Projects
        if player.first_debuff_blocked:
            print(f"[CONDITION] {card['card_id']} skipped — first debuff already blocked.")
            return False
        if player.first_debuff_data:
            print(f"[CONDITION] {card['card_id']} triggers — first debuff detected and pending reflection.")
            return True
        print(f"[CONDITION] {card['card_id']} skipped — no debuff to reflect.")
        return False


    elif condition_type == "own_rarity":
        rarity_check = condition_value.strip().lower()
        own_projects = [
            c for c in player.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("rarity", "").lower() == rarity_check
        ]
        print(f"[CONDITION] {card['card_id']} checks for own rarity '{rarity_check}': found {len(own_projects)} match(es)")
        return bool(own_projects)


    elif condition_type == "card_type":
        card_type_check = condition_value.strip().lower()
        own_cards = [
            c for c in player.field
            if c.get("card_type", "").lower() == card_type_check
            and not c.get("destroyed", False)
        ]
        print(f"[CONDITION] {card['card_id']} checks for own card_type '{card_type_check}': {len(own_cards)} match(es)")
        return bool(own_cards)
    
    elif condition_type == "each_enemy_project":
        enemy_projects = [
            c for c in opponent.field
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        print(f"[CONDITION] {card['card_id']} checks for each_enemy_project: {len(enemy_projects)} enemy Projects found")
        return bool(enemy_projects)
    
    elif condition_type == "all_projects":
        # Checks if player has any Project alive
        valid_projects = [
            c for c in player.field
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        print(f"[CONDITION] {card['card_id']} checks for all_projects: {len(valid_projects)} own Projects found")
        return bool(valid_projects)
    
    elif condition_type == "on_destroyed":
        # Check if card is marked as destroyed before Counter Phase
        destroyed = card.get("destroyed", False)
        print(f"[CONDITION] {card['card_id']} on_destroyed check: {destroyed}")
        return destroyed







    elif condition_type == "mc==15-30":
        return any(15 <= c.get("current_mc", 0) <= 30 for c in deck if c["card_type"] == "Project")
    
    elif condition_type == "is_lowest_mc_in_deck":
        own_projects = [c for c in player.field if c["card_type"] == "Project" and not c.get("destroyed")]
        if not own_projects:
            return False
        lowest = min(own_projects, key=lambda x: x.get("current_mc", 0))
        return lowest["card_id"] == card["card_id"]

    
    elif condition_type == "is_lowest_mc_card":
        all_cards = [c for c in field if c["owner"] == card["owner"] and c["card_type"] == "Project" and not c.get("destroyed")]
        lowest = min(all_cards, key=lambda x: x.get("current_mc", 0), default=None)
        print(f"[DEBUG] check_condition() → {card['card_id']} MC={card['current_mc']} vs lowest={lowest['card_id']} MC={lowest['current_mc']}")
        return lowest and lowest["card_id"] == card["card_id"]
    
    elif condition_type == "enemy_mc_lt_self":
        # FIX: Use opponent.field instead of opponent directly
        enemy_projects = [c for c in opponent.field if c["card_type"] == "Project" and not c.get("destroyed")]
        lower = [c for c in enemy_projects if c.get("current_mc", 0) < card.get("current_mc", 0)]
        return len(lower) > 0


    elif condition_type == "has_all_rarities":
        rarities = {c.get("rarity") for c in deck}
        return rarities >= {"Common", "Rare", "Epic", "Legendary"}

    elif condition_type == "has_exact_rarities":
        expected = {"Common", "Rare", "Epic", "Legendary", "Mythical"}
        rarities = [c.get("rarity") for c in deck if c.get("card_type") == "Project"]
        return set(rarities) == expected and all(rarities.count(r) == 1 for r in expected)
    
    elif condition_type == "rarity_count":
        try:
            operator, threshold = condition_value.strip().split()
            threshold = int(threshold)

            # Extract only valid rarities from alive project cards
            rarities = {
                c.get("rarity")
                for c in deck
                if c.get("card_type") == "Project" and not c.get("destroyed")
            }

            count = len(rarities)
            
            if operator == ">=":
                return count >= threshold
            elif operator == ">":
                return count > threshold
            elif operator == "<=":
                return count <= threshold
            elif operator == "<":
                return count < threshold
            elif operator == "==":
                return count == threshold
            else:
                return False
        except Exception as e:
            print(f"[ERROR] rarity_count parsing failed: {e}")
            return False

    
    elif condition_type == "lowest_mc_lte":
        try:
            threshold = float(condition_value)
            projects = [c for c in deck if c.get("card_type") == "Project" and not c.get("destroyed")]
            if not projects:
                return False
            lowest = min(projects, key=lambda x: x.get("current_mc", 0))
            return lowest.get("current_mc", 0) <= threshold
        except:
            return False

    elif condition_type == "different_card_types":
        types = set(c.get("card_type") for c in deck if c.get("card_type"))
        return len(types) >= 2
    
    elif condition_type == "project_mc_lt":
        try:
            threshold = float(condition_value)
            return card.get("card_type") == "Project" and card.get("current_mc", 0) < threshold
        except:
            return False
    
        
    elif condition_type == "has_card_on_field":
        return any(condition_value.lower() in c.get("card_id", "").lower() for c in deck)
    
    elif condition_type == "has_no_card_type":
        return all(c.get("card_type") != condition_value for c in deck)
    
    elif condition_type == "count_card_type":
        tag_to_match = condition_value
        all_cards = []
        for side in ["player1", "player2"]:
            for card in field.get(side, []):
                if not card.get("destroyed"):
                    all_cards.append(card)
        matches = [c for c in all_cards if tag_to_match in c.get("tags", [])]
        print(f"[DEBUG] {card['card_id']} sees {len(matches)} '{tag_to_match}' cards on field")
        return True  # Always return True — count is used during apply_action
    

    elif condition_type == "count_tag_on_field":
        try:
            tag, operator, threshold = condition_value.strip().split()
            threshold = int(threshold)
            count = sum(1 for c in deck if tag in c.get("tags", []))

            if operator == ">=":
                return count >= threshold
            elif operator == ">":
                return count > threshold
            elif operator == "==":
                return count == threshold
            elif operator == "<=":
                return count <= threshold
            elif operator == "<":
                return count < threshold
            else:
                return False
        except Exception as e:
            print(f"[ERROR] count_tag_on_field parsing failed: {e}")
            return False
        
    elif condition_type == "control_all_rarities":
        rarities_needed = {"Common", "Rare", "Epic", "Legendary", "Mythical"}
        own_rarities = {
            card.get("rarity") for card in player.field
            if card.get("card_type") == "Project" and not card.get("destroyed")
        }
        return rarities_needed.issubset(own_rarities)

    elif condition_type == "target_random_opponent_card":
        return "✅ Condition met"


    elif condition_type == "first_friendly_destroyed":
        return player.first_friendly_destroyed


        
    elif condition_type == "count_tag":
        # "TagName", "TagName:>=2", maar ook "Lunar>=3" zonder dubbele punt.
        # Die laatste vorm werd eerder in zijn geheel als tagnaam gelezen, dus
        # er werd gezocht naar een tag die letterlijk "Lunar>=3" heet.
        rauw = str(condition_value or "").replace("≥", ">=").replace("≤", "<=")
        m = re.match(r"\s*([^:><=]+?)\s*[:]?\s*((?:>=|<=|==|>|<)\s*\d+)?\s*$", rauw)
        tag = (m.group(1).strip() if m and m.group(1) else rauw.strip())
        comparator = (m.group(2).replace(" ", "") if m and m.group(2) else ">0")

        count = 0
        for card in player.field + opponent_field:
            if not isinstance(card, dict):
                continue
            if heeft_tag(card, tag):
                count += 1

        try:
            # Use eval safely to compare count
            return eval(f"{count}{comparator}")
        except Exception as e:
            print(f"[ERROR] Invalid count_tag condition: {condition_value} → {e}")
            return False


    
    elif condition_type == "mc_lower_than_opponent":
        try:
            if condition_value == "after_first_double":
                # Simulate doubling the highest project manually
                projects = [c for c in deck if c.get("card_type") == "Project" and not c.get("destroyed")]
                if len(projects) == 0:
                    return False

                # Find the one that would have been doubled first
                highest = max(projects, key=lambda x: x.get("current_mc", 0))
                simulated_total = sum(
                    c.get("current_mc", 0) * 2 if c["card_id"] == highest["card_id"] else c.get("current_mc", 0)
                    for c in projects
                )
                opponent_total = sum(
                    c.get("current_mc", 0)
                    for c in opponent_deck
                    if c.get("card_type") == "Project" and not c.get("destroyed")
                )
                print(f"[DEBUG] mc_lower_than_opponent (after_first_double): simulated {simulated_total} vs opponent {opponent_total}")
                return simulated_total < opponent_total
            else:
                own_total = sum(
                    c.get("current_mc", 0)
                    for c in deck
                    if c.get("card_type") == "Project" and not c.get("destroyed")
                )
                opponent_total = sum(
                    c.get("current_mc", 0)
                    for c in opponent_deck
                    if c.get("card_type") == "Project" and not c.get("destroyed")
                )
                print(f"[DEBUG] mc_lower_than_opponent (direct): {own_total} < {opponent_total}")
                return own_total < opponent_total
        except Exception as e:
            print(f"[ERROR] mc_lower_than_opponent failed: {e}")
            return False







    elif condition_type == "card_on_field":
        # "Crooks Founder" is geen deel van "COC_CF_Founder_C1", dus een simpele
        # substring-vergelijking vond nooit iets. Alle woorden moeten voorkomen
        # in het card_id óf in de tags van een kaart die je bestuurt.
        woorden = [w.lower() for w in re.split(r"[\s_]+", str(condition_value or "")) if w]
        if not woorden:
            return False
        for c in deck:
            if c.get("destroyed"):
                continue
            hooiberg = (str(c.get("card_id", "")) + " " +
                        " ".join(str(t) for t in (c.get("tags") or []))).lower()
            if all(w in hooiberg for w in woorden):
                return True
        return False
    
    elif condition_type == "is_only_rarity":
        return all(c.get("rarity") == condition_value for c in deck if c["card_type"] == "Project")
    
    elif condition_type == "has_mc_below":
        try:
            threshold = float(condition_value)
            return card.get("current_mc", 0) < threshold
        except:
            return False
        
    elif condition_type == "has_tag_count":
        try:
            tag, count_required = condition_value.split(":")
            count_required = int(count_required)
            count = sum(
                1
                for c in deck
                if tag in c.get("tags", []) and c.get("card_type") == "Project" and not c.get("destroyed", False)
            )
            return count >= count_required
        except:
            return False
        
    elif condition_type == "count_card_rarity":
    # Example: "common_nova_>=2"
        try:
            parts = condition_value.split("_")
            rarity = parts[0].capitalize()   # "common" -> "Common"
            tag = parts[1].capitalize()      # "nova" -> "Nova"
            operator, threshold = parts[2].split(">=") if ">=" in parts[2] else (None, None)

            threshold = int(threshold) if threshold else 0

            count = sum(1 for c in deck 
                        if c["card_type"] in ["Project", "Founder"] 
                        and not c.get("destroyed") 
                        and c.get("rarity", "").lower() == rarity.lower() 
                        and tag in [t.lower() for t in c.get("tags", [])])

            if operator == ">=":
                return count >= threshold
            elif operator == ">":
                return count > threshold
            elif operator == "==":
                return count == threshold
            else:
                return False
        except Exception as e:
            return False


        
    elif condition_type == "tags_match":
        try:
            role, tag = condition_value.split("=")
            projects = [c for c in deck if c["card_type"] == "Project" and not c.get("destroyed")]
            if not projects:
                return False
            lowest = min(projects, key=lambda x: x.get("current_mc", 0))
            highest = max(projects, key=lambda x: x.get("current_mc", 0))
            if role == "lowest_highest":
                return tag in lowest.get("tags", []) and tag in highest.get("tags", [])
        except:
            return False

    elif condition_type == "has_exact_rarities":
        try:
            required = set(condition_value.split(","))
            actual = set(c.get("rarity") for c in deck if c.get("rarity"))
            return required.issubset(actual)
        except:
            return False
        
    elif condition_type == "mc_range":
        # De kaarttekst gaat over je Projecten samen ("je hebt zowel een kaart
        # onder de 10 als een boven de 30"), niet over de MC van de bronkaart
        # zelf. Die kan nooit tegelijk onder 10 en boven 30 zijn, dus dit was
        # altijd False.
        veld = list(getattr(player, "field", None) or field or [])
        projecten = [c for c in veld
                     if isinstance(c, dict) and c.get("card_type") == "Project"
                     and not c.get("destroyed")]
        grenzen = re.findall(r"([<>]=?)\s*(\d+(?:\.\d+)?)", str(condition_value or ""))
        if not projecten or not grenzen:
            return False
        for teken, grens in grenzen:
            grens = float(grens)
            if teken.startswith("<") and not any(c.get("current_mc", 0) < grens for c in projecten):
                return False
            if teken.startswith(">") and not any(c.get("current_mc", 0) > grens for c in projecten):
                return False
        return True
        
    elif condition_type == "target_nova_project":
        return any("Nova" in c.get("tags", []) for c in deck)
    
    elif condition_type == "projects_with_7_mc":
        count = sum(1 for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed") and "7" in str(int(c.get("current_mc", 0))))
        try:
            threshold = int(condition_value.replace(">=", "").strip())
        except:
            threshold = 1
        return count >= threshold
    
    
    elif condition_type == "own_debuffed_count":
        from operator import ge, gt, le, lt, eq

        # Count own Projects that were marked as debuffed
        count = sum(
            1 for c in player.field
            if c.get("card_type") == "Project" and not c.get("destroyed") and c.get("was_debuffed", False)
        )

        # Fallback: check if MC dropped below base
        if count == 0:
            count = sum(
                1 for c in player.field
                if c.get("card_type") == "Project"
                and not c.get("destroyed")
                and c.get("current_mc", 0) < c.get("base_mc", 0)
            )

        # Parse condition_value (e.g. ">=2")
        match = re.match(r"(>=|<=|>|<|=)?\s*(\d+)", str(condition_value).strip())
        if not match:
            return False  # Invalid format

        op_str, threshold = match.groups()
        threshold = int(threshold)
        op_func = {
            ">=": ge,
            ">": gt,
            "<=": le,
            "<": lt,
            "=": eq,
            None: eq  # default to equality
        }.get(op_str, eq)

        return op_func(count, threshold)


    elif condition_type == "own_project_destroyed":
        destroyed = [
            c for c in player.field
            if c.get("card_type") == "Project" and c.get("destroyed")
        ]
        if not destroyed:
            return f"💥 No own Projects were destroyed this match"

        dak_survivors = [
            c for c in (player.field + opponent.field)
            if c.get("card_type") == "Project"
            and "DAK" in c.get("tags", [])
            and not c.get("destroyed")
            and c.get("card_id") != card.get("card_id")
        ]

        if not dak_survivors:
            return f"🚫 No surviving DAK Projects available for {card['card_id']} to buff"

        return True
    
    elif condition_type == "survives_debuff":
        print(f"[DEBUG] Checking survives_debuff for {card['card_id']} → was_debuffed={card.get('was_debuffed')} destroyed={card.get('destroyed')}")
        return card.get("was_debuffed", False) and not card.get("destroyed", False)




    elif condition_type == "nova_destroyed":
        destroyed = [
            c for c in player.field + opponent_field
            if c.get("card_type") == "Project" and c.get("destroyed") and "Nova" in c.get("tags", [])
        ]
        return len(destroyed) > 0
    
    elif condition_type == "own_mc_loss_count":
        count = 0
        for c in player.field:
            if c.get("card_type") == "Project" and not c.get("destroyed"):
                base = c.get("base_mc", 0)
                current = c.get("current_mc", 0)
                if current < base:
                    count += 1
        threshold = int(condition_value.replace(">=", "").strip())
        return count >= threshold
    
    elif condition_type == "self_debuffed":
        # 'was_debuffed' wordt nergens in de engine gezet. De vlaggen die wél
        # bestaan zijn targeted_by_debuff (per fase) en de match-totalen.
        return bool(card.get("_ever_debuffed") or card.get("targeted_by_debuff")
                    or card.get("_mc_lost_total") or card.get("lost_mc_this_phase")
                    or card.get("was_debuffed"))

    elif condition_type == "final_calc_survivors":
        required = int(condition_value.lstrip(">="))
        surviving_projects = [
            c for c in player.field
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        survivor_count = len(surviving_projects)

        if log is not None:
            log.append(f"🧮 Final survivor count for {card['card_id']}: {survivor_count}")

        if survivor_count >= required:
            return True, None
        else:
            return False, f"❌ Condition not met: final_calc_survivors (found {survivor_count}, need ≥ {required})"


        
    elif condition_type == "lowest_friendly_and_enemy_exist":
        own_projects = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed", False)]
        opp_projects = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed", False)]
        return len(own_projects) > 0 and len(opp_projects) > 0





    elif condition_type == "control_project_cards":
        # True if player controls at least 1 Project card
        projects = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return len(projects) > 0
    
    elif condition_type == "tag":
        tag = condition_value
        projects = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return any(tag in c.get("tags", []) for c in projects)
    
    elif condition_type == "lowest_own_exists":
        projects = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return len(projects) > 0

    elif condition_type == "enemy_highest_mc":
        projects = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return len(projects) > 0
    
    elif condition_type == "highest_immune":
        return True

    # =========================================================================
    # Voorwaarden die eerder ontbraken.
    #
    # check_condition_core valt aan het eind door naar False. Een voorwaarde die
    # hier niet stond maakte de kaart dus permanent stil: de engine meldde
    # "could not act — in_play (True)" terwijl de kaart gewoon in het spel lag.
    # Een audit over 25.000 matches wees 31 kaarten aan die hierdoor nooit iets
    # deden. Onderstaande blokken volgen de kaartteksten.
    # =========================================================================

    _eigen = list(getattr(player, "field", None) or field or [])
    _vijand = list(getattr(opponent, "field", None) or opponent_field or [])

    def _levend(cs):
        return [c for c in cs if isinstance(c, dict) and not c.get("destroyed")]

    def _projects(cs):
        return [c for c in _levend(cs) if c.get("card_type") == "Project"]

    def _kapot(cs):
        return [c for c in cs if isinstance(c, dict) and c.get("destroyed")]

    def _heeft_tag(c, tag):
        return any(str(t).strip().lower() == str(tag).strip().lower() for t in (c.get("tags") or []))

    def _drempel(spec, standaard_op=">=", standaard_n=1):
        """'>=2', '≥4', 'Rare ≥ 2', '3' -> (operator, getal)."""
        s = str(spec if spec is not None else "").replace("≥", ">=").replace("≤", "<=")
        m = re.search(r"(>=|<=|==|>|<)?\s*(\d+(?:\.\d+)?)", s)
        if not m:
            return standaard_op, standaard_n
        return (m.group(1) or standaard_op), float(m.group(2))

    def _vergelijk(waarde, op, grens):
        if op == ">=": return waarde >= grens
        if op == "<=": return waarde <= grens
        if op == ">":  return waarde > grens
        if op == "<":  return waarde < grens
        return waarde == grens

    # --- passieve effecten wapenen zichzelf ----------------------------------
    # "Kan niet meer dan 5 MC verliezen" en "telt als hoogste kaart voor
    # vernietiging" zijn eigenschappen van de kaart zelf; er is niets te toetsen
    # behalve dat de kaart er ligt.
    if condition_type in ("limit_loss", "destruction_targeting",
                          "effect_targeted_highest", "first_destruction_attempt",
                          "destruction_attempt", "first_debuff"):
        # Passieve schilden en omleidingen: er is niets te toetsen behalve dat de
        # kaart er ligt. Ze wapenen zichzelf en worden pas verzilverd op het
        # moment dat er daadwerkelijk een effect of vernietiging binnenkomt.
        return not card.get("destroyed", False)

    # --- de kaart ligt er gewoon ---------------------------------------------
    elif condition_type in ("in_play", "valid"):
        # 'valid' hoort bij een swap tussen hoogste en laagste: dat vraagt er twee.
        if condition_type == "valid":
            return len(_projects(_eigen)) >= 2
        return not card.get("destroyed", False)

    elif condition_type == "survives_destruction":
        return not card.get("destroyed", False)

    elif condition_type == "after_all_resolve":
        # Deze effecten staan in de Final-fase; daar is 'alles is afgehandeld' waar.
        return True

    elif condition_type == "during_debuff_phase":
        fase = (context or {}).get("phase") or (effect or {}).get("phase")
        return str(fase or "Debuff").lower() == "debuff"

    # --- tellingen op het eigen veld -----------------------------------------
    elif condition_type == "count_tag_on_field":
        tag = re.split(r"[><=≥≤]", str(condition_value or ""))[0].strip()
        op, n = _drempel(condition_value, ">=", 2)
        return _vergelijk(sum(1 for c in _levend(_eigen) if _heeft_tag(c, tag)), op, n)

    elif condition_type == "meme_tagged":
        return any(_heeft_tag(c, "Meme") for c in _levend(_eigen))

    elif condition_type == "control_all_rarities":
        aanwezig = {str(c.get("rarity", "")).lower() for c in _projects(_eigen)}
        return {"common", "rare", "epic", "legendary", "mythical"}.issubset(aanwezig)

    # --- vernietiging ---------------------------------------------------------
    elif condition_type == "own_destroyed_count":
        op, n = _drempel(condition_value, ">=", 2)
        return _vergelijk(len(_kapot(_eigen)), op, n)

    elif condition_type == "projects_destroyed":
        op, n = _drempel(condition_value, ">=", 3)
        aantal = len([c for c in _kapot(_eigen) + _kapot(_vijand) if c.get("card_type") == "Project"])
        return _vergelijk(aantal, op, n)

    elif condition_type == "destroyed_friendly_wolfswap":
        return any(c is not card and _heeft_tag(c, "Wolfswap") for c in _kapot(_eigen))

    elif condition_type == "cr00ts_destroyed_count":
        op, n = _drempel(condition_value, ">=", 2)
        aantal = len([c for c in _kapot(_eigen) + _kapot(_vijand) if _heeft_tag(c, "Cr00ts")])
        return _vergelijk(aantal, op, n)

    elif condition_type == "destroyed_enemy_by_friendly":
        return len([c for c in _kapot(_vijand) if c.get("card_type") == "Project"]) > 0

    elif condition_type == "COC_RR_M1_exploded":
        return any("RR_M1" in str(c.get("card_id", "")) for c in _kapot(_eigen) + _kapot(_vijand))

    elif condition_type == "survivor_count_eq":
        op, n = _drempel(condition_value, "==", 3)
        return _vergelijk(len(_projects(_eigen)), op if op != ">=" else "==", n)

    # --- schade en MC-verlies -------------------------------------------------
    elif condition_type in ("hit_by_debuff", "any_project_takes_damage"):
        return any(c.get("_ever_debuffed") or c.get("targeted_by_debuff") or c.get("_mc_lost_total")
                   for c in _projects(_eigen))

    elif condition_type == "loses_mc_from_effect":
        return bool(card.get("_ever_debuffed") or card.get("targeted_by_debuff")
                    or card.get("_mc_lost_total") or card.get("lost_mc_this_phase"))

    elif condition_type == "cards_lost_mc":
        op, n = _drempel(condition_value, ">=", 2)
        aantal = len([c for c in _eigen if c.get("_mc_lost_total") or c.get("lost_mc_this_phase")])
        return _vergelijk(aantal, op, n)

    elif condition_type == "causes_mc_loss":
        # De kaarttekst zegt "aan welke kaart dan ook, vriend of vijand", dus we
        # kijken naar beide velden en niet alleen naar de tegenstander.
        return any(c.get("_mc_lost_total") or c.get("lost_mc_this_phase")
                   for c in (_eigen + _vijand))

    # --- MC-vergelijkingen ----------------------------------------------------
    elif condition_type == "total_mc_lt_opponent":
        eigen_mc = sum(c.get("current_mc", 0) for c in _projects(_eigen))
        vijand_mc = sum(c.get("current_mc", 0) for c in _projects(_vijand))
        return eigen_mc < vijand_mc

    elif condition_type == "lowest_project_mc_lt":
        _op, n = _drempel(condition_value, "<", 10)
        projecten = _projects(_eigen)
        return bool(projecten) and min(c.get("current_mc", 0) for c in projecten) < n

    elif condition_type == "total_mc_mod":
        _op, n = _drempel(condition_value, "==", 7)
        totaal = sum(c.get("current_mc", 0) for c in _projects(_eigen))
        return n > 0 and round(totaal) % int(n) == 0

    # --- voorwaarden die alleen de uitleg-functie kende ----------------------
    # match_simulator.get_skip_reason had voor deze negen wél een tekst, maar
    # check_condition_core niet. Ze vielen dus door naar `return False`: de kaart
    # deed nooit iets, terwijl het logboek soms meldde dat de voorwaarde gehaald
    # was. Samen raakte dat dertien kaarten.

    elif condition_type == "any_card_mc_lt":
        _op, n = _drempel(condition_value, "<", 5)
        return any(c.get("current_mc", 0) < n for c in _levend(_eigen))

    elif condition_type == "enemy_project_destroyed_once":
        return len(_kapot(_vijand)) > 0

    elif condition_type == "on_project_destroyed":
        return len(_kapot(_eigen)) > 0

    elif condition_type == "own_projects_lost_mc":
        op, n = _drempel(condition_value, ">=", 2)
        aantal = len([c for c in _projects(_eigen)
                      if c.get("_mc_lost_total") or c.get("lost_mc_this_phase")])
        return _vergelijk(aantal, op, n)

    elif condition_type == "project_count":
        op, n = _drempel(condition_value, "==", 3)
        return _vergelijk(len(_projects(_eigen)), "==" if op == ">=" else op, n)

    elif condition_type == "survived_destruction_count":
        op, n = _drempel(condition_value, ">=", 2)
        return _vergelijk(len(_projects(_eigen)), op, n)

    elif condition_type == "more_projects_than_opponent":
        meer = len(_projects(_eigen)) > len(_projects(_vijand))
        # COC_CF_M1 heeft twee effecten: één voor "wel meer", één voor "niet meer".
        wil_meer = str(condition_value).strip().lower() not in ("false", "0", "no")
        return meer if wil_meer else (not meer)

    elif condition_type == "targeted_by_debuff":
        return bool(card.get("targeted_by_debuff") or card.get("_ever_debuffed")
                    or card.get("_mc_lost_total") or card.get("lost_mc_this_phase"))

    elif condition_type == "final_calc":
        waarde = str(condition_value or "").strip().lower()
        if waarde == "enemy_lt_20":
            return any(c.get("current_mc", 0) < 20 for c in _projects(_vijand))
        if waarde == "lowest_survivor":
            return len(_projects(_eigen)) > 0
        # Onbekende variant: alleen doorlaten als er iets te raken valt.
        return len(_projects(_eigen)) > 0

    elif condition_type == "own_projects_mc_end_7":
        op, n = _drempel(condition_value, ">=", 3)
        aantal = len([c for c in _projects(_eigen) if int(abs(c.get("current_mc", 0))) % 10 == 7])
        return _vergelijk(aantal, op, n)







    return False
