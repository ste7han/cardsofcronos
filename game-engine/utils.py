def pretty_log(event_type, msg, card=None, subevents=None, single_line=False, grouped=False):
    """
    Formats logs. Supports grouped mode:
    - grouped=True: Triggers create a box, and later actions become subevents.
    """
    emojis = {
        "trigger": "🧪",
        "buff": "📈",
        "debuff": "➖",
        "destroy": "💥",
        "immune": "🛡️",
        "skip": "⛔",
        "rng": "🎲",
        "phase": "🔄",
        "summary": "📊",
        "victory": "🏆",
        "death": "💀",
        "warn": "⚠️",
        "info": "🔹",
        "money": "💰",
        "swap": "🔁",
        "double": "✨",
        "reflect": "🪞",
    }

    prefix = emojis.get(event_type, "🔹")

    # ✅ Build owner prefix when card is present
    if card:
        owner = card.get("owner", "")
        owner_str = f"{owner}’s " if owner else ""
    else:
        owner_str = ""

    # ✅ Single-line quick logs
    if single_line:
        return f"{prefix} {owner_str}{card['card_id']} — {msg}" if card else f"{prefix} {msg}"

    # ✅ Grouped Trigger Block
    if grouped and event_type == "trigger":
        header = f"{prefix} {owner_str}{card['card_id']} — {msg}" if card else f"{prefix} {msg}"
        lines = ["---------------", header]
        if subevents:
            for s in subevents:
                lines.append(f"{s}")
        lines.append("---------------")
        return "\n".join(lines)

    # ✅ Grouped subevent (no new box)
    if grouped and event_type != "trigger":
        symbol = prefix
        return f"   ↳ {symbol} {msg}"

    # ✅ Default full block (old style)
    if card:
        header = f"{prefix} {owner_str}{card['card_id']} — {msg}"
    else:
        header = f"{prefix} {msg}"

    lines = ["---------------", header]
    if subevents:
        for s in subevents:
            lines.append(f"   {s}")
    lines.append("---------------")
    return "\n".join(lines)


class CardLogGroup:
    def __init__(self, card, phase_name):
        self.card = card
        self.phase_name = phase_name
        self.subevents = []

    def add(self, event_type, msg):
        """Store a subevent for later pretty printing."""
        self.subevents.append(pretty_log(event_type, msg, self.card, grouped=True))

    def finalize(self):
        """Return the grouped pretty log with all subevents in one block."""
        return pretty_log(
            "trigger",
            f"triggered ({self.phase_name})",
            self.card,
            subevents=self.subevents,
            grouped=True
        )


def log_event(context=None, log=None, event_type="info", msg="", card=None):
    """Log via CardLogGroup when available; otherwise append a pretty string to the phase log."""
    if context is None:
        context = {}
    if log is None:
        return  # nowhere to log

    group = context.get("group")
    if group is not None:
        # Route into the grouped card log
        group.add(event_type, msg)
        return

    # Fall back to a single formatted string line
    # pretty_log(event_type, message, card) should already exist in utils
    log.append(pretty_log(event_type, msg, card))



def track_first_debuff(target, source_card, effect, player=None, victim_player=None, log=None):
    """
    Record/log the FIRST time this victim side has a Project targeted by a debuff.
    Backward-compatible: accepts `player` or `victim_player`.
    """
    # Resolve victim argument (prefer explicit victim_player)
    victim = victim_player or player
    if victim is None:
        return  # nothing to do if caller passed neither

    # Must be a live Project belonging to the victim side
    if target.get("card_type") != "Project" or target.get("destroyed", False):
        return
    if target.get("owner") != victim.name:
        return

    # Already handled/blocked?
    if getattr(victim, "first_debuff_blocked", False):
        return
    if getattr(victim, "first_debuff_data", None):
        return

    # Store first-debuff info
    victim.first_debuff_data = {
        "source_card": source_card,
        "effect": effect,
        "target": target,
        "player": victim,
    }

    # Friendly-fire label if attacker is same side as victim
    attacker_name = source_card.get("owner")
    friendly_fire = (attacker_name == victim.name)
    ff_suffix = " (friendly fire)" if friendly_fire else ""

    who = f"{victim.name}’s {target['card_id']}"
    log.append(pretty_log("immune",
                          f"First debuff detected targeting {who}{ff_suffix}",
                          source_card))



def maybe_reflect_first_debuff(target_card, source_card, effect, context, log):
    """
    If the defending player has an armed first-debuff shield:
      - block this debuff,
      - mark shield as spent,
      - return a reflected effect (same effect aimed at source).
    Return False if nothing to intercept.
    """
    # Only care about Project targets
    if target_card.get("card_type") != "Project":
        return False

    defender_name = target_card.get("owner")
    # Expect a mapping: context["players_by_name"][name] -> player object
    players_by_name = context.get("players_by_name", {})
    defender = players_by_name.get(defender_name)
    if defender is None:
        return False

    # Must be armed and not spent
    data = getattr(defender, "first_debuff_data", None)
    spent = getattr(defender, "first_debuff_blocked", False)
    if not data or spent:
        return False

    # Spend the shield
    setattr(defender, "first_debuff_blocked", True)

    # Log the reflection
    log_event(
        context, log, "reflect",
        f"🪞 Reflected first debuff from {source_card.get('card_id')} targeting {target_card.get('card_id')}."
    )

    # Build a reflected copy of the effect (retarget to the source)
    reflected = dict(effect)  # shallow copy is fine for your shapes
    reflected["target_type"] = "self"  # your targeting for self already points to source_card
    return reflected


# utils.py
def arm_first_debuff_sentinel(context, player, card, *, mode="negate", scope="other_projects", log=None):
    """
    Arms a 'first debuff' sentinel for player.
    mode: 'negate' or 'reflect'
    scope: 'other_projects' | 'self' | 'any_project'
    """
    sentinels = context.setdefault("sentinels", {})
    state = sentinels.get(player.name)
    # Don't overwrite if already armed or used
    if state and not state.get("used"):
        return

    sentinels[player.name] = {
        "card_id": card["card_id"],
        "used": False,
        "mode": mode,           # CF_E1 uses 'negate'
        "scope": scope,         # CF_E1 uses 'other_projects'
    }
    log_event(context, log, "immune",
              f"🛡️ {card['card_id']} armed: first debuff on your {scope.replace('_',' ')} will be negated.",
              card)


def maybe_block_first_debuff(target_card, source_card, effect, context, log):
    """
    If defender has an armed 'first_debuff' shield, and the target matches its scope,
    consume the shield and BLOCK the debuff.
    Returns True if the debuff was blocked (caller should stop applying).
    """
    if target_card.get("card_type") != "Project":
        return False

    defender_owner = target_card.get("owner")
    sentinels = context.get("sentinels", {})
    state = sentinels.get(defender_owner)
    if not state or state.get("used"):
        return False

    # Check scope
    scope = state.get("scope")
    # For 'other_projects', the shielding card itself should NOT be protected.
    if scope == "other_projects":
        if state.get("card_id") == target_card.get("card_id"):
            return False
    elif scope == "self":
        if state.get("card_id") != target_card.get("card_id"):
            return False
    # 'any_project' shields any of defender's Projects

    # Consume shield
    state["used"] = True

    log_event(
        context,
        log,
        "immune",
        f"🛡️ {state['card_id']} blocked the first debuff from {source_card['card_id']} targeting {target_card['card_id']}.",
    )
    return True
