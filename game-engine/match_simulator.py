import os
import random
import json
import copy
from targeting import get_targets
from condition import check_condition, get_highest_friendly_project_mc
from action import apply_action as _apply_action
from utils import log_event, pretty_log, CardLogGroup, track_first_debuff
from constants import RARITY_ICON
from types import SimpleNamespace
try:
    from constants import RARITY_ORDER  # used inside get_skip_reason
except Exception:
    RARITY_ORDER = {"Common":0,"Rare":1,"Epic":2,"Legendary":3,"Mythical":4}

# VOEG DIT TOE: zorgt dat de server het bestand vindt
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
json_path = os.path.join(BASE_DIR, "COC_Cards_parsed.json")

# Pas de open-regel aan:
with open(json_path, "r", encoding="utf-8") as f:
    ALL_CARDS = json.load(f)


# =========================
# Player model (MUST be defined before any function that references it)
# =========================

class DummyPlayer:
    def __init__(self, field, name="Dummy"):
        self.field = field
        self.deck = field
        self.name = name
        self.hand = []
        self.supports = []
        self.founders = []
        self.graveyard = []          # alias for destroyed if you prefer
        self.removed_cards = []
        self.destroyed_cards = []
        self.graveyard = self.destroyed_cards
        self.first_debuff_blocked = False
        self.first_debuff_data = None
        self.score_modifier = 0
        self.original_mc_snapshot = {}
        self.mc_loss_this_phase = 0
        self.mc_loss_total = 0
        self.was_any_project_debuffed = False
        self.first_friendly_destroyed = False

    def get_total_mc(self):
        return sum(
            c.get("current_mc", 0)
            for c in self.field
            if c.get("card_type") == "Project" and not c.get("destroyed")
        )

    def total_mc(self):
        return self.get_total_mc()


def _coerce_player_like(x, default_name):
    # Accept DummyPlayer, list-of-cards, or weird stuff; always return DummyPlayer
    if isinstance(x, DummyPlayer):
        return x
    if isinstance(x, list):
        for c in x:
            if isinstance(c, dict):
                c.setdefault("owner", default_name)
        return DummyPlayer(x, name=default_name)
    # last resort: try to treat it as a sequence of cards
    try:
        seq = list(x)  # may raise
    except Exception:
        seq = []
    for c in seq:
        if isinstance(c, dict):
            c.setdefault("owner", default_name)
    return DummyPlayer(seq, name=default_name)

def _ms_as_card_list(seq):
    out = []
    if not isinstance(seq, list):
        seq = [seq] if seq is not None else []
    for c in seq:
        if isinstance(c, dict):
            out.append(c)
        elif isinstance(c, list) and c and isinstance(c[0], dict):
            out.append(c[0])
    return out

def _ensure_player_shape(p, default_name="Player ?"):
    """Guarantee all attributes your sim expects exist on the player object."""
    if p is None:
        p = SimpleNamespace(name=default_name)

    # Core identity
    if not hasattr(p, "name"):
        p.name = default_name

    # Card containers (normalize to list[dict])
    for attr in ("field", "hand", "supports", "founders", "deck"):
        setattr(p, attr, _ms_as_card_list(getattr(p, attr, [])))

    # Destruction/zone tracking
    if not hasattr(p, "destroyed_cards"):
        p.destroyed_cards = []
    if not hasattr(p, "graveyard"):
        p.graveyard = p.destroyed_cards
    if not hasattr(p, "removed_cards"):
        p.removed_cards = []

    # Phase trackers
    if not hasattr(p, "mc_loss_this_phase"):
        p.mc_loss_this_phase = 0
    if not hasattr(p, "mc_gain_this_phase"):
        p.mc_gain_this_phase = {}
    if not hasattr(p, "phase_triggers"):
        p.phase_triggers = {}

    return p

def apply_action(card, action_type, action_value, player_name, log, context):
    """
    Safety shim around action.apply_action that guarantees context['player']
    and context['opponent'] are DummyPlayer objects (never raw lists).
    """
    ctx = dict(context or {})
    me = _coerce_player_like(ctx.get("player"), player_name or "Player 1")
    # pick a sensible opposite name
    them_name = "Player 2" if me.name == "Player 1" else "Player 1"
    them = _coerce_player_like(ctx.get("opponent"), them_name)
    ctx["player"] = me
    ctx["opponent"] = them

    # also ensure field/opponent_field live on those players
    if "field" not in ctx:
        ctx["field"] = me.field
    if "opponent_field" not in ctx:
        ctx["opponent_field"] = them.field

    return _apply_action(card, action_type, action_value, player_name, log, ctx)



# ALL_CARDS already loaded at top of file via json_path

# =========================
# Effect helpers (flatteners)
# =========================

def _flatten_effects(x):
    """Yield dict effects from arbitrarily nested lists/dicts."""
    if isinstance(x, dict):
        yield x
    elif isinstance(x, list):
        for y in x:
            yield from _flatten_effects(y)

def iter_effects(card):
    """
    Yield all effects (dicts) from parsed_power and copied_effects,
    preserving the original order: parsed first, then copied.
    """
    parsed = card.get("parsed_power", [])
    copied = card.get("copied_effects") or []

    if isinstance(parsed, dict):
        parsed = [parsed]
    if isinstance(copied, dict):
        copied = [copied]

    for eff in (_flatten_effects(parsed) or []):
        if isinstance(eff, dict):
            yield eff
    for eff in (_flatten_effects(copied) or []):
        if isinstance(eff, dict):
            yield eff

def _effects_for_phase(card, phase_name):
    """Yield only valid dict effects that match the current phase.

    Zes kaarten hebben `phase: "Any"`. Die werd hier letterlijk vergeleken met
    "start", "buff" enzovoort en matchte dus nooit — die kaarten deden hun hele
    bestaan niets. Het zijn passieve effecten ("kan niet meer dan 5 MC
    verliezen", "beschermt je laagste Project tegen vernietiging"), dus ze horen
    één keer aan het begin van de match gezet te worden: in de Start-fase.
    """
    p = phase_name.lower()
    for eff in iter_effects(card):
        # 🔒 hard guard so bad structures never crash
        if not isinstance(eff, dict):
            continue
        fase = str(eff.get("phase", "")).lower()
        if fase == p or (fase in ("any", "") and p == "start"):
            yield eff

# =========================
# ID normalization + lookup
# =========================

def _norm_id(cid: str) -> str:
    """
    Canonicalize a COC card_id by removing optional EVT/COM/INF after 'COC_'.
      'COC_EVT_Market_Correction' -> 'COC_Market_Correction'
      'COC_COM_Vinz_L1'           -> 'COC_Vinz_L1'
      'COC_INF_Francis_C1'        -> 'COC_Francis_C1'
    """
    if not cid:
        return cid
    s = str(cid).strip()
    if not s.startswith("COC_"):
        return s
    rest = s[4:]
    for pref in ("EVT_", "COM_", "INF_"):
        if rest.startswith(pref):
            rest = rest[len(pref):]
            break
    return "COC_" + rest

def _build_id_index(cards):
    """Build two indices: exact id → card, and normalized id → [cards]."""
    exact, by_norm = {}, {}
    for c in cards:
        cid = c.get("card_id")
        if not isinstance(cid, str):
            continue
        exact[cid] = c
        key = _norm_id(cid)
        by_norm.setdefault(key, []).append(c)
    return exact, by_norm

def _resolve_card_id(input_id: str, exact, by_norm):
    """
    Resolve input_id to a card using:
      1) exact match
      2) normalized match (EVT/COM/INF ignored). If many, prefer the one
         that contains the same segment as input (if present).
    """
    if input_id in exact:
        return exact[input_id]

    key = _norm_id(input_id)
    options = by_norm.get(key, [])
    if not options:
        return None

    seg = None
    rest = input_id[4:] if input_id.startswith("COC_") else input_id
    for p in ("EVT_", "COM_", "INF_"):
        if rest.startswith(p):
            seg = p[:-1]  # EVT / COM / INF
            break
    if seg:
        for c in options:
            if f"_{seg}_" in c.get("card_id", ""):
                return c
    return options[0]

def _ctype(card) -> str:
    """Normalize card_type: treat 'Event' as 'Support'."""
    t = str(card.get("card_type", "")).strip().lower()
    if t == "event":
        return "Support"
    if t == "support":
        return "Support"
    if t == "founder":
        return "Founder"
    return "Project" if t == "project" else str(card.get("card_type", ""))

def _validate_5_5_1(deck, side_label: str):
    counts = {"Project": 0, "Support": 0, "Founder": 0}
    for c in deck:
        k = _ctype(c)
        if k in counts:
            counts[k] += 1
    if counts["Project"] != 5 or counts["Support"] != 5 or counts["Founder"] != 1:
        raise ValueError(
            f"{side_label}: deck invalid — need 5 Projects, 5 Supports, 1 Founder. "
            f"Got Projects={counts['Project']} Supports={counts['Support']} Founder={counts['Founder']}"
        )

    # Alleen de types tellen liet vijf exemplaren van dezelfde topkaart door.
    seen, duplicates = set(), set()
    for c in deck:
        cid = c.get("card_id")
        if cid in seen:
            duplicates.add(cid)
        seen.add(cid)
    if duplicates:
        raise ValueError(
            f"{side_label}: deck invalid — duplicate card(s): {', '.join(sorted(duplicates))}"
        )

def load_deck_from_ids(card_ids, all_cards, owner_name, *, strict=True):
    """
    Strictly build a deck from IDs. Supports 'COC_EVT_*'/'COC_INF_*'/'COC_COM_*'
    even if the dataset omits or changes that segment.

    Raises ValueError listing any unknown IDs if strict=True.
    """
    exact, by_norm = _build_id_index(all_cards)
    deck, missing = [], []
    for raw in card_ids or []:
        card = _resolve_card_id(raw, exact, by_norm)
        if card is None:
            missing.append(raw)
            continue
        cpy = copy.deepcopy(card)
        cpy["owner"] = owner_name
        deck.append(cpy)

    if strict and missing:
        raise ValueError(f"{owner_name}: unknown card_id(s): {', '.join(missing)}")

    return deck

# =========================
# UI/log helpers
# =========================

def phase_banner(phase_name):
    return f"\n━━━━━━━━━━━━━━━━━━━━\n🔄 **{phase_name} Phase Begins!**\n━━━━━━━━━━━━━━━━━━━━"

def mc_change(old, new):
    if new > old:
        return f"➕ +{new - old:.1f} → {old:.1f} → **{new:.1f}**"
    elif new < old:
        return f"➖ -{old - new:.1f} → {old:.1f} → **{new:.1f}**"
    else:
        return f"⚖️ No change → {old:.1f}"

def phase_summary(phase, player1, player2, old_p1_mc, old_p2_mc):
    new_p1_mc = player1.total_mc()
    new_p2_mc = player2.total_mc()
    delta1 = new_p1_mc - old_p1_mc
    delta2 = new_p2_mc - old_p2_mc
    return (
        f"📊 **{phase} Recap:**\n"
        f"🔷 Player 1: {new_p1_mc:.1f} MC ({'+' if delta1 >= 0 else ''}{delta1:.1f})\n"
        f"🔶 Player 2: {new_p2_mc:.1f} MC ({'+' if delta2 >= 0 else ''}{delta2:.1f})"
    )

def victory_screen(p1_mc, p2_mc):
    winner = "Player 1" if p1_mc > p2_mc else "Player 2" if p2_mc > p1_mc else "Draw"
    crown = "👑" if winner != "Draw" else "🤝"
    return (
        f"\n━━━━━━━━━━━━━━━━━━━━\n"
        f"{crown} **Final Results** {crown}\n"
        f"🔷 Player 1: **{p1_mc:.1f} MC**\n"
        f"🔶 Player 2: **{p2_mc:.1f} MC**\n"
        f"{'🏆 Winner: ' + winner if winner != 'Draw' else '🤝 The match ends in a Draw!'}"
    )

def card_status(card):
    return f"{'❌' if card.get('destroyed') else '✅'} {card['card_id']} — {'Destroyed' if card.get('destroyed') else 'Alive'}"

# =========================
# Conditions (unchanged logic)
# =========================

SENTINEL_CONDITIONS = {
    "first_enemy_debuff",
    "first_debuff",
    "first_debuff_targeting_project",
}

def get_skip_reason(card, effect, player, opponent):
    # 🔒 Hard guard: if some caller passed a raw deck (list) instead of DummyPlayer,
    # wrap it so code below can safely use .name and .field.
    try:
        player = _as_player(player, "Player 1")
    except Exception:
        player = DummyPlayer(player if isinstance(player, list) else [], "Player 1")
    try:
        opponent = _as_player(opponent, "Player 2")
    except Exception:
        opponent = DummyPlayer(opponent if isinstance(opponent, list) else [], "Player 2")

    condition_type = effect.get("condition_type")
    condition_value = effect.get("condition_value", "")

    if condition_type in SENTINEL_CONDITIONS:
        if getattr(player, "first_debuff_blocked", False):
            return "🛡️ Shield already spent"
        if getattr(player, "first_debuff_data", None):
            return "🛡️ First debuff detected and queued for reflection"
        return "🛡️ Armed — waiting for the first debuff"

    if condition_type in [None, "", "none", "always"]:
        return "✅ Automatic effect (no condition)"

    if condition_type == "mc_less_than":
        return f"🧮 {card['card_id']} MC is not below {condition_value}"

    elif condition_type == "mc_less_than_equal":
        current_mc = card.get("current_mc", card.get("base_mc", 0))
        msg = f"🧮 {card['card_id']} MC {current_mc:.1f} is not ≤ {condition_value}"
        print(f"[TRACE] SkipReason(mc_less_than_equal): {msg}")
        return msg

    # ... ⬇️ Everything below is your original get_skip_reason content.
    #     Kept verbatim to avoid changing game logic.
    # -----------------------------------------------------------------
    elif condition_type == "mc_greater_than":
        return f"📈 No Projects with MC > {condition_value} found"
    elif condition_type == "friendly_rarity_count_gte":
        try:
            rarity, threshold = [x.strip() for x in condition_value.split(",")]
            threshold = int(threshold)
            count = sum(
                1 for c in player.field
                if c.get("card_type") == "Project"
                and RARITY_ORDER.get(c.get("rarity")) is not None
                and RARITY_ORDER[c["rarity"]] <= RARITY_ORDER[rarity]
                and not c.get("destroyed")
            )
            return f"🃏 Not enough Projects of rarity {rarity} or lower ({count}/{threshold})"
        except:
            return f"🃏 Invalid condition format {condition_value}"
    elif condition_type == "enemy_destroyed_count":
        return f"💥 Fewer than {condition_value} enemy Projects destroyed"
    elif condition_type == "destroyed_count":
        return f"💥 Fewer than {condition_value} cards destroyed"
    elif condition_type == "count_tag":
        return f"🏷️ No Projects with tag '{condition_value}' found"
    elif condition_type == "not_has_tags":
        return f"🚫 Tag '{condition_value}' found, should not be present"
    elif condition_type == "has_tag_not" or condition_type == "has_no_tag":
        return f"🚫 Card must not have tag '{condition_value}'"
    elif condition_type == "deck_tag":
        return f"🏷️ No card with tag '{condition_value}' found in deck"
    elif condition_type == "self_destruct":
        return f"💀 {card['card_id']} does not meet self-destruct condition"
    elif condition_type == "has_tag":
        return f"🏷️ {card['card_id']} lacks tag '{condition_value}'"
    elif condition_type == "tag_on_field":
        return f"🏷️ No tag '{condition_value}' found on field"
    elif condition_type == "enemy_project_mc_lt":
        return f"⚔️ No enemy Project MC below {condition_value}"
    elif condition_type == "enemy_has_projects":
        return f"❌ Opponent has no active Projects"
    elif condition_type == "enemy_has_rarity":
        return f"❌ Opponent has no Projects with rarity '{condition_value}'"
    elif condition_type == "survived":
        return f"💀 {card['card_id']} did not survive the battlefield"
    elif condition_type == "exact_rarity_mix":
        return f"🎭 {player.name} does not have exact rarity mix: {condition_value}"
    elif condition_type == "random_chance":
        try:
            chance = float(condition_value)
            return f"🎲 RNG failed — needed {int(chance * 100)}%"
        except:
            return f"🎲 RNG chance failed"
    elif condition_type == "control_card_count":
        txt = (condition_value or "").strip()
        if "," in txt:
            try:
                req_count_s, req_type = [x.strip() for x in txt.split(",", 1)]
                req_count = int(req_count_s)
                count = sum(
                    1 for c in player.field
                    if c.get("card_type", "").lower() == req_type.lower() and not c.get("destroyed")
                )
                return f"🃏 Not enough {req_type}, {count}/{req_count} on {player.name}'s field"
            except Exception:
                return f"🃏 Condition not met ({condition_value})"
        import re as _re
        m = _re.match(r"(?i)\s*(\w+)\s*(>=|<=|=|>|<)\s*(\d+)\s*", txt)
        if m:
            rarity, op, n = m.group(1).lower(), m.group(2), int(m.group(3))
            count = sum(
                1 for c in player.field
                if c.get("card_type") == "Project"
                and not c.get("destroyed")
                and str(c.get("rarity", "")).lower() == rarity
            )
            comp = {">=": count >= n, ">": count > n, "=": count == n, "<=": count <= n, "<": count < n}[op]
            if comp:
                return "✅ Condition met"
            return f"🃏 Need {rarity} {op} {n} on field; have {count}"
        return f"🃏 Condition not met ({condition_value})"
    elif condition_type == "own_card_debuffed":
        return f"💥 No own Project lost MC this phase"
    elif condition_type == "project_targeted_by_debuff":
        return f"❌ {card.get('card_id')} skipped: No friendly Project was targeted by a debuff"
    elif condition_type == "control_all_rarities":
        rarities_needed = {"Common", "Rare", "Epic", "Legendary", "Mythical"}
        own_rarities = {
            card.get("rarity") for card in player.field
            if card.get("card_type") == "Project" and not card.get("destroyed")
        }
        missing = rarities_needed - own_rarities
        if missing:
            return f"❌ Condition not met: control_all_rarities (missing: {', '.join(sorted(missing))})"
        return f"✅ All rarities present"
    elif condition_type == "is_lowest":
        return f"⬇️ Not your lowest MC Project"
    elif condition_type == "lowest_highest=Lunar":
        return f"🧩 Lowest & Highest Projects do not both share the Lunar tag"
    elif condition_type == "total_mc < opponent":
        return f"⚖️ {player.name} MC is not lower than opponent"
    elif condition_type == "opponent_total_mc_greater":
        return f"⚖️ Opponent total MC is not higher"
    elif condition_type == "is_lowest_mc_card":
        return f"🔻 {card['card_id']} is not the lowest MC Project"
    elif condition_type == "is_only_rarity":
        return f"🎭 {player.name} does not have only '{condition_value}' rarity"
    elif condition_type == "has_card_on_field":
        return f"🔍 '{condition_value}' not found on field"
    elif condition_type == "enemy_highest_mc_gte":
        return f"⚔️ Enemy’s highest Project MC not ≥ {condition_value}"
    elif condition_type == "cards_destroyed >= 3":
        return f"💣 Fewer than 3 cards destroyed"
    elif condition_type in ("enemy_project_destroyed", "project_destroyed"):
        return f"💥 No enemy Projects destroyed"
    elif condition_type == "enemy_project_destroyed_once":
        return f"💥 No enemy Project has been destroyed yet"
    elif condition_type == "has_all_rarities":
        return f"🌈 Not all rarities present"
    elif condition_type == "has_exact_rarities":
        return f"🎭 Exact rarities {condition_value} not matched"
    elif condition_type == "highest_own_buff":
        return f"🔝 Not the highest own buff target"
    elif condition_type == "random_project":
        return f"🎲 RNG did not select this Project"
    elif condition_type == "has_tag_count":
        return f"🏷️ Fewer than {condition_value} Projects with tag"
    elif condition_type == "tags_match":
        return f"🧩 Lowest & Highest Projects do not both share the Lunar tag"
    elif condition_type == "mc_equals":
        return f"🧮 {card['card_id']} MC is not exactly {condition_value}"
    elif condition_type == "lowest_mc_project":
        return f"🔻 {card['card_id']} is not the lowest MC Project"
    elif condition_type == "mc_gte":
        return f"🧮 No Projects with MC ≥ {condition_value} found"
    elif condition_type == "rarity_count":
        return f"🎭 Less than {condition_value} unique Project rarities on your field"
    elif condition_type == "count_card_rarity":
        return f"🧩 Not enough Common Nova cards in deck (need {condition_value.split('>=')[-1]})"
    elif condition_type == "has_card_type":
        return f"🔍 No card of type '{condition_value}' found"
    elif condition_type == "phase_equals":
        return f"🔄 Phase does not match '{condition_value}'"
    elif condition_type == "projects_with_7_mc":
        return f"🧮 Fewer than {condition_value} Projects with MC ending in 7"
    elif condition_type == "own_debuffed_count":
        return f"🧮 Fewer than {condition_value} own Projects were debuffed"
    elif condition_type == "own_project_destroyed":
        return f"💥 No own Projects were destroyed"
    elif condition_type == "nova_destroyed":
        return f"💥 No Nova Projects were destroyed"
    elif condition_type == "own_mc_loss_count":
        return f"🧮 Fewer than {condition_value} own Projects lost MC"
    elif condition_type == "control_project_cards":
        return "❌ No Project cards controlled"
    elif condition_type == "tag":
        return f"❌ No Project has tag '{condition_value}'"
    elif condition_type == "lowest_own_exists":
        return "❌ No valid lowest own Project found"
    elif condition_type == "enemy_highest_mc":
        return "❌ Opponent has no highest MC Project"
    elif condition_type == "is_lowest_mc_in_deck":
        return f"🔻 {card['card_id']} is not the lowest MC Project in deck"
    elif condition_type == "count_tag_exact":
        tag, count = condition_value.split("=")
        return f"🏷️ Not exactly {count.strip()} Projects with tag '{tag.strip()}'"
    elif condition_type == "first_debuff_hit":
        return f"🛡️ {card['card_id']} cannot block — no valid first debuff found"
    elif condition_type == "self_mc_eq":
        return f"🧮 {card['card_id']} MC is not exactly {condition_value}"
    elif condition_type == "mc_extremes":
        return f"🧮 No Project has MC >40 or <10"
    elif condition_type == "mc_lt_opponent":
        return f"⚖️ {player.name} MC is not lower than opponent"
    elif condition_type == "own_project_loses_mc":
        return f"❌ No own Project lost MC this phase"
    elif condition_type == "project_debuffed":
        return f"❌ {card['card_id']} skipped: No friendly Projects were debuffed this phase"
    elif condition_type == "survived":
        return f"💀 {card['card_id']} did not survive the battlefield"
    elif condition_type == "highest_mc_project":
        return "No valid highest MC Project found"
    elif condition_type == "first_debuff":
        if player and player.first_debuff_blocked:
            return "❌ First debuff already blocked"
        else:
            return "❌ First debuff not detected this phase"
    elif condition_type == "project_mc_lt":
        return f"❌ No Project with MC < {condition_value}"
    elif condition_type == "first_debuff_targeting_project":
        if player.first_debuff_blocked:
            return "🛡️ Already blocked first debuff this match"
        if not player.first_debuff_data:
            return "❌ No debuff effect targeting your Projects to reflect"
        return "✅ First debuff detected"
    elif condition_type == "own_rarity":
        rarity_check = condition_value.strip().lower()
        own_projects = [
            c for c in player.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("rarity", "").lower() == rarity_check
        ]
        if not own_projects:
            return f"❌ No Projects of rarity '{rarity_check}' found on your field"
        return f"✅ {len(own_projects)} Project(s) of rarity '{rarity_check}' found"
    elif condition_type == "card_type":
        card_type_check = condition_value.strip().lower()
        own_cards = [
            c for c in player.field
            if c.get("card_type", "").lower() == card_type_check
            and not c.get("destroyed", False)
        ]
        if not own_cards:
            return f"❌ No '{card_type_check}' type cards found on your field"
        return f"✅ {len(own_cards)} '{card_type_check}' card(s) found"
    elif condition_type == "each_enemy_project":
        enemy_projects = [
            c for c in opponent.field
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        if not enemy_projects:
            return "❌ No enemy Projects alive"
        return f"✅ {len(enemy_projects)} enemy Project(s) found"
    elif condition_type == "all_projects":
        valid_projects = [
            c for c in player.field
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        if not valid_projects:
            return "❌ No valid Projects alive on your side"
        return f"✅ {len(valid_projects)} own Project(s) found"
    elif condition_type == "on_destroyed":
        if not card.get("destroyed", False):
            return f"💀 {card['card_id']} was not destroyed — effect requires destruction"
        return f"✅ {card['card_id']} was destroyed"
    elif condition_type == "lost_mc_due_to_effect":
        return f"📉 MC loss condition not met ({condition_value} required)"
    elif condition_type in ("own_projects_under_mc_gte", "project_mc_lt_count"):
        th = str(condition_value).split(",")[0].strip() if condition_value else "20"
        return f"❌ Need at least 3 Projects under {th} MC"
    elif condition_type in ("own_project_lost_mc", "own_project_loses_mc"):
        lost_any = any(
            c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and (c.get("_lost_mc_due_to_effect", 0) or c.get("lost_mc_due_to_effect", 0))
            for c in getattr(player, "field", [])
        )
        if not lost_any:
            return "❌ No own Project has lost MC due to a card effect yet"
        ttype = effect.get("target_type", "")
        if ttype in ("random_common", "random_common_own"):
            has_common_alive = any(
                c.get("card_type") == "Project"
                and not c.get("destroyed", False)
                and c.get("rarity", "").lower() == "common"
                for c in getattr(player, "field", [])
            )
            if not has_common_alive:
                return "❌ No own Common Projects alive"
        return "✅ Condition met"
    elif condition_type == "total_mc_ends_in":
        total_mc = player.total_mc()
        return f"🧮 Total MC ends on {str(int(total_mc))[-1]}, needed {condition_value}"
    elif condition_type == "any_mc_ends_in":
        return f"❌ No Project on field ends with MC {condition_value}"
    elif condition_type == "deck_tag_count":
        try:
            tag, operator, threshold = condition_value.split()
            threshold = int(threshold)
            count = sum(1 for c in player.deck if tag in c.get("tags", []))
            return f"🏷️ Not enough '{tag}' cards in deck ({count}{operator}{threshold} failed)"
        except:
            return f"🏷️ Invalid deck_tag_count condition"
    elif condition_type == "event_card_count":
        return f"🎟️ {player.name} does not have exactly {condition_value} Event cards"
    elif condition_type == "first_debuff_targeting_side":
        return f"🛡️ First debuff target does not end with {condition_value}"
    elif condition_type == "control_tag":
        return f"🏷️ No own Project has tag '{condition_value}'"
    elif condition_type == "rarity":
        return f"🎭 No Project with rarity '{condition_value}' on your field"
    elif condition_type == "targeted_by_debuff":
        return f"❌ {card.get('card_id')} skipped (Not targeted by debuff)"
    elif condition_type == "projects_destroyed_count":
        return f"❌ Less than required Projects destroyed ({condition_value})"
    elif condition_type == "any_card_mc_lt":
        return f"❌ No friendly card has MC below {condition_value}"
    elif condition_type == "final_calc":
        return f"❌ Final condition not met: {condition_value}"
    elif condition_type == "survived_destruction_count":
        return f"❌ Less than required Projects survived destruction ({condition_value})"
    elif condition_type == "project_count":
        return f"❌ Does not have exactly {condition_value} Projects after Counter Phase"
    elif condition_type == "more_projects_than_opponent":
        return f"❌ {card.get('card_id')} skipped (Not more Projects than opponent)"
    elif condition_type == "unique_rarity_count_gte":
        return f"❌ Not enough unique rarities (needs {condition_value})"
    elif condition_type == "random_common_own_exists":
        return f"❌ No own Common Projects to destroy"
    elif condition_type == "random_common_own_destroyed":
        if getattr(player, "own_common_destroyed", False) or card.get("_destroyed_common_this_phase", False):
            return "✅ Destroyed a Common Project this phase"
        return "❌ Did not destroy a Common Project"
    elif condition_type == "own_projects_lost_mc":
        req = str(condition_value).strip() or ">=2"
        return f"❌ Not enough of your Projects lost MC due to effects ({req} required)"
    elif condition_type == "on_self_buff":
        return f"❌ {card['card_id']} skipped: Card was not buffed this match"
    elif condition_type == "destroyed_self":
        if not card.get("destroyed", False):
            return f"❌ {card['card_id']} skipped — not destroyed"
        return f"✅ {card['card_id']} is destroyed"
    elif condition_type == "on_project_destroyed":
        if not player.destroyed_cards:
            return "❌ No Project destroyed on your side"
        return f"✅ {len(player.destroyed_cards)} Project(s) destroyed"
    elif condition_type == "total_team_mc_lt_opponent":
        return "⚖️ Your total MC is not lower than opponent"
    elif condition_type == "first_friendly_destroyed":
        if not player.first_friendly_destroyed:
            return "❌ No friendly Project was the first to be destroyed"
        return "✅ First friendly Project was destroyed"
    elif condition_type == "projects_destroyed_count":
        total_destroyed = len(player.destroyed_cards) + len(opponent.destroyed_cards)
        if total_destroyed < int(effect.get("condition_value", "3").replace(">=", "")):
            return "❌ Less than required Projects destroyed (>=3)"
    elif condition_type == "mc_lower_than_self":
        return f"🛡️ {card['card_id']} held back — Opponent’s MC was not lower"
    elif condition_type == "mc_multiple":
        total_mc = player.total_mc()
        return f"🧮 Total MC = {total_mc}, not divisible by {condition_value}"
    elif condition_type == "own_project_destroyed":
        destroyed = [
            c for c in player.field
            if c.get("card_type") == "Project" and c.get("destroyed")
        ]
        survivors = [
            c for c in (player.field + opponent.field)
            if c.get("card_type") == "Project"
            and "DAK" in c.get("tags", [])
            and not c.get("destroyed")
            and c.get("card_id") != card.get("card_id")
        ]
        if not destroyed:
            return "💥 No own Projects were destroyed this match"
        if not survivors:
            return f"🚫 No surviving DAK Projects available for {card['card_id']} to buff"
        return f"✅ {len(destroyed)} destroyed; {len(survivors)} DAK survivors available"
    elif condition_type == "turn_count":
        return f"⏳ Turn count condition not met: {condition_value}"

    # Final fallback — don't re-enter check_condition here (avoid type mix-ups)
    return f"❌ Condition not met: {condition_type} ({condition_value})"


# =========================
# Misc helpers
# =========================

def is_all_time_high_second_effect(card, effect, player, opponent):
    if card.get("card_id") != "COC_All_Time_High":
        return False
    if effect.get("target_type") != "second_highest_friendly_project":
        return False
    valid_projects = [
        c for c in player.field
        if c.get("card_type") == "Project" and not c.get("destroyed")
    ]
    if len(valid_projects) < 2:
        return False
    highest_card = max(valid_projects, key=lambda c: c.get("current_mc", 0))
    simulated_total = player.total_mc() + highest_card.get("current_mc", 0)
    return simulated_total < opponent.total_mc()

def separate_cards():
    projects = [c for c in ALL_CARDS if c["card_type"] == "Project"]
    supports = [c for c in ALL_CARDS if c["card_type"] == "Support"]
    founders = [c for c in ALL_CARDS if c["card_type"] == "Founder"]
    return projects, supports, founders

def generate_deck():
    projects = [c for c in ALL_CARDS if c["card_type"] == "Project"]
    founders = [c for c in ALL_CARDS if c["card_type"] == "Founder"]
    supports = [
        c for c in ALL_CARDS
        if c["card_type"] != "Founder"
        and any(tag in c.get("tags", []) for tag in ["Community", "Event", "Influencer"])
    ]
    deck = random.sample(projects, 5) + random.sample(supports, 5) + random.sample(founders, 1)
    for card in deck:
        card["current_mc"] = 0
    return deck

def calculate_total_mc(deck):
    return sum(
        c.get("current_mc", 0)
        for c in deck
        if _ctype(c) == "Project" and not c.get("destroyed", False)
    )

def _as_player(maybe_player, fallback_name):
    """
    Ensure we have a DummyPlayer. If a list is accidentally passed where a player
    should be (common mis-wire in outer callers), wrap it.
    """
    if isinstance(maybe_player, DummyPlayer):
        return maybe_player

    if isinstance(maybe_player, list):
        # Treat as a deck and wrap it
        deck = maybe_player
        for c in deck:
            c.setdefault("owner", fallback_name)
        return DummyPlayer(deck, name=fallback_name)

    # If something else slipped in, fail loudly & clearly
    raise TypeError(f"Expected DummyPlayer or list for player '{fallback_name}', got {type(maybe_player).__name__}")


# =========================
# Core simulation
# =========================

def apply_phase(deck, opponent_deck, log, player_name, phase_name, player, opponent, p2_eerst=False):
    # --- Input shape guardrails (DON'T change game logic, just coerce/warn) ---
    # If someone upstream passed DummyPlayer where a deck should be, accept their .field
    if isinstance(deck, DummyPlayer):
        deck = deck.field
    if isinstance(opponent_deck, DummyPlayer):
        opponent_deck = opponent_deck.field

    # Coerce player/opponent to DummyPlayer if a list was passed
    player = _as_player(player, player_name or "Player 1")
    other_default = "Player 2" if (player_name or "").strip() == "Player 1" else "Player 1"
    opponent = _as_player(opponent, other_default)

    # Make sure owners exist on cards (helps some targeters/skip-reasons)
    for c in deck:
        c.setdefault("owner", player.name)
    for c in opponent_deck:
        c.setdefault("owner", opponent.name)

    # -------------------------------------------------------------------------
    player.mc_loss_this_phase = 0
    opponent.mc_loss_this_phase = 0
    triggered_cards = set()
    context = {"current_phase": phase_name}

    if phase_name == "Final":
        pool = [c for c in (player.field + opponent.field)
                if c.get("card_type") == "Project" and not c.get("destroyed", False)]
        print("[DEBUG] Final MC last digits:",
              [(c["card_id"], int(float(c.get("current_mc", 0))) % 10, c.get("current_mc")) for c in pool])

    cr00ts_reactions = []

    # Step 1: Pre-detect Cr00ts in Debuff
    # Beide decks scannen. Voorheen werd alleen `deck` bekeken en kreeg alleen
    # `player` een snapshot, waardoor Player 2's exemplaar van dezelfde kaart
    # zich anders gedroeg dan dat van Player 1.
    if phase_name == "Debuff":
        for owner_deck, owner_player, foe_player in (
            (deck, player, opponent),
            (opponent_deck, opponent, player),
        ):
            owner_player.original_mc_snapshot = {
                c["card_id"]: c.get("current_mc", 0) for c in owner_player.field
            }
            for card in owner_deck:
                if card.get("destroyed"):
                    continue
                for effect in _effects_for_phase(card, "Debuff"):
                    if effect.get("condition_type") == "first_debuff_targeting_project":
                        log.append(pretty_log("immune", "Cr00ts detected — waiting for first debuff", card))
                        cr00ts_reactions.append((card, effect, {
                            "source_card": card,
                            "field": owner_player.field,
                            "opponent_field": foe_player.field,
                            "player": owner_player,
                            "opponent": foe_player,
                            "effect": effect,
                        }, owner_player))

    # Step 2: Process BOTH players’ cards for this phase
    #
    # De volgorde is niet neutraal: wie als tweede handelt rekent op een bord
    # dat de tegenstander al heeft aangepast, en dat is een voordeel. Toen deck 1
    # hier altijd eerst aan de beurt was, won speler 2 in spiegelmatches
    # structureel vaker — gemeten +1,45 MC gemiddeld over 1500 deckparen.
    # Daarom wisselt de beurtvolgorde nu per fase; zie simulate_match_with_decks.
    volgorde = [
        (deck, player, opponent),
        (opponent_deck, opponent, player),
    ]
    if p2_eerst:
        volgorde.reverse()

    for current_deck, current_player, other_player in volgorde:
        for card in current_deck:
            if card.get("destroyed") or card.get("cr00ts_done"):
                continue
            print(f"[DEBUG] {card['card_id']} owned by {card.get('owner')} — current loop player = {current_player.name}")

            if card.get("owner") != current_player.name:
                continue
            if card.get("disabled", False):
                log.append(pretty_log("skip", "is disabled and cannot trigger this phase", card))
                continue
            if card.get("_phase_triggered", False):
                continue

            # Optional debug
            if card["card_id"] == "COC_FFS_M1":
                import json as _json
                print(f"\n[DEBUG] Processing FFS_M1 in {phase_name} phase")
                print("FFS_M1 parsed_power:", _json.dumps(card.get("parsed_power", []), indent=2))

            for effect in _effects_for_phase(card, phase_name):
                if not isinstance(effect, dict):
                    log.append(pretty_log("skip", "invalid effect structure", card))
                    continue

                if card.get("_phase_triggered", False):
                    break

                # Deathrattles resolved elsewhere
                if effect.get("trigger_type") == "reaction" and effect.get("condition_type") in ("self_destroyed", "on_destroyed"):
                    continue

                # ---- Special-case handlers (unchanged logic) ----
                if card["card_id"] == "COC_CM_R1" and not card.get("_already_handled", False):
                    group = CardLogGroup(card, phase_name)
                    valid_targets = [
                        c for c in (current_player.field + other_player.field)
                        if c.get("card_type") == "Project" and not c.get("destroyed", False)
                    ]
                    if valid_targets:
                        chosen = random.sample(valid_targets, min(2, len(valid_targets)))
                        group.add("rng", f"deals 4 damage to {len(chosen)} random Projects (either side)")
                        for t in chosen:
                            old_mc = t.get("current_mc", 0)
                            t["current_mc"] = max(0, old_mc - 4)
                            t["targeted_by_debuff"] = True
                            victim_player = current_player if t.get("owner") == current_player.name else other_player
                            track_first_debuff(target=t, source_card=card, effect=effect, player=victim_player, log=log)
                            if t.get("owner") == current_player.name:
                                current_player.was_any_project_debuffed = True
                            else:
                                other_player.was_any_project_debuffed = True
                            group.add("debuff", f"reduces {t.get('owner','?')}’s {t['card_id']} by -4.0 MC → {old_mc:.1f} → {t['current_mc']:.1f}")
                            group.add("debuff", f"{t['card_id']} flagged as debuffed")
                    else:
                        group.add("skip", "found no valid targets!")
                    log.append(group.finalize())
                    card["_already_handled"] = True
                    card["_phase_triggered"] = True
                    triggered_cards.add(card["card_id"])
                    break

                elif card["card_id"] == "COC_CM_L1" and not card.get("_already_handled", False):
                    group = CardLogGroup(card, phase_name)
                    own_commons = [
                        c for c in current_player.field
                        if c.get("card_type") == "Project"
                        and c.get("rarity", "").lower() == "common"
                        and not c.get("destroyed")
                        and c["card_id"] != card["card_id"]
                    ]
                    if own_commons:
                        target = random.choice(own_commons)
                        target["destroyed"] = True
                        current_player.destroyed_cards.append(target)
                        group.add("destroy", f"destroyed {current_player.name}’s {target['card_id']}")
                        old_mc = card.get("current_mc", 0)
                        card["current_mc"] = old_mc + 15
                        group.add("buff", mc_change(old_mc, card["current_mc"]))
                    else:
                        group.add("skip", "found no Common to destroy!")
                    log.append(group.finalize())
                    card["_already_handled"] = True
                    card["_phase_triggered"] = True
                    triggered_cards.add(card["card_id"])
                    continue

                elif card["card_id"] == "COC_CM_M1" and not card.get("_already_handled", False):
                    total_destroyed = len(player.destroyed_cards) + len(opponent.destroyed_cards)
                    if total_destroyed >= 3:
                        group = CardLogGroup(card, phase_name)
                        for c in player.field + opponent.field:
                            if c.get("card_type") == "Project" and not c.get("destroyed") and c["card_id"] != card["card_id"]:
                                old_mc = c.get("current_mc", 0)
                                c["current_mc"] = max(0, old_mc - 6)
                                c["targeted_by_debuff"] = True
                                group.add("debuff", f"reduces {c['card_id']} by -6.0 MC → {old_mc:.1f} → {c['current_mc']:.1f}")
                        old_mc = card.get("current_mc", 0)
                        card["current_mc"] = old_mc + 20
                        group.add("buff", mc_change(old_mc, card["current_mc"]))
                        log.append(group.finalize())
                    else:
                        log.append(pretty_log("skip", "not enough destroyed cards", card))
                    card["_already_handled"] = True
                    card["_phase_triggered"] = True
                    triggered_cards.add(card["card_id"])
                    continue

                elif card["card_id"] == "COC_RR_R2" and not card.get("_already_handled", False):
                    group = CardLogGroup(card, phase_name)
                    card["destroyed"] = True
                    current_player.destroyed_cards.append(card)
                    old_mc = card.get("current_mc", 0)
                    card["current_mc"] = 0
                    group.add("destroy", f"{card['card_id']} destroys itself (was {old_mc:.1f} MC)")
                    all_projects = current_player.field + other_player.field
                    boosted = False
                    for proj in all_projects:
                        if (proj.get("card_type") == "Project" and not proj.get("destroyed") and "Machine" in proj.get("tags", [])):
                            old_mc = proj.get("current_mc", 0)
                            proj["current_mc"] = old_mc + 6
                            boosted = True
                            group.add("buff", f"{proj['card_id']} gains +6 MC → {old_mc:.1f} → {proj['current_mc']:.1f}")
                    if not boosted:
                        group.add("skip", "No Machine-tagged Projects on the field to buff!")
                    log.append(group.finalize())
                    card["_already_handled"] = True
                    card["_phase_triggered"] = True
                    triggered_cards.add(card["card_id"])
                    continue

                elif card["card_id"] == "COC_Wolfswap_M1" and not card.get("_already_handled", False):
                    group = CardLogGroup(card, phase_name)
                    group.add("trigger", f"{card['card_id']} triggered ({phase_name})")
                    valid_targets = [
                        c for c in other_player.field
                        if c.get("card_type") == "Project" and not c.get("destroyed")
                    ]
                    if valid_targets:
                        chosen = random.sample(valid_targets, min(2, len(valid_targets)))
                        group.add("rng", f"🎲 🎲 selected {len(chosen)} random enemy Project(s) to destroy")
                        for t in chosen:
                            old_mc = t.get("current_mc", 0)
                            t["destroyed"] = True
                            other_player.destroyed_cards.append(t)
                            group.add("destroy", f"💥 💥 {card['card_id']} destroyed {t['owner']}’s {t['card_id']} ({old_mc:.1f} MC removed)")
                        if not other_player.first_friendly_destroyed:
                            other_player.first_friendly_destroyed = True
                            group.add("immune", f"🛡️ 🛡️ First friendly Project destroyed for {other_player.name}")
                    else:
                        group.add("skip", "found no valid targets!")
                    log.append(group.finalize())
                    card["_already_handled"] = True
                    card["_phase_triggered"] = True
                    triggered_cards.add(card["card_id"])
                    continue

                # ---- General condition path ----
                context.update({
                    "source_card": card,
                    "field": current_player.field,
                    "opponent_field": other_player.field,
                    "player": current_player,
                    "opponent": other_player,
                    "last_destroyed": getattr(current_player, "last_destroyed", None),
                    "effect": effect,
                })

                if card.get("_handled_this_phase", False):
                    break
                if card.get("_phase_triggered", False):
                    break

                if not check_condition(card, effect, current_player, other_player,
                                       current_deck, current_player.field,
                                       context=context, log=log):
                    if card.get("_phase_triggered", False):
                        break
                    reason = get_skip_reason(card, effect, current_player, other_player)
                    pretty_reason = reason.replace("❌ ", "").replace("Condition not met:", "").strip()
                    log.append(pretty_log("skip", f"could not act — {pretty_reason}", card))
                    card["_handled_this_phase"] = True
                    card["_already_handled"] = True
                    break

                # Mark triggered, create group and collect targets
                card["_phase_triggered"] = True
                print(f"[DEBUG] {card['card_id']} successfully triggered in {phase_name}")
                triggered_cards.add(card["card_id"])
                group = CardLogGroup(card, phase_name)
                context["group"] = group

                targets = get_targets(
                    effect.get("target_type"),
                    current_player,
                    other_player,
                    card,
                    self_deck=current_deck,
                    opponent_deck=other_player.field,
                    effect=effect,
                )
                context["targets"] = targets

                if phase_name == "Debuff":
                    for t in targets:
                        if t.get("card_type") == "Project" and not t.get("destroyed"):
                            t["targeted_by_debuff"] = True

                if effect.get("target_type") == "matching_enemy_project":
                    desired = effect.get("condition_value")
                    found = [c['card_id'] for c in other_player.field
                             if c.get('card_type') == 'Project'
                             and not c.get('destroyed', False)
                             and (c.get('rarity') == desired or desired in c.get('tags', []))]
                    log.append(pretty_log("rng", f"matching_enemy_project search for '{desired}': found {len(found)} → {found}", card))

                if not targets and effect.get("target_type"):
                    if card["card_id"] == "COC_Whale_Games":
                        print(f"[DEBUG] {card['card_id']} bypassed skip due to special Whale Games handling")
                    else:
                        already_logged_skip = any(
                            isinstance(entry, str)
                            and "skip" in entry.lower()
                            and card.get("card_id") in entry
                            for entry in log
                        )
                        if not already_logged_skip:
                            if card["card_id"] == "COC_Buy_the_Dip":
                                group.add("skip", f"⛔ {card['card_id']} could not act — 📉 No Projects lost MC this match.")
                            elif "Cr00ts" in card["card_id"]:
                                group.add("skip", f"⚠️ {card['card_id']} rallied the Cr00ts, but no Common Cr00ts were available to answer the call.")
                            else:
                                group.add("skip", f"⛔ {card['card_id']} skipped — no valid targets.")
                        log.append(group.finalize())
                    card["_handled_this_phase"] = True
                    card["_already_handled"] = True
                    card["_phase_triggered"] = True
                    context.pop("group", None)
                    break

                apply_action(
                    card,
                    effect.get("action_type"),
                    effect.get("action_value"),
                    current_player.name,
                    log,
                    context
                )

                # Lock, finalize group
                card["_handled_this_phase"] = True
                card["_already_handled"] = True
                card["_phase_triggered"] = True
                log.append(group.finalize())
                card["_handled_this_phase"] = True
                break  # one effect per card per phase

    # Step 3: trigger Cr00ts after first debuff resolves
    # Elke reactie kijkt naar de eerste debuff die de EIGENAAR van de kaart trof.
    if phase_name == "Debuff" and cr00ts_reactions:
        for card, effect, context, owner_player in cr00ts_reactions:
            debuff = getattr(owner_player, "first_debuff_data", None)
            if debuff:
                log.append(pretty_log("immune", "triggers after first debuff detected (delayed reaction)", card))
                context["targets"] = [debuff["source_card"]]
                apply_action(card, effect.get("action_type"), effect.get("action_value"), owner_player.name, log, context)
                card["cr00ts_done"] = True
            else:
                log.append(pretty_log("skip", "found no debuff effect to reflect", card))

    # De per-fase vlaggen worden aan het BEGIN van elke fase gewist, in
    # simulate_match_with_decks(). Ze hier alleen na Debuff wissen zorgde ervoor
    # dat een kaart die in Start afvuurde geblokkeerd bleef in Buff en Debuff,
    # en dat een Final-effect nooit aan de beurt kwam.
    return deck


# =========================
# Runner helpers
# =========================

def run_effect(card, effect, player, opponent, field, opponent_field, log,
               player_name, deck, opponent_deck, phase_name):
    # ── Shape guards: coerce everything into the forms this function expects ──
    # Unwrap decks if a DummyPlayer slipped in
    if isinstance(deck, DummyPlayer):
        deck = deck.field
    if isinstance(opponent_deck, DummyPlayer):
        opponent_deck = opponent_deck.field
    if isinstance(field, DummyPlayer):
        field = field.field
    if isinstance(opponent_field, DummyPlayer):
        opponent_field = opponent_field.field

    def _names(base: str):
        base = (base or "Player 1").strip()
        if base == "Player 2":
            return "Player 2", "Player 1"
        return "Player 1", "Player 2"

    me_name, them_name = _names(player_name)

    def _as_player(maybe, name):
        if isinstance(maybe, DummyPlayer):
            return maybe
        if isinstance(maybe, list):
            for c in maybe:
                if isinstance(c, dict):
                    c.setdefault("owner", name)
            return DummyPlayer(maybe, name=name)
        if maybe is None:
            return DummyPlayer([], name=name)
        # Best-effort wrap for odd inputs
        try:
            seq = list(maybe)
        except Exception:
            seq = []
        for c in seq:
            if isinstance(c, dict):
                c.setdefault("owner", name)
        return DummyPlayer(seq, name=name)

    player   = _as_player(player, me_name)
    opponent = _as_player(opponent, them_name)

    # If callers didn't provide deck lists, use the players' fields
    deck = deck if isinstance(deck, list) else player.field
    opponent_deck = opponent_deck if isinstance(opponent_deck, list) else opponent.field

    # Keep field args consistent with our coerced players
    field = player.field
    opponent_field = opponent.field

    # Ensure each card has an owner (some targeters/guards rely on it)
    for c in deck:
        if isinstance(c, dict):
            c.setdefault("owner", player.name)
    for c in opponent_deck:
        if isinstance(c, dict):
            c.setdefault("owner", opponent.name)

    # ── Original logic from here down ─────────────────────────────────────────
    trigger_type = effect.get("trigger_type", "automatic")
    if trigger_type == "passive":
        return

    if trigger_type == "conditional":
        if not check_condition(card, effect, player, opponent, deck, player.field):
            log.append(pretty_log("skip", f"{phase_name} skipped — Condition not met", card))
            return
        log.append(pretty_log("trigger", f"{phase_name} TRIGGERED → {effect}", card))
    else:
        log.append(pretty_log("trigger", f"Evaluating {phase_name} → {effect}", card))

    action_type = effect.get("action_type")
    action_value = effect.get("action_value", 0)

    targets = []
    if action_type not in ["base_mc_of_lowest"]:
        targets = get_targets(effect.get("target_type"), player, opponent, card, deck, opponent_deck, effect=effect)
        log.append(pretty_log("rng", f"targeting {len(targets)} card(s)", card))

    if action_type == "base_mc_of_lowest":
        log.append(pretty_log("phase", "Echo effect triggered", card))
        apply_action(
            card, action_type, action_value, player.name, log,
            context={
                "source_card": card, "effect": effect, "field": player.field,
                "player": player, "opponent": opponent, "opponent_field": opponent.field,
                "targets": [], "is_reflected": False
            }
        )
        return

    if action_type == "swap_mc" and len(targets) != 2:
        log.append(pretty_log("skip", f"swap_mc skipped (needs 2 targets, got {len(targets)})", card))
        return

    if not getattr(opponent, "first_debuff_data", None) and action_type not in ["negate_and_reflect"]:
        for t in targets:
            if t.get("owner") != player.name:
                opponent.first_debuff_data = {"source_card": card, "effect": effect, "target": t}
                log.append(pretty_log("immune", f"First debuff detected targeting {t.get('card_id')}", card))
                break

    apply_action(
        card, action_type, action_value, player.name, log,
        context={
            "source_card": card, "effect": effect, "field": player.field,
            "player": player, "opponent": opponent, "opponent_field": opponent.field,
            "targets": targets, "is_reflected": False
        }
    )

    return deck


# =========================
# Printing helpers
# =========================

def format_deck(deck, player_name):
    icon = "🔷" if player_name == "Player 1" else "🔶"
    log = [f"{icon} **{player_name}’s Lineup**\n"]

    projects, supports, founders = [], [], []
    for c in deck:
        ct = _ctype(c).lower()
        if ct == "project":
            projects.append(c)
        elif ct == "support":
            supports.append(c)
        elif ct == "founder":
            founders.append(c)

    if projects:
        log.append("🧱 **Projects**")
        for c in projects:
            base_mc = c.get("base_mc", 0)
            desc = c.get("description", "").strip()
            log.append(f"• 🟩 `{c['card_id']}` — 💰 {base_mc:.0f} MC\n   ↳ *{desc}*")
        log.append("")

    if supports:
        log.append("🛠️ **Supports**")
        for c in supports:
            desc = c.get("description", "").strip()
            log.append(f"• 🟧 `{c['card_id']}`\n   ↳ *{desc}*")
        log.append("")

    if founders:
        log.append("👑 **Founder**")
        for c in founders:
            desc = c.get("description", "").strip()
            log.append(f"• 🟨 `{c['card_id']}`\n   ↳ *{desc}*")
        log.append("")

    return log

# =========================
# Simulations
# =========================

def simulate_match():
    deck1 = generate_deck()
    deck2 = generate_deck()

    for card in deck1:
        card["owner"] = "Player 1"
    for card in deck2:
        card["owner"] = "Player 2"

    player1 = DummyPlayer(deck1, name="Player 1")
    player2 = DummyPlayer(deck2, name="Player 2")

    log_blocks = []

    lineup_block = []
    lineup_block.append("🎴 **The Cards of Cronos Battle Begins!**")
    lineup_block += format_deck(deck1, "Player 1") + [""]
    lineup_block += format_deck(deck2, "Player 2") + [""]
    log_blocks.append("\n".join(lineup_block))

    base_block = []
    base_block.append("━━━━━━━━━━━━━━━━━━━━")
    base_block.append("⚖️ **Base Phase**")
    for card in deck1:
        if _ctype(card) == "Project":
            card["current_mc"] = card.get("base_mc", 0)
            base_block.append(f"📈 Player 1’s {card['card_id']} starts with base MC → {card['current_mc']}")
    for card in deck2:
        if _ctype(card) == "Project":
            card["current_mc"] = card.get("base_mc", 0)
            base_block.append(f"📈 Player 2’s {card['card_id']} starts with base MC → {card['current_mc']}")
    base_block.append(f"📊 Player 1 opens with **{calculate_total_mc(deck1)} MC**")
    base_block.append(f"📊 Player 2 responds with **{calculate_total_mc(deck2)} MC**")
    log_blocks.append("\n".join(base_block))

    # Wie binnen een fase als eerste handelt wisselt om en om, met een geloot
    # begin. Zo krijgt elke speler precies drie van de zes fases als eerste en
    # heeft niemand een structureel voordeel. Het muntje hangt aan de seed, dus
    # de match blijft reproduceerbaar.
    start_muntje = random.randint(0, 1)

    for fase_index, phase in enumerate(["Start", "Buff", "Debuff", "Support", "Counter", "Final"]):
        phase_block = []
        phase_block.append(phase_banner(phase))
        print(f"[DEBUG] Starting {phase} Phase → clearing phase_triggers")

        # Reset per-phase flags
        for c in deck1 + deck2:
            # Eerst het resultaat van de vorige fase optellen bij de match-totalen.
            # De per-fase vlaggen worden hieronder gewist, maar voorwaarden als
            # "als deze kaart deze match MC verloor" hebben de hele match nodig.
            if c.get("targeted_by_debuff"):
                c["_ever_debuffed"] = True
            if c.get("lost_mc_this_phase"):
                c["_mc_lost_total"] = c.get("_mc_lost_total", 0) + abs(c["lost_mc_this_phase"])

            c["targeted_by_debuff"] = False
            c["lost_mc_this_phase"] = 0
            c["phase_triggers"] = {}
            # Elke fase is een schone lei. Werden deze vlaggen niet gewist, dan
            # bleef een kaart die in een eerdere fase afvuurde de rest van de
            # match inert — inclusief kaarten met een Final-effect.
            c.pop("_phase_triggered", None)
            c.pop("_handled_this_phase", None)
            c.pop("_immediate_triggered", None)
            c.pop("_already_handled", None)

        if phase == "Debuff":
            player1.first_debuff_blocked = False
            player1.first_debuff_data = None
            player2.first_debuff_blocked = False
            player2.first_debuff_data = None

        apply_phase(deck1, deck2, phase_block, "Player 1", phase, player1, player2,
                    p2_eerst=((start_muntje + fase_index) % 2 == 1))

        # Ook na de laatste fase de totalen bijwerken; de reset hierboven draait
        # alleen aan het begin van een fase, dus Final zou anders wegvallen.
        for c in deck1 + deck2:
            if c.get("targeted_by_debuff"):
                c["_ever_debuffed"] = True
            if c.get("lost_mc_this_phase"):
                c["_mc_lost_total"] = c.get("_mc_lost_total", 0) + abs(c["lost_mc_this_phase"])

            # "Beschermt tegen vernietiging, één keer": vernietigingen gebeuren
            # verspreid door de engine, dus we draaien het hier terug. Het schild
            # wordt daarbij opgebruikt.
            if c.get("destroyed") and int(c.get("_destroy_shield", 0)) > 0:
                c["_destroy_shield"] = int(c["_destroy_shield"]) - 1
                c["destroyed"] = False
                for speler in (player1, player2):
                    try:
                        if c in speler.destroyed_cards:
                            speler.destroyed_cards.remove(c)
                    except Exception:
                        pass
                phase_block.append(
                    f"🛡️ **{c['card_id']} survives destruction — its shield is used up**")

        p1_mc = calculate_total_mc(deck1)
        p2_mc = calculate_total_mc(deck2)
        phase_block.append("")
        phase_block.append(f"📊 Player 1 MC after {phase}: **{p1_mc:.1f}**")
        phase_block.append(f"📊 Player 2 MC after {phase}: **{p2_mc:.1f}**")
        log_blocks.append("\n".join(phase_block))

    final_block = []
    destroyed_1 = [c for c in deck1 if c.get("destroyed")]
    destroyed_2 = [c for c in deck2 if c.get("destroyed")]

    if destroyed_1 or destroyed_2:
        final_block.append("━━━━━━━━━━━━━━━━━━━━")
        final_block.append("💀 **Destroyed Cards (Not Counted in Final MC):**")
        if destroyed_1:
            final_block.append("🔷 Player 1:")
            for c in destroyed_1:
                final_block.append(card_status(c))
        if destroyed_2:
            final_block.append("🔶 Player 2:")
            for c in destroyed_2:
                final_block.append(card_status(c))

    p1_final = calculate_total_mc(deck1)
    p2_final = calculate_total_mc(deck2)
    final_block.append(victory_screen(p1_final, p2_final))
    log_blocks.append("\n".join(final_block))

    return log_blocks, deck1, deck2

def simulate_match_with_decks(
    deck1=None,
    deck2=None,
    *,
    deck1_ids=None,
    deck2_ids=None,
    allow_fallback_to_last=False,
    save_last_match=False,
    seed=None
):

    import os, json as _json

    # De engine gebruikt random.choice/random.sample op tientallen plekken in
    # targeting.py en action.py. Zonder seed is dezelfde match nooit twee keer
    # hetzelfde en is een uitslag niet te controleren of te herspelen.
    if seed is not None:
        random.seed(seed)

    all_cards = ALL_CARDS  # use module-level cards loaded with absolute path

    if deck1 is None and deck1_ids is not None:
        deck1 = load_deck_from_ids(deck1_ids, all_cards, "Player 1", strict=True)
    if deck2 is None and deck2_ids is not None:
        deck2 = load_deck_from_ids(deck2_ids, all_cards, "Player 2", strict=True)

    if (deck1 is None or deck2 is None):
        _last_match_path = os.path.join(BASE_DIR, "last_match.json")
        if allow_fallback_to_last and os.path.exists(_last_match_path):
            with open(_last_match_path, "r", encoding="utf-8") as f:
                saved = _json.load(f)
            if deck1 is None:
                deck1 = load_deck_from_ids(saved.get("deck1", []), all_cards, "Player 1", strict=True)
            if deck2 is None:
                deck2 = load_deck_from_ids(saved.get("deck2", []), all_cards, "Player 2", strict=True)
        else:
            missing = []
            if deck1 is None: missing.append("Player 1")
            if deck2 is None: missing.append("Player 2")
            raise ValueError(f"Missing deck for: {', '.join(missing)} (no fallback)")

    for c in (deck1 or []):
        c["owner"] = "Player 1"
        c.setdefault("current_mc", 0)
    for c in (deck2 or []):
        c["owner"] = "Player 2"
        c.setdefault("current_mc", 0)

    def _assert_deck_shape(deck, label):
        if not isinstance(deck, list) or not deck:
            raise ValueError(f"{label}: deck is empty or not a list")
        bad = [i for i, c in enumerate(deck) if not isinstance(c, dict) or "card_id" not in c]
        if bad:
            kinds = [type(deck[i]).__name__ for i in bad[:3]]
            raise ValueError(
                f"{label}: invalid deck entries at {bad[:3]} (types: {kinds}); "
                f"did you pass IDs into `deck1=` instead of `deck1_ids=`?"
            )

    # ... inside simulate_match_with_decks, after building decks:
    _assert_deck_shape(deck1, "Player 1")
    _assert_deck_shape(deck2, "Player 2")


    _validate_5_5_1(deck1, "Player 1")
    _validate_5_5_1(deck2, "Player 2")

    if save_last_match:
        _last_match_path = os.path.join(BASE_DIR, "last_match.json")
        with open(_last_match_path, "w", encoding="utf-8") as f:
            _json.dump({"deck1": [c["card_id"] for c in deck1],
                        "deck2": [c["card_id"] for c in deck2]}, f, indent=2)

    print("[sim] USING CUSTOM P1:", [c["card_id"] for c in deck1])
    print("[sim] USING CUSTOM P2:", [c["card_id"] for c in deck2])

    player1 = DummyPlayer(deck1, "Player 1")
    player2 = DummyPlayer(deck2, "Player 2")

    log_blocks = []

    lineup_block = []
    lineup_block.append("🎴 **The Cards of Cronos Battle Begins!**")
    lineup_block += format_deck(deck1, "Player 1") + [""]
    lineup_block += format_deck(deck2, "Player 2") + [""]
    log_blocks.append("\n".join(lineup_block))

    base_block = []
    base_block.append("━━━━━━━━━━━━━━━━━━━━")
    base_block.append("⚖️ **Base Phase**")
    for card in deck1:
        if _ctype(card) == "Project":
            card["current_mc"] = card.get("base_mc", 0)
            base_block.append(f"📈 Player 1’s {card['card_id']} starts with base MC → {card['current_mc']}")
    for card in deck2:
        if _ctype(card) == "Project":
            card["current_mc"] = card.get("base_mc", 0)
            base_block.append(f"📈 Player 2’s {card['card_id']} starts with base MC → {card['current_mc']}")
    base_block.append(f"📊 Player 1 opens with **{calculate_total_mc(deck1)} MC**")
    base_block.append(f"📊 Player 2 responds with **{calculate_total_mc(deck2)} MC**")
    log_blocks.append("\n".join(base_block))

    # Wie binnen een fase als eerste handelt wisselt om en om, met een geloot
    # begin. Zo krijgt elke speler precies drie van de zes fases als eerste en
    # heeft niemand een structureel voordeel. Het muntje hangt aan de seed, dus
    # de match blijft reproduceerbaar.
    start_muntje = random.randint(0, 1)

    for fase_index, phase in enumerate(["Start", "Buff", "Debuff", "Support", "Counter", "Final"]):
        phase_block = []
        phase_block.append(phase_banner(phase))
        print(f"[DEBUG] Starting {phase} Phase → clearing phase_triggers")

        for c in deck1 + deck2:
            # Eerst het resultaat van de vorige fase optellen bij de match-totalen.
            # De per-fase vlaggen worden hieronder gewist, maar voorwaarden als
            # "als deze kaart deze match MC verloor" hebben de hele match nodig.
            if c.get("targeted_by_debuff"):
                c["_ever_debuffed"] = True
            if c.get("lost_mc_this_phase"):
                c["_mc_lost_total"] = c.get("_mc_lost_total", 0) + abs(c["lost_mc_this_phase"])

            c["targeted_by_debuff"] = False
            c["lost_mc_this_phase"] = 0
            c["phase_triggers"] = {}
            # Elke fase is een schone lei. Werden deze vlaggen niet gewist, dan
            # bleef een kaart die in een eerdere fase afvuurde de rest van de
            # match inert — inclusief kaarten met een Final-effect.
            c.pop("_phase_triggered", None)
            c.pop("_handled_this_phase", None)
            c.pop("_immediate_triggered", None)
            c.pop("_already_handled", None)

        if phase == "Debuff":
            player1.first_debuff_blocked = False
            player1.first_debuff_data = None
            player2.first_debuff_blocked = False
            player2.first_debuff_data = None

        apply_phase(deck1, deck2, phase_block, "Player 1", phase, player1, player2,
                    p2_eerst=((start_muntje + fase_index) % 2 == 1))

        # Ook na de laatste fase de totalen bijwerken; de reset hierboven draait
        # alleen aan het begin van een fase, dus Final zou anders wegvallen.
        for c in deck1 + deck2:
            if c.get("targeted_by_debuff"):
                c["_ever_debuffed"] = True
            if c.get("lost_mc_this_phase"):
                c["_mc_lost_total"] = c.get("_mc_lost_total", 0) + abs(c["lost_mc_this_phase"])

            # "Beschermt tegen vernietiging, één keer": vernietigingen gebeuren
            # verspreid door de engine, dus we draaien het hier terug. Het schild
            # wordt daarbij opgebruikt.
            if c.get("destroyed") and int(c.get("_destroy_shield", 0)) > 0:
                c["_destroy_shield"] = int(c["_destroy_shield"]) - 1
                c["destroyed"] = False
                for speler in (player1, player2):
                    try:
                        if c in speler.destroyed_cards:
                            speler.destroyed_cards.remove(c)
                    except Exception:
                        pass
                phase_block.append(
                    f"🛡️ **{c['card_id']} survives destruction — its shield is used up**")

        p1_mc = calculate_total_mc(deck1)
        p2_mc = calculate_total_mc(deck2)
        phase_block.append("")
        phase_block.append(f"📊 Player 1 MC after {phase}: **{p1_mc:.1f}**")
        phase_block.append(f"📊 Player 2 MC after {phase}: **{p2_mc:.1f}**")
        log_blocks.append("\n".join(phase_block))

    final_block = []
    destroyed_1 = [c for c in deck1 if c.get("destroyed")]
    destroyed_2 = [c for c in deck2 if c.get("destroyed")]
    if destroyed_1 or destroyed_2:
        final_block.append("━━━━━━━━━━━━━━━━━━━━")
        final_block.append("💀 **Destroyed Cards (Not Counted in Final MC):**")
        if destroyed_1:
            final_block.append("🔷 Player 1:")
            for c in destroyed_1:
                final_block.append(f"• {c['card_id']} – Destroyed")
        if destroyed_2:
            final_block.append("🔶 Player 2:")
            for c in destroyed_2:
                final_block.append(f"• {c['card_id']} – Destroyed")

    p1_final = calculate_total_mc(deck1)
    p2_final = calculate_total_mc(deck2)
    final_block.append(victory_screen(p1_final, p2_final))
    log_blocks.append("\n".join(final_block))

    return log_blocks, deck1, deck2

# (DummyPlayer class moved to top of file)