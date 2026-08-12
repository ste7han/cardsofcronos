# targeting.py
import random
from types import SimpleNamespace

from constants import RARITY_ORDER
from utils import log_event, pretty_log, CardLogGroup


# ------------------------ helpers ------------------------

def _as_card_dict(x):
    if isinstance(x, dict):
        return x
    if isinstance(x, list) and x and isinstance(x[0], dict):
        return x[0]
    return {}

def _as_card_list(seq):
    out = []
    if not isinstance(seq, list):
        seq = [seq] if seq is not None else []
    for c in seq:
        if isinstance(c, dict):
            out.append(c)
        elif isinstance(c, list) and c and isinstance(c[0], dict):
            out.append(c[0])
    return out

def _coerce_player_like(obj, default_name="Player 1") -> SimpleNamespace:
    """
    Ensure we always have an object with these attributes:
      .name .field .hand .supports .founders .deck
      .destroyed_cards .graveyard .removed_cards
      .mc_loss_this_phase .mc_gain_this_phase .phase_triggers
    All list fields normalized to list[dict]; trackers are dicts.
    """
    # None → fully initialized namespace
    if obj is None:
        return SimpleNamespace(
            name=default_name,
            field=[], hand=[], supports=[], founders=[], deck=[],
            destroyed_cards=[], graveyard=[], removed_cards=[],
            mc_loss_this_phase={}, mc_gain_this_phase={}, phase_triggers={},
        )

    # dict → namespace with normalized lists & safe trackers
    if isinstance(obj, dict):
        destroyed = obj.get("destroyed_cards", obj.get("graveyard", obj.get("destroyed", [])))
        return SimpleNamespace(
            name=str(obj.get("name", default_name)),
            field=_as_card_list(obj.get("field", [])),
            hand=_as_card_list(obj.get("hand", [])),
            supports=_as_card_list(obj.get("supports", [])),
            founders=_as_card_list(obj.get("founders", [])),
            deck=_as_card_list(obj.get("deck", [])),
            destroyed_cards=_as_card_list(destroyed),
            graveyard=_as_card_list(obj.get("graveyard", destroyed)),
            removed_cards=_as_card_list(obj.get("removed_cards", [])),
            mc_loss_this_phase=dict(obj.get("mc_loss_this_phase") or {}),
            mc_gain_this_phase=dict(obj.get("mc_gain_this_phase") or {}),
            phase_triggers=dict(obj.get("phase_triggers") or {}),
        )

    # object-like → normalize in place; add missing fields
    try:
        obj.name     = getattr(obj, "name", default_name)
        obj.field    = _as_card_list(getattr(obj, "field", []))
        obj.hand     = _as_card_list(getattr(obj, "hand", []))
        obj.supports = _as_card_list(getattr(obj, "supports", []))
        obj.founders = _as_card_list(getattr(obj, "founders", []))
        obj.deck     = _as_card_list(getattr(obj, "deck", obj.field))

        destroyed = _as_card_list(
            getattr(obj, "destroyed_cards",
                    getattr(obj, "graveyard",
                            getattr(obj, "destroyed", [])))
        )
        if not hasattr(obj, "destroyed_cards"): obj.destroyed_cards = destroyed
        if not hasattr(obj, "graveyard"):       obj.graveyard       = destroyed
        if not hasattr(obj, "removed_cards"):   obj.removed_cards   = _as_card_list(getattr(obj, "removed_cards", []))

        if not hasattr(obj, "mc_loss_this_phase"): obj.mc_loss_this_phase = {}
        if not hasattr(obj, "mc_gain_this_phase"): obj.mc_gain_this_phase = {}
        if not hasattr(obj, "phase_triggers"):     obj.phase_triggers     = {}
        return obj
    except Exception:
        # immutable/foreign object → wrap
        return SimpleNamespace(
            name=getattr(obj, "name", default_name),
            field=_as_card_list(getattr(obj, "field", [])),
            hand=_as_card_list(getattr(obj, "hand", [])),
            supports=_as_card_list(getattr(obj, "supports", [])),
            founders=_as_card_list(getattr(obj, "founders", [])),
            deck=_as_card_list(getattr(obj, "deck", [])),
            destroyed_cards=_as_card_list(getattr(obj, "destroyed_cards", [])),
            graveyard=_as_card_list(getattr(obj, "graveyard", [])),
            removed_cards=_as_card_list(getattr(obj, "removed_cards", [])),
            mc_loss_this_phase=dict(getattr(obj, "mc_loss_this_phase", {}) or {}),
            mc_gain_this_phase=dict(getattr(obj, "mc_gain_this_phase", {}) or {}),
            phase_triggers=dict(getattr(obj, "phase_triggers", {}) or {}),
        )


# ------------------------ targeting ------------------------

def get_targets(target_type, player, opponent, source_card,
                self_deck, opponent_deck, effect=None, context=None, log=None):
    """Kiest de doelen en past daarna twee onderscheppingen toe.

    get_targets heeft tientallen return-paden, dus het omleiden gebeurt hier in
    een omhulsel: zo komt élke doelkeuze er langs, ook die uit oudere takken.
    """
    gekozen = _get_targets_raw(target_type, player, opponent, source_card,
                               self_deck, opponent_deck, effect, context, log)
    return _pas_onderschepping_toe(gekozen, player, opponent, self_deck, opponent_deck,
                                   source_card, context, log)


def _projecten(veld):
    return [c for c in (veld or [])
            if isinstance(c, dict) and c.get("card_type") == "Project" and not c.get("destroyed")]


def _feitelijk_hoogste(veld):
    p = _projecten(veld)
    return max(p, key=lambda c: c.get("current_mc", 0)) if p else None


def _meld(context, log, tekst):
    if log is None:
        return
    try:
        log_event(context, log, "immune", tekst)
    except Exception:
        pass


def _pas_onderschepping_toe(gekozen, player, opponent, self_deck, opponent_deck,
                            source_card, context, log):
    """Twee passieve effecten grijpen in op de doelkeuze.

    override_mc_value — een kaart "telt als de hoogste MC-kaart", dus effecten
    die op de hoogste mikken komen bij haar terecht.
    redirect — effecten die op je hoogste Project mikken gaan naar een andere
    kaart.

    Beide worden hier afgehandeld omdat elke doelkeuze langs deze plek komt.
    """
    if not gekozen:
        return gekozen

    velden = []
    for speler, veld in ((player, self_deck), (opponent, opponent_deck)):
        velden.append((getattr(speler, "name", None),
                       list(getattr(speler, "field", None) or veld or [])))

    uit = []
    for t in gekozen:
        if not isinstance(t, dict):
            uit.append(t)
            continue

        huidig = t
        for naam, veld in velden:
            if naam is not None and t.get("owner") != naam:
                continue
            if t is not _feitelijk_hoogste(veld):
                break

            # 1. Trekt een kaart de aandacht naar zich toe?
            lokaas = next((c for c in _projecten(veld)
                           if c.get("_counts_as_highest") and c is not huidig), None)
            if lokaas is not None:
                _meld(context, log,
                      f"🛡️ {lokaas.get('card_id')} counts as the highest Project and is "
                      f"targeted instead of {huidig.get('card_id')}")
                huidig = lokaas

            # 2. Wordt het effect omgeleid?
            omleiding = next((c for c in veld
                              if isinstance(c, dict) and c.get("_redirect_doel")
                              and not c.get("destroyed") and c is not huidig
                              and not c.get("_redirect_verbruikt")), None)
            if omleiding is not None:
                if omleiding.get("_redirect_eenmalig"):
                    omleiding["_redirect_verbruikt"] = True
                _meld(context, log,
                      f"🛡️ Effect aimed at {huidig.get('card_id')} is redirected "
                      f"to {omleiding.get('card_id')}")
                huidig = omleiding
            break

        uit.append(huidig)
    return uit


def _get_targets_raw(
    target_type, player, opponent, source_card,
    self_deck, opponent_deck, effect=None,
    context=None, log=None
):
    # Harden inputs & defaults
    context = context or {}
    effect  = effect or {}

    # Normalize players so .field etc exist and are list[dict]
    player   = _coerce_player_like(player,   "Player 1")
    opponent = _coerce_player_like(opponent, "Player 2")
    context["player"]   = player
    context["opponent"] = opponent

    # Normalize source card
    source_card = _as_card_dict(source_card)

    # Allow callers to omit decks; fall back to context or player attrs
    if not isinstance(self_deck, list) or not self_deck:
        self_deck = context.get("field") or getattr(player, "field", []) or []
    if not isinstance(opponent_deck, list) or not opponent_deck:
        opponent_deck = context.get("opponent_field") or getattr(opponent, "field", []) or []

    field          = _as_card_list(self_deck)
    opponent_field = _as_card_list(opponent_deck)

    # Log setup
    if "log" not in context:
        context["log"] = []
    if log is None:
        log = context["log"]

    # Keep normalized values in context for downstream helpers
    context["field"]          = field
    context["self_field"]     = field
    context["opponent_field"] = opponent_field
    context["source_card"]    = source_card
    context["effect"]         = effect

    # Validate & normalize target_type
    if not isinstance(target_type, str):
        return []
    tt = target_type.strip().lower()

    # Safe accumulator (even if we fall through)
    targets = []

    # -------- combined selectors like "ally_field+random_enemy" --------
    if "+" in tt:
        combined = []
        for part in [p.strip() for p in tt.split("+") if p.strip()]:
            combined.extend(
                get_targets(
                    part, player, opponent, source_card,
                    field, opponent_field, effect,
                    context=context, log=log
                ) or []
            )
        return _as_card_list(combined)

    # ---------------------- basic selectors ----------------------
    if tt in ("self", "this", "source"):
        return [source_card] if source_card else []
    if tt in ("ally_field", "all_allies", "self_field"):
        return list(field)
    if tt in ("enemy_field", "all_enemies", "opponent_field"):
        return list(opponent_field)
    if tt == "random_ally":
        return [random.choice(field)] if field else []
    if tt == "random_enemy":
        return [random.choice(opponent_field)] if opponent_field else []

    # ---------------------- special cases ----------------------
    if tt == "lowest_project":
        projects = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [min(projects, key=lambda x: x.get("current_mc", 0))] if projects else []

    if tt == "lowest":
        valid = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [min(valid, key=lambda x: x.get("current_mc", 0))] if valid else []

    if tt == "enemy_two":
        valid = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return random.sample(valid, 2) if len(valid) >= 2 else []

    if tt == "all_own_rarity=rare":
        return [
            c for c in player.field
            if c.get("card_type") == "Project" and c.get("rarity") == "Rare" and not c.get("destroyed")
        ]

    if tt == "opponent_lowest":
        valid = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [min(valid, key=lambda c: c.get("current_mc", 0))] if valid else []

    if tt == "random_meme_own":
        valid = [
            c for c in player.field
            if c.get("card_type") == "Project" and "Meme" in c.get("tags", []) and not c.get("destroyed")
        ]
        return [random.choice(valid)] if valid else []

    if tt == "all_other_projects":
        return [
            c for c in field + opponent_field
            if c.get("card_type") == "Project" and not c.get("destroyed") and c is not source_card
        ]

    if tt == "random_surviving_dak":
        pool = [
            c for c in (player.field + opponent.field)
            if c.get("card_type") == "Project"
            and "DAK" in c.get("tags", [])
            and not c.get("destroyed", False)
            and c.get("card_id") != source_card.get("card_id")
        ]
        return [random.choice(pool)] if pool else []

    if tt == "random_enemy_support":
        valid = [
            c for c in opponent_field
            if c.get("card_type") == "Support" and not c.get("destroyed") and not c.get("disabled")
        ]
        if valid:
            choice = random.choice(valid)
            # prevent self-disable edge case
            if choice.get("card_id") == source_card.get("card_id"):
                return []
            return [choice]
        return []

    if tt == "random_common_cr00ts":
        candidates = [
            c for c in player.field
            if c.get("card_type") == "Project"
            and c.get("rarity", "").lower() == "common"
            and "cr00ts" in [t.lower() for t in c.get("tags", [])]
            and not c.get("destroyed", False)
        ]
        return [random.choice(candidates)] if candidates else []

    if tt == "all":
        out = []
        for c in player.field:
            if c.get("card_type") == "Project" and not c.get("destroyed"):
                c["owner"] = player.name
                out.append(c)
        for c in opponent.field:
            if c.get("card_type") == "Project" and not c.get("destroyed"):
                c["owner"] = opponent.name
                out.append(c)
        return out

    if tt == "random_enemy_project":
        pool = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(pool)] if pool else []

    if tt == "all_enemy_projects":
        return [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]

    if tt == "random_friendly_project":
        pool = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(pool)] if pool else []

    if tt in ("all_own_projects", "all_friendly_projects"):
        return [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]

    if tt == "all_meme_tagged":
        return [
            c for c in field + opponent_field
            if c.get("card_type") == "Project" and "Meme" in c.get("tags", []) and not c.get("destroyed")
        ]

    if tt == "each":
        return [c for c in field if c.get("card_type") == "Project"]

    if tt == "all_machine":
        return [c for c in field if "Machine" in c.get("tags", []) and not c.get("destroyed")]

    if tt == "all_projects_on_field":
        return [c for c in field + opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]

    if tt == "each_enemy":
        return [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]

    if tt == "all_nova":
        return [c for c in field + opponent_field if "Nova" in c.get("tags", []) and not c.get("destroyed")]

    if tt == "lowest_friendly_and_enemy_project":
        friendly = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        enemy    = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        out = []
        if friendly: out.append(min(friendly, key=lambda x: x.get("current_mc", 0)))
        if enemy:    out.append(min(enemy,    key=lambda x: x.get("current_mc", 0)))
        return out

    if tt == "enemy":
        # optional special case
        if effect.get("condition_type") == "enemy_highest_mc":
            valid = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
            return [max(valid, key=lambda x: x.get("current_mc", 0))] if valid else []
        valid = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(valid)] if valid else []

    if tt == "highest_friendly_project":
        projects = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [max(projects, key=lambda x: x.get("current_mc", 0))] if projects else []

    if tt == "random_project_each_player":
        # Not implemented by design in your logic
        return []

    if tt == "friendly_projects_rarity=rareorlower":
        return [
            c for c in field
            if c.get("card_type") == "Project"
            and not c.get("destroyed")
            and RARITY_ORDER.get(c.get("rarity")) is not None
            and RARITY_ORDER[c["rarity"]] <= RARITY_ORDER["Rare"]
        ]

    if tt == "random_common_own":
        commons = [
            c for c in player.field
            if c.get("card_type") == "Project" and not c.get("destroyed")
            and (c.get("rarity", "").lower() == "common")
        ]
        return [random.choice(commons)] if commons else []

    if tt in ("lowest_own_project", "lowest_friendly_project", "lowest_own"):
        friendly = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [min(friendly, key=lambda x: x.get("current_mc", 0))] if friendly else []

    if tt == "random_own_and_other":
        own   = [c for c in player.field   if c.get("card_type") == "Project" and not c.get("destroyed")]
        other = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(own), random.choice(other)] if own and other else []

    if tt == "random_own_and_enemy":
        own   = [c for c in player.field   if c.get("card_type") == "Project" and not c.get("destroyed")]
        enemy = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(own), random.choice(enemy)] if own and enemy else []

    if tt == "random_enemy_projects":
        alive = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        n = int(effect.get("target_count", effect.get("action_value", 1)))
        return random.sample(alive, min(n, len(alive))) if alive else []

    if tt == "lowest_friendly_and_enemy":
        own = min(
            [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed", False)],
            key=lambda c: c.get("current_mc", 0),
            default=None
        )
        ene = min(
            [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed", False)],
            key=lambda c: c.get("current_mc", 0),
            default=None
        )
        return [own, ene] if own and ene else []

    if tt == "all_projects_lost_mc":
        return [
            p for p in getattr(player, "field", [])
            if p.get("card_type") == "Project"
            and not p.get("destroyed", False)
            and p.get("mc_loss_total", 0) > 0
        ]

    if tt == "random":
        # placeholder — action handler will decide
        return [{}]

    if tt == "second_highest_friendly_project":
        projects = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        if len(projects) < 2:
            return []
        projects.sort(key=lambda x: x.get("current_mc", 0), reverse=True)
        return [projects[1]]

    if tt.startswith("random_common_tagged="):
        tag = tt.split("=", 1)[1]
        tagged = [c for c in field if tag in c.get("tags", []) and c.get("rarity") == "Common"]
        return [random.choice(tagged)] if tagged else []

    if tt == "enemy_project":
        valid = [
            c for c in opponent.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed")
            and c.get("current_mc", 0) < source_card.get("current_mc", 0)
        ]
        return [random.choice(valid)] if valid else []

    if tt == "enemy_random":
        valid = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(valid)] if valid else []

    if tt == "all_clove_projects":
        return [
            c for c in player.field
            if c.get("card_type") == "Project" and "Clove" in c.get("tags", []) and not c.get("destroyed")
        ]

    if tt == "all_projects_both":
        return [
            c for c in player.field + opponent.field
            if c.get("card_type") == "Project" and not c.get("destroyed")
        ]

    if tt == "highest_enemy_project":
        valid = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [max(valid, key=lambda x: x.get("current_mc", 0))] if valid else []

    if tt == "random_friendly_project_except_self":
        candidates = [c for c in player.field if c is not source_card and c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(candidates)] if candidates else []

    if tt == "all_friendly_meme_except_self":
        return [
            c for c in player.field
            if c is not source_card and "Meme" in c.get("tags", []) and not c.get("destroyed")
        ]

    if tt == "own_highest_nova":
        nova = [c for c in player.field if "Nova" in c.get("tags", []) and not c.get("destroyed")]
        return [max(nova, key=lambda x: x.get("current_mc", 0))] if nova else []

    if tt == "matching_enemy_project":
        desired = effect.get("condition_value") or context.get("last_condition_value")
        # hard default for Wolfswap_E1
        if not desired and source_card.get("card_id") == "COC_Wolfswap_E1":
            desired = "Epic"
        if not desired:
            return []
        candidates = [
            c for c in opponent.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("rarity") == desired
        ]
        return random.sample(candidates, 1) if candidates else []

    if tt == "lowest_enemy_project":
        enemy_projects = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed", False)]
        if not enemy_projects:
            return []
        return [min(enemy_projects, key=lambda x: x.get("current_mc", x.get("base_mc", 0.0)))]

    if tt == "all_projects":
        allp = [c for c in player.field + opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        if effect.get("condition_type") == "mc_less_than":
            try:
                thr = float(effect.get("condition_value", 0))
                allp = [c for c in allp if c.get("current_mc", 0) < thr]
            except Exception:
                pass
        return allp

    if tt == "random_2_any":
        candidates = [c for c in field + opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return candidates if len(candidates) <= 2 else random.sample(candidates, 2)

    if tt == "own_lowest_and_highest":
        pool = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed", False)]
        if len(pool) < 2:
            return []
        pool_sorted = sorted(pool, key=lambda c: (c.get("current_mc", 0), c.get("card_id")))
        return [pool_sorted[0], pool_sorted[-1]]

    if tt == "random_machine":
        pool = [
            c for c in field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and "Machine" in c.get("tags", [])
        ]
        src_id = source_card.get("card_id")
        pool = [c for c in pool if c.get("card_id") != src_id]
        return [random.choice(pool)] if pool else []

    if tt == "random_common":
        pool = [
            c for c in field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("rarity", "").lower() == "common"
        ]
        return random.sample(pool, 1) if pool else []

    if tt == "all_except_lowest":
        alive = [c for c in player.field + opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        if not alive:
            return []
        lowest = min([c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")],
                     key=lambda x: x.get("current_mc", 0), default=None)
        return [c for c in alive if c is not lowest]

    if tt == "wolfswap_m1_lowest_two":
        alive = [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed", False)]
        alive.sort(key=lambda x: x.get("current_mc", 0))
        return alive[:2]

    if tt == "random_own_3":
        valid_targets = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return random.sample(valid_targets, min(3, len(valid_targets))) if valid_targets else []

    if tt == "enemy_lowest_highest":
        enemy_projects = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        if len(enemy_projects) < 2:
            return []
        return [
            min(enemy_projects, key=lambda x: x.get("current_mc", 0)),
            max(enemy_projects, key=lambda x: x.get("current_mc", 0))
        ]

    if tt == "all_community_projects":
        return [c for c in field + opponent_field if "Community" in c.get("tags", []) and not c.get("destroyed")]

    if tt in ("own_projects_mc_lt", "own_projects_under_mc", "own_projects_below_mc"):
        raw = str(effect.get("condition_value", "20")).strip()
        try:
            threshold = float(raw.split(",")[0].strip())
        except Exception:
            threshold = 20.0
        return [
            c for c in field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("current_mc", c.get("base_mc", 0)) < threshold
        ]

    if tt == "random_project_on_field":
        combined = [c for c in field + opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return [random.choice(combined)] if combined else []

    if tt == "enemy_lt_20":
        candidates = [
            c for c in opponent.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and (c.get("current_mc", c.get("base_mc", 0)) < 20)
        ]
        return [random.choice(candidates)] if candidates else []

    if tt == "lowest_and_highest_project_on_field":
    # use the decks we were passed (works even if you don't define `field/opponent_field`)
        pool = [
            c for c in (_as_card_list(self_deck) + _as_card_list(opponent_deck))
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        if len(pool) < 2:
            return []

        # optional debug
        try:
            cand_str = ", ".join(
                f"{c.get('card_id')} ({c.get('current_mc', c.get('base_mc', 0))})"
                for c in pool
            )
            log_event(context, log, "debug", f"[DEBUG] Pump & Dump candidates → [{cand_str}]")
        except Exception:
            pass

        lowest  = min(pool, key=lambda c: c.get("current_mc", c.get("base_mc", 0)))
        highest = max(pool, key=lambda c: c.get("current_mc", c.get("base_mc", 0)))
        return [lowest, highest]


    if tt == "lowest_own_and_opponent":
        own  = [c for c in field          if c.get("card_type") == "Project" and not c.get("destroyed")]
        enem = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        out = []
        if own:  out.append(min(own,  key=lambda x: x.get("current_mc", 0)))
        if enem: out.append(min(enem, key=lambda x: x.get("current_mc", 0)))
        return out

    if tt == "random_own":
        pool = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed") and c is not source_card]
        return [random.choice(pool)] if pool else []

    if tt == "enemy_project_mc_lt":
        try:
            threshold = float(effect.get("condition_value", 20))
        except Exception:
            threshold = 20.0
        eligible = [
            c for c in opponent_field
            if c.get("card_type") == "Project" and not c.get("destroyed") and c.get("current_mc", 0) < threshold
        ]
        if "random" in (effect.get("target_type") or "") or (effect.get("action_type") == "destroy" and str(effect.get("action_value")) == "1"):
            return [random.choice(eligible)] if eligible else []
        return eligible

    if tt == "random_2_enemy":
        pool = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]
        return random.sample(pool, min(2, len(pool))) if pool else []

    # =========================================================================
    # Doelsoorten die eerder ontbraken.
    #
    # Een onbekend target_type kwam hier terecht en gaf een lege lijst, waarna
    # de engine "skipped — no valid targets" logde en de kaart niets deed. Een
    # audit vond 41 van zulke waarden, samen goed voor 42 kaarten.
    # =========================================================================

    def _levend(cs):
        return [c for c in cs if isinstance(c, dict) and not c.get("destroyed")]

    def _proj(cs):
        return [c for c in _levend(cs) if c.get("card_type") == "Project"]

    def _kapot(cs):
        return [c for c in cs if isinstance(c, dict) and c.get("destroyed")]

    def _met_tag(cs, *namen):
        """Tags heten in de data anders dan in de kaartteksten: 'Ape' is DAK,
        'Monster' is Crazzzy Monsters. Daarom op deel-overeenkomst matchen."""
        uit = []
        for c in cs:
            tags = " ".join(str(t) for t in (c.get("tags") or [])).lower()
            naam = str(c.get("card_id", "")).lower()
            if any(n.lower() in tags or n.lower() in naam for n in namen):
                uit.append(c)
        return uit

    def _hoogste(cs):
        p = _proj(cs)
        return [max(p, key=lambda c: c.get("current_mc", 0))] if p else []

    def _laagste(cs):
        p = _proj(cs)
        return [min(p, key=lambda c: c.get("current_mc", 0))] if p else []

    def _willekeurig(cs, n=1):
        p = _proj(cs)
        return random.sample(p, min(n, len(p))) if p else []

    eigen_proj = _proj(field)
    vijand_proj = _proj(opponent_field)

    # --- alles van jezelf ---------------------------------------------------
    if tt in ("all_own", "own_projects", "surviving", "all_survivors",
              "all_surviving_friendly_projects", "all_remaining"):
        return eigen_proj

    if tt == "others":
        return [c for c in eigen_proj if c is not source_card]

    if tt == "all_friendly_projects_below_mc":
        try:
            grens = float(effect.get("condition_value") or 10)
        except Exception:
            grens = 10.0
        return [c for c in eigen_proj if c.get("current_mc", 0) <= grens]

    if tt in ("highest", "highest_own"):
        return _hoogste(field)

    if tt in ("random_surviving_project", "random_survivor"):
        return _willekeurig(field, 1)

    if tt in ("random_own_2", "random_two_own_projects", "random_2_survivors"):
        return _willekeurig(field, 2)

    if tt == "highest_lowest":
        hoog, laag = _hoogste(field), _laagste(field)
        if hoog and laag and hoog[0] is not laag[0]:
            return [hoog[0], laag[0]]
        return []

    if tt == "random_destroyed":
        kapot = _kapot(field)
        return [random.choice(kapot)] if kapot else []

    # --- op tag of rarity ---------------------------------------------------
    if tt == "remaining_machine":
        return _met_tag(eigen_proj, "machine")

    if tt == "all_machine_except_self":
        return [c for c in _met_tag(_proj(field) + _proj(opponent_field), "machine") if c is not source_card]

    if tt == "remaining_nova":
        return _met_tag(eigen_proj, "nova")

    if tt == "all_monster_tagged":
        return _met_tag(eigen_proj, "monster", "crazzzy")

    if tt == "meme_tagged":
        return _met_tag(_levend(field), "meme")

    if tt == "all_legendary_projects":
        return [c for c in eigen_proj if str(c.get("rarity", "")).lower() == "legendary"]

    if tt == "lowest_friendly_ape":
        apen = _met_tag(eigen_proj, "ape", "dak")
        return [min(apen, key=lambda c: c.get("current_mc", 0))] if apen else []

    if tt == "double_effect":
        nova = _met_tag(eigen_proj, "nova")
        return [random.choice(nova)] if nova else []

    # --- de tegenstander ----------------------------------------------------
    if tt in ("all_enemy", "each_opponent_project"):
        return vijand_proj

    if tt == "enemy_lowest":
        return _laagste(opponent_field)

    if tt == "enemy_highest_mc":
        return _hoogste(opponent_field)

    if tt == "enemy_founder":
        founders = [c for c in _levend(opponent_field) if c.get("card_type") == "Founder"]
        return founders[:1]

    if tt == "random_common_enemy":
        pool = [c for c in vijand_proj if str(c.get("rarity", "")).lower() == "common"]
        return [random.choice(pool)] if pool else []

    if tt == "random_enemy_survivor":
        return _willekeurig(opponent_field, 1)

    if tt == "random_project":
        beide = eigen_proj + vijand_proj
        return [random.choice(beide)] if beide else []

    # --- beide kanten / samengesteld ---------------------------------------
    if tt == "target":
        beide = eigen_proj + vijand_proj
        return [max(beide, key=lambda c: c.get("current_mc", 0))] if beide else []

    if tt == "enemy_highest_vs_own_lowest":
        hoog, laag = _hoogste(opponent_field), _laagste(field)
        return (hoog + laag) if (hoog and laag) else []

    if tt == "random_enemy + lowest_own":
        return _willekeurig(opponent_field, 1) + _laagste(field)

    if tt == "random_2_enemy + self":
        return _willekeurig(opponent_field, 2) + ([source_card] if source_card else [])

    # --- de kaart die de eerste debuff veroorzaakte -------------------------
    if tt in ("attacker", "original_debuff_source"):
        data = getattr(player, "first_debuff_data", None) or {}
        bron = data.get("source_card") if isinstance(data, dict) else None
        if isinstance(bron, dict):
            return [bron]
        return vijand_proj[:1]

    if tt == "one_project":
        # "de eerste debuff die een van je Projects raakt": bij voorkeur de kaart
        # die geraakt werd, anders gewoon een eigen Project.
        data = getattr(player, "first_debuff_data", None) or {}
        doel = data.get("target") if isinstance(data, dict) else None
        if isinstance(doel, dict):
            return [doel]
        return eigen_proj[:1]

    if tt == "none":
        # Geen los doel: de actie werkt op de bronkaart zelf.
        return [source_card] if source_card else []

    # ✅ Safety: always return a list
    return [t for t in targets if t is not None]
