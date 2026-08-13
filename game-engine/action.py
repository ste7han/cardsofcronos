import re
import random
from targeting import get_targets
from utils import (
    log_event, pretty_log, CardLogGroup,
    maybe_reflect_first_debuff, arm_first_debuff_sentinel, maybe_block_first_debuff,
    track_first_debuff
)
from types import SimpleNamespace


# ---------------------------
# Core helpers / normalizers
# ---------------------------

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


def _ensure_player_shape(p, default_name="Player ?"):
    """
    Make sure we can safely do things like player.field, player.destroyed_cards, etc.
    Never returns None; always returns an object with the expected attributes.
    """
    if p is None:
        p = SimpleNamespace(name=default_name)

    # identity
    if not hasattr(p, "name"):
        p.name = default_name

    # zones
    for attr in ("field", "hand", "supports", "founders", "deck"):
        setattr(p, attr, _as_card_list(getattr(p, attr, [])))

    if not hasattr(p, "destroyed_cards"):
        p.destroyed_cards = []
    if not hasattr(p, "graveyard"):
        p.graveyard = p.destroyed_cards
    if not hasattr(p, "removed_cards"):
        p.removed_cards = []

    # per-phase trackers that various actions/conditions touch
    if not hasattr(p, "mc_loss_this_phase"):
        p.mc_loss_this_phase = 0.0
    if not hasattr(p, "mc_loss_total"):
        p.mc_loss_total = 0.0
    if not hasattr(p, "first_debuff_blocked"):
        p.first_debuff_blocked = False
    if not hasattr(p, "first_debuff_data"):
        p.first_debuff_data = None
    if not hasattr(p, "first_friendly_destroyed"):
        p.first_friendly_destroyed = False
    if not hasattr(p, "was_any_project_debuffed"):
        p.was_any_project_debuffed = False
    if not hasattr(p, "original_mc_snapshot"):
        p.original_mc_snapshot = {}
    if not hasattr(p, "score_modifier"):
        p.score_modifier = 0

    return p


def _coerce_player_like(x, default_name="Player 1"):
    """
    Return an object with the attributes action.py expects:
      .name .field .deck
      .destroyed_cards .graveyard .removed_cards
      .first_debuff_blocked .first_debuff_data .first_friendly_destroyed
      .original_mc_snapshot .was_any_project_debuffed .score_modifier
      .mc_loss_this_phase (float) .mc_loss_total (float)
    """
    # 1) raw list -> wrap
    if isinstance(x, list):
        deck = _as_card_list(x)
        for c in deck:
            if isinstance(c, dict):
                c.setdefault("owner", default_name)
        return _ensure_player_shape(
            SimpleNamespace(
                name=default_name,
                field=deck, deck=deck,
                destroyed_cards=[], graveyard=[], removed_cards=[],
                first_debuff_blocked=False, first_debuff_data=None,
                first_friendly_destroyed=False,
                original_mc_snapshot={},
                was_any_project_debuffed=False,
                score_modifier=0,
                mc_loss_this_phase=0.0,
                mc_loss_total=0.0,
            ),
            default_name
        )

    # 2) None -> fully initialized namespace
    if x is None:
        return _ensure_player_shape(SimpleNamespace(name=default_name), default_name)

    # 3) object-like -> normalize/patch in place
    try:
        p = _ensure_player_shape(x, default_name)
        return p
    except Exception:
        # last-resort wrapper (should be rare)
        return _ensure_player_shape(
            SimpleNamespace(
                name=getattr(x, "name", default_name),
                field=_as_card_list(getattr(x, "field", [])),
                deck=_as_card_list(getattr(x, "deck", getattr(x, "field", []))),
                destroyed_cards=list(getattr(x, "destroyed_cards", [])),
                graveyard=list(getattr(x, "graveyard", getattr(x, "destroyed_cards", []))),
                removed_cards=list(getattr(x, "removed_cards", [])),
                first_debuff_blocked=bool(getattr(x, "first_debuff_blocked", False)),
                first_debuff_data=getattr(x, "first_debuff_data", None),
                first_friendly_destroyed=bool(getattr(x, "first_friendly_destroyed", False)),
                original_mc_snapshot=dict(getattr(x, "original_mc_snapshot", {}) or {}),
                was_any_project_debuffed=bool(getattr(x, "was_any_project_debuffed", False)),
                score_modifier=int(getattr(x, "score_modifier", 0) or 0),
                mc_loss_this_phase=float(getattr(x, "mc_loss_this_phase", 0.0) or 0.0),
                mc_loss_total=float(getattr(x, "mc_loss_total", 0.0) or 0.0),
            ),
            default_name
        )


def owner_player_of(card, player, opponent):
    """Return the Player object that owns `card`, or None if unknown."""
    owner = (card or {}).get("owner")
    if owner == getattr(player, "name", None):
        return player
    if owner == getattr(opponent, "name", None):
        return opponent
    return None


def _sid(obj):
    return obj.get("card_id") if isinstance(obj, dict) else "?"


# ---------------------------
# Buy The Dip tracking
# ---------------------------

def ensure_btd_tracking(card, loss_amount, player, context, log, match_state=None):
    if not card or loss_amount <= 0 or card.get("destroyed", False):
        return

    card["mc_loss_total"] = card.get("mc_loss_total", 0) + loss_amount
    card["lost_mc_due_to_effect"] = card.get("lost_mc_due_to_effect", 0) + loss_amount

    if "loss_events" not in card:
        card["loss_events"] = []
    card["loss_events"].append({
        "phase": (context or {}).get("phase") or (context or {}).get("current_phase"),
        "amount": loss_amount,
    })

    if "lost_mc_projects" not in context:
        context["lost_mc_projects"] = []
    if not any(p.get("card_id") == card.get("card_id") for p in context["lost_mc_projects"]):
        context["lost_mc_projects"].append(card)

    if match_state is not None:
        losses = match_state.setdefault("btd_losses", {})
        losses[card["card_id"]] = losses.get(card["card_id"], 0) + loss_amount

        if "lost_mc_projects" not in match_state:
            match_state["lost_mc_projects"] = []
        if not any(p.get("card_id") == card.get("card_id") for p in match_state["lost_mc_projects"]):
            match_state["lost_mc_projects"].append(card)

    print(f"[BTD DEBUG] {card['card_id']} lost {loss_amount} MC (total {card['mc_loss_total']})")
    # logging suppressed by design


def check_lost_mc_due_to_effect(context, player):
    lost_projects = context.get("lost_mc_projects", [])
    lost = []

    for proj in getattr(player, "field", []):
        if any(p.get("card_id") == proj.get("card_id") for p in lost_projects):
            if proj.get("loss_events"):
                lost.append(proj)

    print(f"[BTD DEBUG] check_lost_mc_due_to_effect → {len(lost)} projects found")
    return lost


# ---------------------------
# Destruction + deathrattles
# ---------------------------

def destroy_card(card, log, player=None, opponent=None, source=None, context=None):
    # Already dead? bail.
    if card.get("destroyed", False):
        return

    # --- Resolve source id for logs
    source_id = "Unknown Source"
    if isinstance(source, dict):
        source_id = source.get("card_id", "Unknown Source")
    elif isinstance(source, str):
        source_id = source.strip() or "Unknown Source"
    elif source is not None and hasattr(source, "card_id"):
        source_id = getattr(source, "card_id", "Unknown Source")
    elif context and "source_card" in context:
        source_id = context["source_card"].get("card_id", "Unknown Source")

    # --- Mark destroyed + snapshot
    card["_destroyed_mc_snapshot"] = float(card.get("current_mc", 0.0))
    card["destroyed"] = True

    owner_name = card.get("owner", "Unknown")
    card_id = card.get("card_id", "???")

    # Single destruction log
    log_event(context, log, "destroy", f"💥 {source_id} destroyed {owner_name}’s {card_id}!", card)

    # --- Track destroyed list
    if player and getattr(player, "name", None) == owner_name:
        owner_player, enemy_player = player, opponent
        if card not in player.destroyed_cards:
            player.destroyed_cards.append(card)
    elif opponent and getattr(opponent, "name", None) == owner_name:
        owner_player, enemy_player = opponent, player
        if card not in opponent.destroyed_cards:
            opponent.destroyed_cards.append(card)
    else:
        owner_player, enemy_player = None, None

    # --- Mark first friendly destroyed (centralized here)
    if owner_player and not getattr(owner_player, "first_friendly_destroyed", False):
        owner_player.first_friendly_destroyed = True
        log_event(context, log, "immune", f"🛡️ First friendly Project destroyed for {owner_player.name}")

    # --- Fields (prefer live objects, fall back to context)
    owner_field   = getattr(owner_player, "field", []) if owner_player else (context or {}).get("field", [])
    enemy_field   = getattr(enemy_player, "field", []) if enemy_player else (context or {}).get("opponent_field", [])

    # --- Fire deathrattles exactly once
    if card.get("_deathrattle_fired"):
        return
    card["_deathrattle_fired"] = True

    for effect in card.get("parsed_power", []):
        # Trigger only the on-destroyed variants
        if effect.get("condition_type") not in ("on_destroyed", "self_destroyed"):
            continue

        # Build a fresh context, following your normal apply path
        eff_ctx = {
            **(context or {}),
            "trigger": "on_destroyed",
            "source_card": card,            # the destroyed card is the source
            "effect": effect,
            "player": owner_player,         # destroyed card’s owner POV
            "opponent": enemy_player,
            "field": owner_field,
            "opponent_field": enemy_field,
        }

        # Use standard targeter
        targets = get_targets(
            effect.get("target_type"),
            owner_player,
            enemy_player,
            card,
            self_deck=owner_field,
            opponent_deck=enemy_field,
            effect=effect,
            context=eff_ctx,
            log=log
        )
        eff_ctx["targets"] = targets

        apply_action(
            card,
            action_type=effect.get("action_type"),
            action_value=effect.get("action_value"),
            player_name=(getattr(owner_player, "name", None) or owner_name),
            log=log,
            context=eff_ctx,
        )

        log_event(context, log, "info",
                  f"⚡ {card_id} deathrattle: applied {effect.get('action_type')} → {effect.get('target_type')}")


# ---------------------------
# MC change tracking
# ---------------------------

def track_mc_change(target, before, after, player=None, action_type=None, log=None, context=None):
    # Twee kaarten dempen inkomend verlies: "kan niet meer dan 5 MC verliezen"
    # (limit_loss) en "de eerste debuff wordt met 50% verminderd"
    # (reduce_debuff_percentage). Dit is het enige punt waar élke MC-wijziging
    # langskomt, dus hier wordt het nageleefd — en de waarde teruggeschreven.
    if after < before:
        verlies = before - after

        # "Kaats de eerste debuff terug naar je tegenstander, met dubbele
        # schade." De eigenaar van het doel heeft dan een geladen schild; het
        # verlies gaat niet door en landt versterkt bij de bronkaart.
        if context and verlies > 0:
            eigenaar = None
            for kandidaat in (context.get("player"), context.get("opponent")):
                if kandidaat is not None and getattr(kandidaat, "name", None) == target.get("owner"):
                    eigenaar = kandidaat
                    break
            factor = getattr(eigenaar, "_reflect_debuff_factor", 0) if eigenaar else 0
            bron = context.get("source_card")
            if factor and isinstance(bron, dict) and bron is not target and not bron.get("destroyed"):
                setattr(eigenaar, "_reflect_debuff_factor", 0)
                terug = verlies * float(factor)
                bron_voor = float(bron.get("current_mc", 0))
                bron["current_mc"] = max(0.0, bron_voor - terug)
                if log is not None:
                    log_event(context, log, "reflect",
                              f"🛡️ {target.get('card_id','???')} reflects the debuff: "
                              f"{bron.get('card_id','???')} takes -{terug:.1f} MC "
                              f"→ {bron_voor:.1f} → {bron['current_mc']:.1f}")
                target["current_mc"] = before
                return

        # De demping van verlies (verliesplafond, debuff-korting) zit nu op de
        # kaart zelf, zie Kaart in match_simulator.py. Hier niets meer doen:
        # niet elke aanroeper heeft current_mc al toegewezen op dit punt, dus
        # de kaart uitlezen zou soms nul schade melden.

    change = after - before

    if change > 0:
        target["was_buffed"] = True
        target["last_buff_amount"] = change
        if log:
            log_event(
                context,
                log,
                "buff",
                f"{target['card_id']} buffed (+{change:.1f})",
                card=target
            )

    if change < 0:
        loss = abs(change)
        target["was_debuffed"] = True
        target["last_debuff_amount"] = loss

        # ✅ Buy the Dip logic
        ensure_btd_tracking(
            target,
            loss,
            player=player,
            context=context,
            log=None  # silent for BTD
        )

        if log:
            log_event(
                context,
                log,
                "debuff",
                f"{target['card_id']} debuffed (-{loss:.1f})",
                card=target
            )

        # ✅ First-debuff capture (generic)
        opponent = (context or {}).get("opponent")
        source_card = (context or {}).get("source_card", {})
        effect = (context or {}).get("effect")

        try:
            # Record the first debuff that hits the defender's Project — works for any card/phase.
            if opponent and target.get("owner") == opponent.name and target.get("card_type") == "Project":
                track_first_debuff(
                    target=target,
                    source_card=source_card,
                    effect=effect,
                    player=opponent,
                    log=log
                )
        except Exception as e:
            log_event(context, log, "info", f"track_first_debuff failed: {e}")

    # Player-specific MC loss tracking (optional)
    if (
        action_type == "subtract_mc"
        and player
        and target.get("owner") == player.name
        and change < 0
    ):
        # make sure the trackers exist even if player was a skinny namespace
        if not hasattr(player, "mc_loss_this_phase"): player.mc_loss_this_phase = 0.0
        if not hasattr(player, "mc_loss_total"):      player.mc_loss_total = 0.0
        player.mc_loss_this_phase += abs(change)
        player.mc_loss_total      += abs(change)


def reset_buffs_debuffs(card):
    card.pop("was_buffed", None)
    card.pop("was_debuffed", None)
    card.pop("last_buff_amount", None)
    card.pop("last_debuff_amount", None)

    # Reset per-phase tracking, not total
    card["mc_loss_this_phase"] = 0


# ---------------------------
# Target normalization utils
# ---------------------------

def _resolve_targets_from_ids_or_dicts(candidates, field, opp_field):
    """Normalize a list of targets which might be dicts or card_id strings into dict targets."""
    out = []
    if not isinstance(candidates, list):
        candidates = [candidates]
    for t in candidates:
        if isinstance(t, dict):
            out.append(t)
        elif isinstance(t, str):
            # find by card_id in either field
            found = next((c for c in field if isinstance(c, dict) and c.get("card_id") == t), None)
            if not found:
                found = next((c for c in opp_field if isinstance(c, dict) and c.get("card_id") == t), None)
            if found:
                out.append(found)
    return out


def _fallback_targets(source_card, target_spec, field, opp_field):
    """
    Basic, safe targeter if targeting.get_targets is unavailable
    or returns something unusable.
    """
    if target_spec in (None, "", "self"):
        return [source_card] if isinstance(source_card, dict) else []
    if target_spec in ("ally", "allies", "all_allies", "friendly", "friendly_all"):
        return list(field)
    if target_spec in ("opponent", "enemy", "opponent_all", "all_enemies"):
        return list(opp_field)
    # could be a list of ids/dicts
    return _resolve_targets_from_ids_or_dicts(target_spec, field, opp_field)


# ---------------------------
# ACTION ENGINE
# ---------------------------

def apply_action(card, action_type, action_value, player_name, log, context=None):
    """
    Hardened, backward-compatible action runner.
    - Keeps legacy signature.
    - Accepts occasional misuse where 'action_type' is a dict (we normalize it).
    - Never assumes targets are dicts; resolves/filters safely.
    """
    # --- Harden context & players ---
    if context is None:
        context = {}

    p_name = (player_name or "Player 1")
    o_name = "Player 2" if p_name == "Player 1" else "Player 1"

    player   = _coerce_player_like(context.get("player"),   p_name)
    opponent = _coerce_player_like(context.get("opponent"), o_name)

    # extra safety: make sure MC trackers exist (handles skinny namespaces)
    if not hasattr(player, "mc_loss_this_phase"):   player.mc_loss_this_phase = 0.0
    if not hasattr(player, "mc_loss_total"):        player.mc_loss_total = 0.0
    if not hasattr(opponent, "mc_loss_this_phase"): opponent.mc_loss_this_phase = 0.0
    if not hasattr(opponent, "mc_loss_total"):      opponent.mc_loss_total = 0.0

    field = context.get("field")
    if not isinstance(field, list):
        field = getattr(player, "field", []) or []
    opp_field = context.get("opponent_field")
    if not isinstance(opp_field, list):
        opp_field = getattr(opponent, "field", []) or []

    # legacy alias used by some old code paths
    opponent_field = opp_field

    context["player"] = player
    context["opponent"] = opponent
    context["field"] = field
    context["opponent_field"] = opp_field

    # Source card / effect
    source_card = card if isinstance(card, dict) else (context.get("source_card") or {})
    effect = context.get("effect") or {}

    # --- Normalize action spec (robust to dict passed in 'action_type') ---
    act_type = None
    act_value = action_value
    target_type = effect.get("target_type")

    if isinstance(action_type, dict):
        act_type = str(action_type.get("type", "")).strip().lower().replace(" ", "_").replace("-", "_")
        if act_value in (None, "") and "value" in action_type:
            act_value = action_type.get("value")
        target_type = action_type.get("target_type", target_type) or action_type.get("target", target_type)
    else:
        act_type = str(action_type or "").strip().lower().replace(" ", "_").replace("-", "_")

    # numeric value (once)
    try:
        val = float(act_value)
    except (TypeError, ValueError):
        val = 0.0

    # no-op guard
    if act_type in ("none", "no_power", "noop") or (act_type in ("add_mc", "subtract_mc") and abs(val) < 1e-12):
        try:
            log.append(f"⏭️ {source_card.get('card_id','?')} does nothing ({act_type}).")
        except Exception:
            pass
        return

    # --- Resolve targets safely (single pass) ---
    targets = list(context.get("targets") or [])
    if not targets:
        resolved = []
        if target_type:
            try:
                resolved = get_targets(
                    target_type,
                    player,
                    opponent,
                    source_card,
                    field,
                    opp_field,
                    effect=effect,
                    context=context,
                    log=log
                ) or []
            except Exception:
                resolved = _fallback_targets(source_card, target_type, field, opp_field)
        else:
            resolved = [source_card] if isinstance(source_card, dict) else []

        targets = _resolve_targets_from_ids_or_dicts(resolved, field, opp_field)

    if not isinstance(targets, list):
        targets = []
    targets = [t for t in targets if isinstance(t, dict)]

    # ---------------------------------
    # Action handlers (use current_mc)
    # ---------------------------------

    # ✅ SELF DAMAGE block (special case via condition)
    if effect and effect.get("condition_type") == "self":
        try:
            self_damage = float(effect.get("condition_value"))
        except Exception:
            self_damage = 0.0
        before = source_card.get("current_mc", 0.0)
        source_card["current_mc"] = before + self_damage
        after = source_card["current_mc"]
        log_event(context, log, "info", f"💢 {source_card['card_id']} self-hits for {self_damage} → {before} → {after}")

    # ✅ Parse value ONCE — except for invert
    invert_value = None
    if act_type == "invert":
        invert_value = act_value
        try:
            value = 0.0
        except Exception:
            value = 0.0
    else:
        try:
            if isinstance(act_value, str):
                clean = act_value.replace("+", "").replace("-", "").replace("/", "").strip()
                value = float(act_value) if clean.replace(".", "", 1).isdigit() else 0.0
            elif isinstance(act_value, (int, float)):
                value = float(act_value)
            else:
                value = 0.0
        except Exception:
            value = 0.0

    print(f"[DEBUG] apply_action: card={source_card.get('card_id','?')}, action_type={act_type}, value={value}, invert_value={invert_value}")

    # ---- INVERT ----
    if act_type == "invert":
        print(f"🟢 [INVERT] {source_card.get('card_id','?')} triggers invert: {invert_value}")
        combined_field = list(field) + list(opponent_field)
        total_checked = 0
        total_inverted = 0

        for c in combined_field:
            if not c or c.get("destroyed"): 
                continue
            if c.get("card_type") != "Project": 
                continue

            total_checked += 1
            base_mc = c.get("base_mc", 0)
            current_mc = c.get("current_mc", base_mc)
            diff = current_mc - base_mc

            if diff == 0:
                continue

            new_mc = max(0, base_mc - diff)
            before = current_mc
            after = new_mc

            # ✅ Track MC change so Buy the Dip sees it
            track_mc_change(
                c,
                before,
                after,
                player=player,
                action_type="subtract_mc" if after < before else "add_mc",
                log=log,
                context=context
            )

            log_event(context, log, "info", f"🔀 Inverting {c['card_id']}: {before:.1f} → {after:.1f}")
            c["current_mc"] = after
            total_inverted += 1

        if total_checked == 0:
            log_event(context, log, "warn", f"⚠️ Invert ran but found no Projects.")
        elif total_inverted == 0:
            log_event(context, log, "warn", f"⚠️ Invert found no buffs/debuffs to invert.")
        return

    # =========================================================================
    # Acties die eerder ontbraken.
    #
    # Een onbekend action_type viel door de hele keten zonder iets te doen. De
    # kaart werd wel als "triggered" gelogd, maar had geen enkel gevolg — precies
    # wat de audit als "dode kaart" aanwees.
    # =========================================================================

    def _levend(cs):
        return [c for c in (cs or []) if isinstance(c, dict) and not c.get("destroyed")]

    def _proj(cs):
        return [c for c in _levend(cs) if c.get("card_type") == "Project"]

    def _zet_mc(target, nieuw, soort):
        before = float(target.get("current_mc", 0.0))
        after = max(0.0, float(nieuw))
        target["current_mc"] = after
        track_mc_change(target, before, after, player=player,
                        action_type=soort, log=log, context=context)
        return before, after

    def _bron_id():
        return (source_card or {}).get("card_id", "???")

    _eigen_proj = _proj(field)
    _vijand_proj = _proj(opp_field)

    if act_type == "remove_mc_percent":
        pct = (value or 0) / 100.0
        doelen = _proj(targets) or _vijand_proj
        for t in doelen:
            voor, na = _zet_mc(t, t.get("current_mc", 0) * (1 - pct), "subtract_mc")
            log_event(context, log, "debuff",
                      f"➖ {_bron_id()} takes {value:.0f}% off {t['card_id']} → {voor:.1f} → {na:.1f}")
        return

    if act_type == "add_mc_per_card_type":
        soorten = {c.get("card_type") for c in _levend(field) if c.get("card_type")}
        bonus = (value or 0) * len(soorten)
        doelen = _proj(targets) or ([source_card] if source_card.get("card_type") == "Project" else [])
        for t in doelen:
            voor, na = _zet_mc(t, t.get("current_mc", 0) + bonus, "add_mc")
            log_event(context, log, "buff",
                      f"➕ {t['card_id']} gains +{bonus:.1f} MC ({len(soorten)} card types) → {voor:.1f} → {na:.1f}")
        return

    if act_type in ("add_mc_lowest", "add_mc_dak", "add_mc_random_two", "add_mc_btd"):
        if act_type == "add_mc_lowest":
            doelen = _proj(targets) or ([min(_eigen_proj, key=lambda c: c.get("current_mc", 0))] if _eigen_proj else [])
        elif act_type == "add_mc_btd":
            doelen = [c for c in _eigen_proj if c.get("_mc_lost_total") or c.get("lost_mc_this_phase")]
        else:
            doelen = _proj(targets)
        if not doelen:
            log_event(context, log, "skip", f"⛔ {_bron_id()} found no target for {act_type}.")
            return
        for t in doelen:
            voor, na = _zet_mc(t, t.get("current_mc", 0) + (value or 0), "add_mc")
            log_event(context, log, "buff",
                      f"➕ {_bron_id()} boosts {t['card_id']} by +{value:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type == "subtract_mc_and_add":
        # "-6 aan alle overgebleven Projects, daarna een bonus voor de bronkaart."
        verlies, bonus = 6.0, 20.0
        m = re.findall(r"[-+]?\d+(?:\.\d+)?", str(act_value or ""))
        if len(m) >= 2:
            verlies, bonus = abs(float(m[0])), abs(float(m[1]))
        for t in _proj(targets) or (_eigen_proj + _vijand_proj):
            if t is source_card:
                continue
            voor, na = _zet_mc(t, t.get("current_mc", 0) - verlies, "subtract_mc")
            log_event(context, log, "debuff",
                      f"➖ {t['card_id']} loses -{verlies:.1f} MC → {voor:.1f} → {na:.1f}")
        if source_card.get("card_type") == "Project":
            voor, na = _zet_mc(source_card, source_card.get("current_mc", 0) + bonus, "add_mc")
            log_event(context, log, "buff",
                      f"➕ {_bron_id()} gains +{bonus:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type == "self_destruct_and_add_mc":
        source_card["destroyed"] = True
        try:
            player.destroyed_cards.append(source_card)
        except Exception:
            pass
        log_event(context, log, "death", f"💥 {_bron_id()} destroys itself")
        for t in _proj(targets):
            if t is source_card:
                continue
            voor, na = _zet_mc(t, t.get("current_mc", 0) + (value or 0), "add_mc")
            log_event(context, log, "buff",
                      f"➕ {t['card_id']} gains +{value:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type == "add_mc_stack":
        # "+2 telkens als een van je Projects MC verliest, tot maximaal +10."
        per, plafond = 2.0, 10.0
        m = re.findall(r"\d+(?:\.\d+)?", str(act_value or ""))
        if m:
            per = float(m[0])
        if len(m) >= 2:
            plafond = float(m[1])
        gedaald = len([c for c in _eigen_proj if c.get("_mc_lost_total") or c.get("lost_mc_this_phase")])
        gestapeld = min(per * gedaald, plafond) - float(source_card.get("_stack_gegeven", 0))
        if gestapeld <= 0:
            log_event(context, log, "skip", f"⛔ {_bron_id()} has nothing to stack yet.")
            return
        source_card["_stack_gegeven"] = float(source_card.get("_stack_gegeven", 0)) + gestapeld
        voor, na = _zet_mc(source_card, source_card.get("current_mc", 0) + gestapeld, "add_mc")
        log_event(context, log, "buff",
                  f"➕ {_bron_id()} stacks +{gestapeld:.1f} MC ({gedaald} Projects lost MC) → {voor:.1f} → {na:.1f}")
        return

    if act_type in ("destroy_and_gain", "destroy_and_steal"):
        doelen = _proj(targets) or _vijand_proj
        if not doelen:
            log_event(context, log, "skip", f"⛔ {_bron_id()} found no enemy Project.")
            return
        buit = 0.0
        for t in doelen:
            buit += float(t.get("current_mc", 0)) if act_type == "destroy_and_steal" else 0.0
            t["destroyed"] = True
            t["current_mc"] = 0
            try:
                opponent.destroyed_cards.append(t)
            except Exception:
                pass
            log_event(context, log, "death", f"💥 {_bron_id()} destroys {t['card_id']}")
        winst = buit if act_type == "destroy_and_steal" else float(value or 0)
        if winst and source_card.get("card_type") == "Project":
            voor, na = _zet_mc(source_card, source_card.get("current_mc", 0) + winst, "add_mc")
            log_event(context, log, "buff",
                      f"➕ {_bron_id()} gains +{winst:.1f} MC → {voor:.1f} → {na:.1f}")
        elif winst:
            begunstigde = max(_eigen_proj, key=lambda c: c.get("current_mc", 0)) if _eigen_proj else None
            if begunstigde:
                voor, na = _zet_mc(begunstigde, begunstigde.get("current_mc", 0) + winst, "add_mc")
                log_event(context, log, "buff",
                          f"➕ {begunstigde['card_id']} gains +{winst:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type == "caw_r2_effect":
        # "Buff twee willekeurige vijandelijke Projects met +7, daarna jezelf met +14."
        vijanden = [t for t in _proj(targets) if t is not source_card] or _vijand_proj[:2]
        for t in vijanden[:2]:
            voor, na = _zet_mc(t, t.get("current_mc", 0) + (value or 0), "add_mc")
            log_event(context, log, "buff",
                      f"➕ {_bron_id()} boosts enemy {t['card_id']} by +{value:.1f} MC → {voor:.1f} → {na:.1f}")
        eigen = (value or 0) * 2
        voor, na = _zet_mc(source_card, source_card.get("current_mc", 0) + eigen, "add_mc")
        log_event(context, log, "buff",
                  f"➕ {_bron_id()} boosts itself by +{eigen:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type in ("steal_mc_caw_e2", "steal_and_give_to_lowest"):
        doelen = _proj(targets) or _vijand_proj
        if not doelen:
            log_event(context, log, "skip", f"⛔ {_bron_id()} found no enemy Project to steal from.")
            return
        buit = 0.0
        for t in doelen:
            pak = min(float(value or 0), float(t.get("current_mc", 0)))
            if pak <= 0:
                continue
            voor, na = _zet_mc(t, t.get("current_mc", 0) - pak, "steal_mc")
            buit += pak
            log_event(context, log, "debuff",
                      f"💰 {_bron_id()} steals {pak:.1f} MC from {t['card_id']} → {voor:.1f} → {na:.1f}")
        if buit <= 0:
            return
        if act_type == "steal_and_give_to_lowest":
            ontvanger = min(_eigen_proj, key=lambda c: c.get("current_mc", 0)) if _eigen_proj else None
        else:
            ontvanger = source_card if source_card.get("card_type") == "Project" else None
        if ontvanger:
            voor, na = _zet_mc(ontvanger, ontvanger.get("current_mc", 0) + buit, "add_mc")
            log_event(context, log, "buff",
                      f"➕ {ontvanger['card_id']} receives +{buit:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type == "base_mc_of_lowest":
        if len(_eigen_proj) < 2:
            log_event(context, log, "skip", f"⛔ {_bron_id()} needs two Projects.")
            return
        laagste = min(_eigen_proj, key=lambda c: c.get("current_mc", 0))
        hoogste = max(_eigen_proj, key=lambda c: c.get("current_mc", 0))
        bonus = float(laagste.get("base_mc", 0))
        voor, na = _zet_mc(hoogste, hoogste.get("current_mc", 0) + bonus, "add_mc")
        log_event(context, log, "buff",
                  f"➕ {_bron_id()} copies {laagste['card_id']}'s base {bonus:.1f} MC onto "
                  f"{hoogste['card_id']} → {voor:.1f} → {na:.1f}")
        return

    if act_type == "subtract_and_opponent_buff":
        eigen = _proj(targets) or ([min(_eigen_proj, key=lambda c: c.get("current_mc", 0))] if _eigen_proj else [])
        for t in eigen[:1]:
            voor, na = _zet_mc(t, t.get("current_mc", 0) - (value or 0), "subtract_mc")
            log_event(context, log, "debuff",
                      f"➖ {t['card_id']} loses -{value:.1f} MC → {voor:.1f} → {na:.1f}")
        if _vijand_proj:
            begunstigde = random.choice(_vijand_proj)
            voor, na = _zet_mc(begunstigde, begunstigde.get("current_mc", 0) + (value or 0), "add_mc")
            log_event(context, log, "buff",
                      f"➕ enemy {begunstigde['card_id']} gains +{value:.1f} MC → {voor:.1f} → {na:.1f}")
        return

    if act_type == "multi_action":
        subs = act_value if isinstance(act_value, list) else []
        if not subs:
            log_event(context, log, "skip", f"⛔ {_bron_id()} has no sub-actions.")
            return
        for sub in subs:
            if not isinstance(sub, dict) or sub.get("action_type") == "multi_action":
                continue
            try:
                sub_doelen = get_targets(sub.get("target_type"), player, opponent, source_card,
                                         field, opp_field, effect=sub, context=dict(context), log=log)
            except Exception:
                sub_doelen = []
            sub_ctx = dict(context)
            sub_ctx["targets"] = sub_doelen
            sub_ctx["effect"] = sub
            apply_action(source_card, sub.get("action_type"), sub.get("action_value"),
                         getattr(player, "name", player_name), log, sub_ctx)
        return

    if act_type == "redirect":
        # "Leid effecten die op je hoogste Project mikken om." De bestemming is
        # het doel van dit effect: bij Wolfswap_R3 de kaart zelf, bij
        # Wolfswap_Founder_R1 het laagste eigen Project. Het omleiden zelf
        # gebeurt aan het eind van get_targets, waar élke doelkeuze langskomt.
        bestemming = (_proj(targets) or ([source_card] if source_card.get("card_type") == "Project" else []))
        if not bestemming:
            log_event(context, log, "skip", f"⛔ {_bron_id()} found no redirect destination.")
            return
        doel = bestemming[0]
        doel["_redirect_doel"] = True
        # "de eerste" versus "alle": Founder_R1 spreekt over de eerste keer.
        doel["_redirect_eenmalig"] = "first" in str(effect.get("condition_value") or "").lower() \
            or "Founder" in _bron_id()
        log_event(context, log, "immune",
                  f"🛡️ Effects aimed at the highest Project are redirected to {doel['card_id']}")
        return

    if act_type in ("reflect", "reflect_and_amplify"):
        if act_type == "reflect_and_amplify":
            setattr(player, "_reflect_debuff_factor", float(value or 2) or 2.0)
            log_event(context, log, "immune",
                      f"🛡️ {_bron_id()} will reflect the first debuff back, amplified")
        else:
            setattr(player, "_reflect_destruction", True)
            log_event(context, log, "immune",
                      f"🛡️ {_bron_id()} will reflect the first destruction back at the attacker")
        return

    if act_type == "prevent_destruction":
        # "Beschermt je laagste MC Project één keer tegen vernietiging."
        doelen = _proj(targets)
        if not doelen and _eigen_proj:
            doelen = [min(_eigen_proj, key=lambda c: c.get("current_mc", 0))]
        for t in doelen[:1]:
            t["_destroy_shield"] = int(t.get("_destroy_shield", 0)) + 1
            log_event(context, log, "immune",
                      f"🛡️ {t['card_id']} is protected from destruction once")
        return

    if act_type == "override_mc_value":
        # "Telt als de hoogste MC-kaart voor vernietiging."
        doelen = _proj(targets) or ([source_card] if source_card.get("card_type") == "Project" else [])
        for t in doelen:
            t["_counts_as_highest"] = True
            log_event(context, log, "immune",
                      f"🛡️ {t['card_id']} counts as the highest MC card for targeting")
        return

    # --- passieve effecten: een vlag zetten die elders wordt nageleefd -------
    if act_type in ("limit_loss", "reduce_debuff_percentage"):
        doelen = _proj(targets) or ([source_card] if source_card.get("card_type") == "Project" else _eigen_proj[:1])
        for t in doelen:
            if act_type == "limit_loss":
                t["_max_total_loss"] = float(value or 0)
                log_event(context, log, "immune",
                          f"🛡️ {t['card_id']} cannot lose more than {value:.0f} MC this match")
            else:
                t["_debuff_reduction"] = max(0.0, min(1.0, float(value or 0) / 100.0))
                log_event(context, log, "immune",
                          f"🛡️ {t['card_id']}'s first debuff is reduced by {value:.0f}%")
        return

    # ---- ADD_MC ----
    if act_type == "add_mc":
        try:
            amount = float(act_value)
        except Exception as e:
            log_event(context, log, "warn", f"⚠️ Failed to parse add_mc value '{act_value}': {e}")
            return

        source_id = source_card.get("card_id", "???") if source_card else "???"

        if not targets:
            log_event(context, log, "warn", f"⚠️ {source_id} found no targets for add_mc.")
            return

        for target in targets:
            if not target or target.get("destroyed", False):
                continue
            if target.get("card_type") != "Project":
                log_event(context, log, "skip", f"🚫 Skipping add_mc: {target.get('card_id','???')} is not a Project")
                continue

            before = target.get("current_mc", 0.0)
            after = before + amount
            target["current_mc"] = after

            # Centralized tracking
            track_mc_change(
                target,
                before,
                after,
                player=player,
                action_type="add_mc",
                log=log,
                context=context
            )

            owner = target.get("owner", "Unknown")
            card_id = target.get("card_id", "???")

            if effect and effect.get("condition_type") == "count_rarity_in_deck":
                log_event(
                    context, log, "rng",
                    f"{source_id} randomly boosts {owner}’s {card_id} by +{amount:.1f} MC "
                    f"→ {before:.1f} → {after:.1f}",
                    card=target
                )
            else:
                log_event(
                    context, log, "buff",
                    f"{source_id} boosts {owner}’s {card_id} by +{amount:.1f} MC "
                    f"→ {before:.1f} → {after:.1f}",
                    card=target
                )
        return

    # ---- NEGATE ----
    if act_type == "negate":
        # Deze tak logde alleen dat er iets genegeerd werd, zonder iets te doen.
        # Beide kaarten die hem gebruiken zijn spelerbrede schilden:
        #   Lionel_Founder_E1 — "negeer de eerste vernietigingspoging op je Projects"
        #   Clove_Founder_E1  — "de eerste debuff die je Projects raakt wordt genegeerd"
        # Eén schild voor de hele kant, dus alle eigen Projects delen hetzelfde
        # telletje: wie als eerste geraakt wordt verbruikt het voor iedereen.
        soort = str((effect or {}).get("condition_type") or "").lower()
        eigen = _proj(field)
        if not eigen:
            log_event(context, log, "skip", f"⛔ {_bron_id()} has no Projects to shield.")
            return
        schild = {"over": max(1, int(value or 1))}
        if "destr" in soort:
            for c in eigen:
                c["_gedeeld_sloopschild"] = schild
            log_event(context, log, "immune",
                      f"🛡️ {_bron_id()} negates the first destruction attempt on your Projects",
                      source_card)
        else:
            for c in eigen:
                c["_gedeeld_debuffschild"] = schild
            log_event(context, log, "immune",
                      f"🛡️ {_bron_id()} negates the first debuff that hits your Projects",
                      source_card)
        return

    # ---- NO POWER ----
    if act_type in ("none", "no_power"):
        log_event(
            context, log, "skip",
            f"🐷 {source_card.get('card_id','?')} has no power. It oinks proudly and does nothing.",
            source_card
        )
        return

    # ---- NEGATE & DESTROY SELF ----
    if act_type == "negate_and_destroy_self":
        destroy_card(card, log, player, opponent)
        return  # nothing else to do here

    # ---- DOUBLE_MC ----
    if act_type == "double_mc":
        for target in targets:
            if not target or target.get("destroyed", False):
                continue
            if target.get("card_type") != "Project":
                log_event(
                    context, log, "skip",
                    f"Skipping double_mc: {target.get('card_id', '???')} is not a Project",
                    card=target
                )
                continue

            before = target.get("current_mc", 0)
            after = before * 2
            target["current_mc"] = after

            track_mc_change(
                target,
                before,
                after,
                player=player,
                action_type="add_mc",  # doubling counts as a buff
                log=log,
                context=context
            )

            owner = target.get("owner", "Unknown")
            card_id = target.get("card_id", "???")
            source_id = source_card.get("card_id", "???")

            # Special log for All Time High second effect
            if effect and "second" in str(effect.get("target_type", "")):
                log_event(
                    context, log, "buff",
                    f"[2nd Effect] {source_id} doubles {owner}’s {card_id} → {before:.1f} → {after:.1f}",
                    card=target
                )
            else:
                log_event(
                    context, log, "buff",
                    f"{source_id} doubles {owner}’s {card_id} → {before:.1f} → {after:.1f}",
                    card=target
                )
        return

    # ---- RESET BUFFS/DEBUFFS ----
    if act_type == "reset_buffs_debuffs":
        print(f"[DEBUG] 🧪 Protocol Reset triggered — clearing buffs/debuffs for both players")

        reset_logs = []

        for pl in [player, opponent]:
            for project in getattr(pl, "field", []) + getattr(pl, "supports", []):
                if project.get("card_type") != "Project" or project.get("destroyed", False):
                    continue

                before = project.get("current_mc", project.get("base_mc", 0))
                base_mc = project.get("base_mc", 0)

                # Hard reset to base
                project["current_mc"] = base_mc

                # Clear flags
                project["was_buffed"] = False
                project["was_debuffed"] = False
                project["last_buff_amount"] = 0
                project["last_debuff_amount"] = 0

                after = project["current_mc"]
                print(f"[DEBUG] {project['card_id']} reset → {before:.1f} → {after:.1f}")

                if before != after:
                    reset_logs.append(f"↳ 🔹 {project['card_id']} reset: {before:.1f} → {after:.1f}")

            if hasattr(pl, "update_total_mc"):
                pl.update_total_mc()

        details = "🔄 Protocol Reset applied: all buffs/debuffs cleared."
        if reset_logs:
            details += "\n" + "\n".join(reset_logs)

        log_event(context, log, "info", details)
        return

    # ---- NEGATE AND REFLECT ----
    if act_type == "negate_and_reflect":
        print(f"[ACTION] Negate and reflect triggered by {source_card.get('card_id')}")
        reflected = getattr(player, "first_debuff_data", None)

        if not reflected:
            log_event(context, log, "skip",
                      f"{source_card.get('card_id')} found no debuff effect to reflect.",
                      card=card)
            return

        reflected_effect = reflected.get("effect") or {}
        origin_card = reflected.get("source_card")
        original_target = reflected.get("target")

        if not origin_card or not reflected_effect:
            log_event(context, log, "skip",
                      f"No debuff effect to reflect from {source_card.get('card_id')}",
                      card=card)
            return

        # Prevent reflect loops
        if reflected_effect.get("action_type") == "negate_and_reflect" or context.get("is_reflected"):
            log_event(context, log, "skip",
                      f"{source_card.get('card_id')} prevented reflection loop from {origin_card.get('card_id')}",
                      card=card)
            return

        action_type_reflect = reflected_effect.get("action_type")
        try:
            action_value_reflect = float(reflected_effect.get("action_value", 0))
        except (TypeError, ValueError):
            action_value_reflect = 0.0

        # Negate the first hit on our side (simple numeric debuffs)
        if action_type_reflect in ("subtract_mc", "steal_mc") and isinstance(original_target, dict):
            before = original_target.get("current_mc", 0)
            snap = getattr(player, "original_mc_snapshot", {})
            snapshot_mc = snap.get(original_target.get("card_id"), before)
            restore_amount = (snapshot_mc - before) + action_value_reflect
            if restore_amount > 0:
                original_target["current_mc"] = before + restore_amount
            after = original_target.get("current_mc", before)
            log_event(
                context, log, "buff",
                f"{source_card.get('card_id')} negates first debuff → {original_target.get('card_id')} {before:.1f} → {after:.1f}",
                card=original_target
            )
        else:
            log_event(
                context, log, "immune",
                f"{source_card.get('card_id')} blocked the first debuff ({action_type_reflect}); reflecting it back.",
                card=card
            )

        setattr(player, "first_debuff_blocked", True)
        setattr(player, "first_debuff_data", None)

        log_event(
            context, log, "trigger",
            f"{source_card.get('card_id')} reflects debuff back at {origin_card.get('card_id')}!",
            card=card
        )

        apply_action(
            card,
            action_type_reflect,
            action_value_reflect,
            player.name,
            log,
            context={
                "source_card": card,
                "effect": reflected_effect,
                "targets": [origin_card],
                "player": player,
                "opponent": opponent,
                "field": player.field,
                "opponent_field": opponent.field,
                "is_reflected": True
            }
        )
        return

    # ---- REFLECT_FIRST_DEBUFF ----
    if act_type == "reflect_first_debuff":
        if hasattr(player, "first_debuff_data") and player.first_debuff_data and not player.first_debuff_blocked:
            original_effect = player.first_debuff_data["effect"]
            source_card0 = player.first_debuff_data["source_card"]
            original_target = player.first_debuff_data.get("target")
            origin_player = player.first_debuff_data["player"]  # Who originally cast it
            action_type0 = original_effect.get("action_type")
            action_value0 = original_effect.get("action_value")

            targets0 = get_targets(
                original_effect.get("target_type"),
                origin_player,
                player,
                source_card0,
                self_deck=origin_player.field,
                opponent_deck=player.field,
                effect=original_effect
            )

            for t in targets0:
                ctx0 = {
                    "source_card": source_card0,
                    "effect": original_effect,
                    "field": origin_player.field,
                    "player": origin_player,
                    "opponent": player,
                    "opponent_field": player.field,
                    "targets": [t],
                    "is_reflected": True
                }

                apply_action(
                    source_card0,
                    action_type0,
                    action_value0,
                    origin_player.name,
                    log,
                    ctx0
                )

            player.first_debuff_blocked = True

            log_event(
                context,
                log,
                "trigger",
                f"reflected debuff from {source_card0['card_id']} "
                f"({action_type0}: {action_value0}) — originally hit {original_target['card_id']}, now hits back!",
                card=card
            )
        else:
            log_event(
                context,
                log,
                "skip",
                f"{source_card.get('card_id','?')} tried to reflect debuff but no valid target found.",
                card=card
            )
        return

    # ---- DESTROY_COMMON_AND_GAIN_MC ----
    if act_type == "destroy_common_and_gain_mc":
        commons = [
            c for c in player.field
            if c.get("card_type") == "Project"
            and c.get("rarity", "").lower() == "common"
            and not c.get("destroyed", False)
        ]
        if commons:
            chosen = random.choice(commons)
            chosen["_destroyed_mc_snapshot"] = chosen.get("current_mc", 0)
            chosen["destroyed"] = True

            if not getattr(player, "first_friendly_destroyed", False):
                player.first_friendly_destroyed = True
                log_event(context, log, "immune", f"First friendly Project destroyed for {player.name}")

            if hasattr(player, "destroyed_cards"):
                player.destroyed_cards.append(chosen)

            log_event(context, log, "destroy",
                      f"{source_card.get('card_id','?')} destroys own Common Project {chosen['card_id']}",
                      card=card)

            before = source_card.get("current_mc", 0)
            after = before + value
            source_card["current_mc"] = after

            track_mc_change(
                source_card,
                before,
                after,
                player=player,
                action_type="add_mc",
                log=log,
                context=context
            )

            log_event(
                context, log, "buff",
                f"{source_card.get('card_id','?')} gains +{value} MC → {before:.1f} → {after:.1f}",
                card=card
            )
        else:
            log_event(context, log, "skip",
                      f"No Common Project found to destroy for {source_card.get('card_id','?')}",
                      card=card)
        return

    # ---- SWAP_MC (two selected targets) ----
    if act_type == "swap_mc":
        if isinstance(targets, list) and len(targets) == 2:
            t1, t2 = targets
            t1_mc_before = t1.get("current_mc", 0)
            t2_mc_before = t2.get("current_mc", 0)

            t1["current_mc"], t2["current_mc"] = t2_mc_before, t1_mc_before

            track_mc_change(
                t1,
                t1_mc_before,
                t1["current_mc"],
                player=player,
                action_type="subtract_mc" if t1["current_mc"] < t1_mc_before else "add_mc",
                log=log,
                context=context
            )
            track_mc_change(
                t2,
                t2_mc_before,
                t2["current_mc"],
                player=player if t2.get("owner") == player.name else opponent,
                action_type="subtract_mc" if t2["current_mc"] < t2_mc_before else "add_mc",
                log=log,
                context=context
            )

            log_event(
                context, log, "info",
                f"🔄 Swapped MC: {t1['card_id']} ({t1_mc_before:.1f} → {t1['current_mc']:.1f}), "
                f"{t2['card_id']} ({t2_mc_before:.1f} → {t2['current_mc']:.1f})"
            )
        else:
            log_event(context, log, "warn", "swap_mc failed: Expected 2 targets.")
        return

    # ---- SWAP (highest enemy with lowest own) ----
    if act_type == "swap":
        highest_enemy = max(
            [c for c in opponent.field if c.get("card_type") == "Project" and not c.get("destroyed")],
            key=lambda c: c.get("current_mc", 0),
            default=None
        )
        lowest_own = min(
            [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")],
            key=lambda c: c.get("current_mc", 0),
            default=None
        )

        if highest_enemy and lowest_own:
            own_before, enemy_before = lowest_own["current_mc"], highest_enemy["current_mc"]

            lowest_own["current_mc"], highest_enemy["current_mc"] = enemy_before, own_before

            track_mc_change(
                lowest_own,
                own_before,
                lowest_own["current_mc"],
                player=player,
                action_type="subtract_mc" if lowest_own["current_mc"] < own_before else "add_mc",
                log=log,
                context=context
            )
            track_mc_change(
                highest_enemy,
                enemy_before,
                highest_enemy["current_mc"],
                player=opponent,
                action_type="subtract_mc" if highest_enemy["current_mc"] < enemy_before else "add_mc",
                log=log,
                context=context
            )

            log_event(
                context, log, "phase",
                f"🔄 {source_card.get('card_id','?')} swaps {lowest_own['card_id']} ({own_before:.1f} → {lowest_own['current_mc']:.1f}) "
                f"with {highest_enemy['card_id']} ({enemy_before:.1f} → {highest_enemy['current_mc']:.1f})"
            )
        else:
            log_event(context, log, "warn",
                      f"⚠️ {source_card.get('card_id','?')} could not find valid targets to swap MC.")
        return

    # ---- DESTROY_MAYBE ----
    if act_type == "destroy_maybe":
        try:
            chance = int(str(act_value).strip("%"))
        except Exception as e:
            log_event(context, log, "warn", f"⚠️ Failed to parse destroy_maybe chance '{act_value}': {e}")
            return

        roll = random.randint(1, 100)

        if roll <= chance:
            log_event(context, log, "rng",
                      f"🎲 {source_card.get('card_id','?')} rolled {roll} (<= {chance}) — Effect triggers!")

            targets2 = targets or []
            destroyed_any = False

            for t in targets2:
                if not isinstance(t, dict):
                    log_event(context, log, "warn", f"⚠️ Invalid target in destroy_maybe: {t}")
                    continue

                if t.get("destroyed"):
                    continue  # already destroyed

                if t.get("card_type") != "Project":
                    log_event(context, log, "skip",
                              f"🚫 Skipping destroy_maybe: {t.get('card_id', '???')} is not a Project")
                    continue

                if t.get("immune_debuff", False):
                    log_event(context, log, "immune",
                              f"🛡️ {t['card_id']} resisted a debuff (immune).")
                    continue

                if maybe_block_first_debuff(t, source_card, effect, context, log):
                    log_event(context, log, "immune",
                              f"First-debuff shield negated destroy on {t.get('card_id')}", card=t)
                    continue

                destroy_card(
                    t,
                    log,
                    player=context.get("player"),
                    opponent=context.get("opponent"),
                    source=source_card,
                    context=context
                )
                t["destroyed"] = True
                destroyed_any = True

            if not destroyed_any:
                log_event(context, log, "warn",
                          f"⚠️ {source_card.get('card_id','?')} had no valid targets to destroy.")
        else:
            log_event(context, log, "rng",
                      f"🎲 {source_card.get('card_id','?')} rolled {roll} (> {chance}) — Effect does not trigger.")
        return

    # ---- SELF_DAMAGE (explicit action) ----
    if act_type == "self_damage":
        try:
            damage = float(act_value)  # typically negative
        except Exception as e:
            log_event(context, log, "warn", f"⚠️ Failed to parse self_damage value '{act_value}': {e}")
            return

        if not source_card or source_card.get("card_type") != "Project":
            log_event(context, log, "skip", f"🚫 Skipping self_damage: source is not a Project card")
            return

        before = source_card.get("current_mc", 0.0)
        after = max(0.0, before + damage)        # clamp at 0 just in case
        source_card["current_mc"] = after

        change = after - before                   # negative for damage

        if change < 0:
            source_card["was_debuffed"] = True
            source_card["last_debuff_amount"] = abs(change)

            ensure_btd_tracking(
                source_card,
                abs(change),   # ensure positive for the tracker
                player=player,
                context=context,
                log=log,
                match_state=context.get("match_state")
            )

        log_event(context, log, "info",
                  f"💢 {source_card.get('owner','Unknown')}’s {source_card.get('card_id','???')} "
                  f"takes {damage:.1f} MC self-damage → {before:.1f} → {after:.1f}")
        return

    # ---- DISABLE EFFECTS / CARD ----
    if act_type == "disable_effects":
        source_card["effects_disabled"] = True
        log_event(context, log, "skip",
                  f"🚫 {player_name}’s {source_card.get('card_id','?')} effects are disabled.")
        return

    if act_type == "disable_card":
        for target in targets:
            if not target or target.get("destroyed", False):
                continue

            if target.get("card_type") != "Support":
                log_event(context, log, "skip",
                          f"🚫 Skipping disable_card: {target.get('card_id', '???')} is not a Support")
                continue

            target["disabled"] = True
            card_id = target.get("card_id", "???")
            owner = target.get("owner", "Unknown")
            source_id = source_card.get("card_id", "???") if source_card else "???"

            log_event(context, log, "skip",
                      f"⛔ {source_id} disables {owner}’s Support {card_id} for the rest of the match!")
        return

    # ---- DESTROY ----
    if act_type == "destroy":
        destroyed_cards = []

        if not targets:
            log_event(
                context, log, "warn",
                f"⚠️ destroy called with empty targets for {source_card.get('card_id','???')} (action skipped)"
            )
            return

        for target in targets:
            if not isinstance(target, dict):
                log_event(context, log, "warn", f"⚠️ Invalid destroy target: {target}")
                continue
            if target.get("destroyed", False):
                log_event(context, log, "warn",
                          f"⚠️ Skipping destroy: {target.get('card_id','???')} already destroyed")
                continue
            if target.get("card_type") != "Project":
                log_event(context, log, "skip",
                          f"🚫 Skipping destroy: {target.get('card_id','???')} is not a Project")
                continue

            if target.get("immune_debuff", False):
                log_event(context, log, "immune",
                          f"🛡️ {target['card_id']} resisted a debuff (immune).")
                continue

            if maybe_block_first_debuff(target, source_card, effect, context, log):
                log_event(context, log, "immune",
                          f"First-debuff shield negated destroy on {target.get('card_id')}", card=target)
                continue

            destroy_card(
                target,
                log,
                player=player,
                opponent=opponent,
                source=source_card,
                context=context
            )
            destroyed_cards.append(target)

            if opponent and target.get("owner") == getattr(opponent, "name", None):
                if not getattr(opponent, "first_friendly_destroyed", False):
                    opponent.first_friendly_destroyed = True
                    log_event(context, log, "immune",
                              f"🛡️ First friendly Project destroyed for {opponent.name}")

        if destroyed_cards:
            context["last_destroyed"] = destroyed_cards[-1]
            setattr(player, "last_destroyed", destroyed_cards[-1])
        return

    # ---- WOLFSWAP E1 DESTROY ----
    if act_type == "wolfswap_e1_destroy":
        if not source_card or source_card.get("card_id") != "COC_Wolfswap_E1":
            log_event(context, log, "warn",
                      "⚠️ wolfswap_e1_destroy invoked without COC_Wolfswap_E1 as source; skipping")
            return

        candidates = [
            c for c in opponent.field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("rarity") == "Epic"
        ]

        _apply_wolfswap_e1_penalty = False

        if not candidates:
            log_event(context, log, "info",
                      "🔍 wolfswap_e1_destroy: no Epic enemy targets found (no action)")
            _apply_wolfswap_e1_penalty = True
        else:
            target = random.choice(candidates)

            if target.get("immune_debuff", False):
                log_event(context, log, "immune",
                          f"🛡️ {target['card_id']} resisted a debuff (immune).")
                _apply_wolfswap_e1_penalty = True
            elif maybe_block_first_debuff(target, source_card, effect, context, log):
                log_event(context, log, "immune",
                          f"First-debuff shield negated destroy on {target.get('card_id')}", card=target)
                _apply_wolfswap_e1_penalty = True
            else:
                destroy_card(
                    target,
                    log,
                    player=player,
                    opponent=opponent,
                    source=source_card,
                    context=context
                )

                if opponent and target.get("owner") == getattr(opponent, "name", None):
                    if not getattr(opponent, "first_friendly_destroyed", False):
                        opponent.first_friendly_destroyed = True
                        log_event(context, log, "immune",
                                  f"🛡️ First friendly Project destroyed for {opponent.name}")

                _apply_wolfswap_e1_penalty = True

        if _apply_wolfswap_e1_penalty:
            try:
                before = source_card.get("current_mc", 0.0)
                source_card["current_mc"] = before - 10.0
                loss_amount = 10.0
                source_card["was_debuffed"] = True
                source_card["lost_mc_this_phase"] = source_card.get("lost_mc_this_phase", 0.0) + loss_amount

                ensure_btd_tracking(
                    source_card,
                    loss_amount,
                    player=player,
                    context=context,
                    log=log,
                    match_state=context.get("match_state")
                )

                log_event(
                    context, log, "info",
                    f"💢 {source_card.get('card_id')} takes -10.0 MC self-damage → {before:.1f} → {source_card['current_mc']:.1f}",
                    card=source_card
                )
            except Exception as e:
                log_event(context, log, "warn", f"⚠️ wolfswap_e1_destroy penalty error: {e}", card=source_card)
        return

    # ---- WOLFSWAP M1 DESTROY (two lowest enemy) ----
    if act_type == "wolfswap_M1_destroy":
        destroyed_cards = []

        phase = str(effect.get("phase", "")).lower()
        flag_key = f"{source_card.get('card_id','?')}_{phase}_resolved"
        if context.get(flag_key, False):
            log_event(context, log, "warn",
                      f"⚠️ {source_card.get('card_id','?')} already resolved in {phase}, skipping duplicate trigger")
            return
        context[flag_key] = True

        targets2 = get_targets(
            "wolfswap_M1_lowest_two", player, opponent,
            source_card, player.field, opponent.field, effect,
            context=context, log=log
        )

        if not targets2:
            log_event(context, log, "warn",
                      f"⚠️ {source_card.get('card_id','?')} had no valid wolfswap_M1_lowest_two targets")
            return

        for target in targets2:
            if not target or target.get("destroyed", False):
                continue

            destroy_card(
                target,
                log,
                player=player,
                opponent=opponent,
                source=source_card,
                context=context
            )
            destroyed_cards.append(target)

            log_event(
                context, log, "btd",
                f"[BTD DEBUG] {target['card_id']} destroyed by wolfswap — excluded from Buy the Dip boosts.",
                card=target
            )

            if target.get("owner") == opponent.name and not getattr(opponent, "first_friendly_destroyed", False):
                opponent.first_friendly_destroyed = True
                log_event(context, log, "immune", f"🛡️ First friendly Project destroyed for {opponent.name}")

        if destroyed_cards:
            context["last_destroyed"] = destroyed_cards[-1]
            player.last_destroyed = destroyed_cards[-1]
        return

    # ---- COPY_EFFECT ----
    if act_type == "copy_effect":
        candidate_cards = [
            c for c in opponent.field + getattr(opponent, "supports", [])
            if "parsed_power" in c and c.get("card_id") != source_card.get("card_id")
        ]
        if not candidate_cards:
            log_event(context, log, "warn",
                      f"⚠️ No valid cards to copy for {source_card.get('card_id', '???')}")
            return

        copied_from = random.choice(candidate_cards)
        copied_effects = copied_from.get("parsed_power", [])

        for eff in copied_effects:
            import copy as _copy
            new_effect = _copy.deepcopy(eff)
            new_effect["source_card"] = source_card.get("card_id")
            new_effect["copied_from"] = copied_from.get("card_id")
            if new_effect.get("target_type") in [None, "", "default"]:
                new_effect["target_type"] = "self"

            if "copied_effects" not in source_card:
                source_card["copied_effects"] = []
            source_card["copied_effects"].append(new_effect)

            log_event(context, log, "info",
                      f"🌀 {source_card['card_id']} copies effect from {copied_from['card_id']}")
        return

    # ---- COPY_BASE_MC_THEN_LOSE ----
    if act_type == "copy_base_mc_then_lose":
        enemy_projects = [
            c for c in opponent.field
            if c.get("card_type") == "Project" and not c.get("destroyed")
        ]
        if not enemy_projects:
            log_event(context, log, "info",
                      f"❌ No valid enemy Project to copy MC from for {source_card.get('card_id','?')}")
            return

        highest = max(enemy_projects, key=lambda c: c.get("base_mc", 0))
        base_to_copy = highest.get("base_mc", 0)

        before = source_card.get("current_mc", 0)
        source_card["current_mc"] = base_to_copy
        log_event(context, log, "swap",
                  f"🔁 {source_card.get('card_id','?')} copies base MC from enemy {highest['card_id']} "
                  f"→ {before:.1f} → {base_to_copy:.1f}")

        try:
            loss = float(act_value)
        except Exception as e:
            log_event(context, log, "warn",
                      f"⚠️ Failed to parse copy_base_mc_then_lose value '{act_value}': {e}")
            loss = 0.0

        after_loss = source_card["current_mc"] - loss
        source_card["current_mc"] = after_loss

        owner = source_card.get("owner", "Unknown")

        if loss > 0:
            source_card["was_debuffed"] = True
            source_card["last_debuff_amount"] = loss

            if player and owner == player.name:
                if not hasattr(player, "mc_loss_this_phase"): player.mc_loss_this_phase = 0.0
                if not hasattr(player, "mc_loss_total"):      player.mc_loss_total = 0.0
                player.mc_loss_this_phase += loss
                player.mc_loss_total      += loss

        log_event(
            context, log, "debuff",
            f"➖ {source_card.get('card_id','?')} loses {loss} MC immediately → {base_to_copy:.1f} → {after_loss:.1f}",
            source_card
        )
        return

    elif action_type == "seismic_rebalance":
        for t in targets:
            if not t or t.get("destroyed", False):
                continue
            if t.get("card_type") != "Project":
                log_event(context, log, "skip", f"🚫 Skipping seismic_rebalance: {t.get('card_id', '???')} is not a Project")
                continue

            before = t["current_mc"]
            after = before

            if before > 30:
                t["current_mc"] -= 5
                after = t["current_mc"]
                t["was_debuffed"] = True
                t["last_debuff_amount"] = 5

                if player and t.get("owner") == player.name:
                    player.mc_loss_this_phase += 5
                    player.mc_loss_total += 5

                # ✅ Centralized Buy the Dip tracking
                ensure_btd_tracking(
                    card=t,
                    loss_amount=5,
                    player=player,
                    context=context,
                    log=log,
                    match_state=context.get("match_state")
                )

                log_event(
                    context, log, "debuff", 
                    f"➖ {t['card_id']} loses -5 MC (Seismic Rebalance) → {before:.1f} → {after:.1f}"
                )

            elif before < 15:  # ✅ Buff condition
                t["current_mc"] += 5
                after = t["current_mc"]
                t["was_buffed"] = True
                t["last_buff_amount"] = 5

                log_event(
                    context, log, "buff", 
                    f"➕ {t['card_id']} gains +5 MC (Seismic Rebalance) → {before:.1f} → {after:.1f}"
                )


    elif act_type == "rug_pull":
        # 1️⃣ Find all enemy Projects still alive
        enemy_projects = [
            c for c in opponent_field
            if c.get("card_type") == "Project" and not c.get("destroyed")
        ]
        if not enemy_projects:
            log_event(context, log, "warn", f"⚠️ {source_card['card_id']} could not find enemy Project to rug pull.")
            return

        # 2️⃣ Pick one victim at random
        victim = random.choice(enemy_projects)
        victim_mc = victim.get("current_mc", victim.get("base_mc", 0))

        # 3️⃣ Destroy that victim and snapshot its MC
        victim["_destroyed_mc_snapshot"] = victim_mc
        victim["destroyed"] = True
        log_event(
            context, log, "destroy",
            f"💥 {source_card['card_id']} destroys {victim['card_id']} (Rug Pull)",
            victim
        )

        if opponent and hasattr(opponent, "destroyed_cards"):
            opponent.destroyed_cards.append(victim)

        # 4️⃣ If the victim is Mythical → destroy 2 extra + steal 50% MC
        if victim.get("rarity", "").lower() == "mythical":
            # Destroy 2 extra
            extras = [c for c in enemy_projects if not c.get("destroyed")]
            for extra in random.sample(extras, min(2, len(extras))):
                extra["_destroyed_mc_snapshot"] = extra.get("current_mc", extra.get("base_mc", 0))
                extra["destroyed"] = True
                log_event(
                    context, log, "destroy",
                    f"💥 {source_card['card_id']} destroys extra {extra['card_id']} (Mythical chain)",
                    extra
                )
                if opponent and hasattr(opponent, "destroyed_cards"):
                    opponent.destroyed_cards.append(extra)

            # ✅ Steal 50% MC
            stolen = victim_mc * 0.5

            # Track MC loss for opponent (Buy the Dip synergy)
            if opponent:
                opponent.mc_loss_this_phase = getattr(opponent, "mc_loss_this_phase", 0.0) + stolen
                opponent.mc_loss_total = getattr(opponent, "mc_loss_total", 0.0) + stolen

            # Give it to the lowest MC friendly Project
            friendly_projects = [
                c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")
            ]
            if not friendly_projects:
                log_event(
                    context, log, "warn",
                    f"⚠️ {source_card['card_id']} found no friendly Project to receive Rug Pull MC.",
                    source_card
                )
                return

            lowest = min(friendly_projects, key=lambda x: x.get("current_mc", 0))
            before = lowest["current_mc"]
            lowest["current_mc"] = before + stolen
            after = lowest["current_mc"]

            # ✅ Track buff on the lowest project
            lowest["was_buffed"] = True
            lowest["last_buff_amount"] = stolen

            log_event(
                context, log, "steal",
                f"💰 {source_card['card_id']} steals {stolen:.1f} MC → {lowest['card_id']} → {before:.1f} → {after:.1f}",
                source_card
            )

    elif act_type == "mc_extremes":
        affected = 0
        for project in player.field:
            if project.get("card_type") != "Project" or project.get("destroyed"):
                continue
            mc = project.get("current_mc", 0)
            print(f"[DEBUG] Market Correction checking {project['card_id']} MC={mc}")

            if mc >= 40:
                before = mc
                project["current_mc"] = before - 3
                after = project["current_mc"]

                # ✅ Debuff tracking
                project["was_debuffed"] = True
                project["last_debuff_amount"] = 3

                log_event(
                    context, log, "debuff",
                    f"➖ {player_name}’s {project['card_id']} loses -3 MC → {before:.1f} → {after:.1f}",
                    project
                )
                affected += 1

            elif mc <= 10:
                before = mc
                project["current_mc"] = before + 2
                after = project["current_mc"]

                # ✅ Buff tracking
                project["was_buffed"] = True
                project["last_buff_amount"] = 2

                log_event(
                    context, log, "buff",
                    f"➕ {player_name}’s {project['card_id']} gains +2 MC → {before:.1f} → {after:.1f}",
                    project
                )
                affected += 1

        if affected == 0:
            log_event(
                context, log, "info",
                f"⚖️ {player_name}’s Market Correction triggered but no Projects were adjusted."
            )

    elif act_type == "steal_half_mc":
        last_destroyed = context.get("last_destroyed")

        if not last_destroyed:
            log_event(
                context, log, "info",
                f"⚠️ {source_card['card_id']} tried to steal but found no destroyed card snapshot."
            )
            return

        # ✅ Use snapshot, not live current_mc!
        stolen_mc = float(last_destroyed.get("_destroyed_mc_snapshot", 0)) * 0.5
        if stolen_mc <= 0:
            log_event(
                context, log, "info",
                f"⚠️ {source_card['card_id']} tried to steal but destroyed card had 0 MC."
            )
            return

        friendly_projects = [
            c for c in field
            if c.get("card_type") == "Project" and not c.get("destroyed", False)
        ]
        if not friendly_projects:
            log_event(
                context, log, "info",
                f"⚠️ {source_card['card_id']} found no valid friendly Project to receive stolen MC."
            )
            return

        lowest = min(friendly_projects, key=lambda x: x.get("current_mc", 0))
        before = lowest.get("current_mc", 0)
        lowest["current_mc"] = before + stolen_mc
        after = lowest["current_mc"]

        # ✅ Track buff
        lowest["was_buffed"] = True
        lowest["last_buff_amount"] = stolen_mc

        log_event(
            context, log, "action",
            f"💰 {source_card['card_id']} steals 50% of {last_destroyed['card_id']}’s MC ({stolen_mc:.1f}) → "
            f"{lowest['card_id']} → {before:.1f} → {after:.1f}"
        )

    elif act_type == "immune_destruction":
        if not targets:
            # safety fallback: shield the lowest friendly if targeting failed
            candidates = [c for c in player.field if c.get("card_type") == "Project" and not c.get("destroyed")]
            targets = [min(candidates, key=lambda x: x.get("current_mc", 0))] if candidates else []

        for t in targets:
            t["immune_destruction"] = True
            log_event(context, log, "info",
                      f"🛡️ {t['owner']}’s {t['card_id']} becomes immune to destruction this match.", t)

    elif act_type == "adjust_mc":
        values = str(action_value).split("/")
        if len(values) != len(targets):
            log_event(
                context, log, "info",
                f"⛔ {source_card.get('card_id', '???')} skipped — mismatch: {len(values)} values vs {len(targets)} targets."
            )
            return

        for t, raw in zip(targets, values):
            try:
                delta = float(raw)
                before = t.get("current_mc", 0)
                t["current_mc"] = before + delta
                track_mc_change(
                    t, before, t["current_mc"],
                    player=player, action_type="adjust_mc", log=log, context=context
                )
            except Exception as e:
                log_event(
                    context, log, "error",
                    f"❌ {source_card.get('card_id', '???')} failed adjust_mc on {t.get('card_id', '?')} → {e}"
                )

    elif act_type == "double_buff":
        own_projects = [
            c for c in field
            if c.get("card_type") == "Project"
            and not c.get("destroyed", False)
            and c.get("was_buffed", False)
        ]
        if not own_projects:
            log_event(
                context, log, "warn",
                f"⚠️ {source_card['card_id']} tried to double a buff, but no buffed Projects found."
            )
            return

        target = max(own_projects, key=lambda x: x.get("last_buff_amount", 0))
        buff_to_double = target.get("last_buff_amount", 0)
        if buff_to_double <= 0:
            log_event(
                context, log, "warn",
                f"⚠️ {source_card['card_id']} found no positive buff to double on {target['card_id']}."
            )
            return

        before = target["current_mc"]
        target["current_mc"] = before + buff_to_double
        after = target["current_mc"]

        target["last_buff_amount"] = target.get("last_buff_amount", 0) + buff_to_double
        target["was_buffed"] = True

        owner = target.get("owner", player_name)
        log_event(
            context, log, "buff",
            f"✨ {source_card['card_id']} doubles the buff on {owner}’s {target['card_id']} "
            f"(+{buff_to_double:.1f}) → {before:.1f} → {after:.1f}"
        )

    elif act_type == "add_mc_per_card":
        if not player or not opponent:
            log_event(context, log, "info", f"❌ Failed: {card['card_id']} — player or opponent not defined for add_mc_per_card")
            return

        count = 0
        condition = (effect.get("condition_value") or "").lower()
        condition_type = (effect.get("condition_type") or "").lower()

        all_cards = player.field + opponent.field
        for c in all_cards:
            if c is card:
                continue
            if condition_type == "count_tag":
                tags = [t.lower() for t in c.get("tags", [])]
                if condition in tags:
                    count += 1
            elif condition_type == "count_card_type":
                if c.get("card_type", "").lower() == condition:
                    count += 1
            elif condition_type == "count_rarity":
                if c.get("rarity", "").lower() == condition:
                    count += 1

        try:
            per_card_value = float(action_value)
        except Exception:
            per_card_value = 0.0

        total = count * per_card_value
        before = card.get("current_mc", 0)
        card["current_mc"] = before + total
        after = card["current_mc"]

        if total > 0:
            card["was_buffed"] = True
            card["last_buff_amount"] = total
        else:
            card["was_buffed"] = False
            card["last_buff_amount"] = 0

        source_id = source_card.get("card_id", "???") if source_card else "???"
        log_event(
            context, log, "buff",
            f"🧮 {source_id} boosts {player_name}’s {card['card_id']} by +{total:.1f} MC "
            f"({count} matches × {per_card_value}) → {before:.1f} → {after:.1f}"
        )

    elif act_type == "explode_random_projects":
        log_event(context, log, "info", f"🐛 DEBUG: explode_random_projects triggered. Effect: {effect}")
        try:
            chance = float(effect.get("condition_value", 0.1))
        except Exception:
            chance = 0.1

        if random.random() < chance:
            all_projects = [
                c for c in field + opponent_field
                if c.get("card_type") == "Project" and not c.get("destroyed")
            ]
            if not all_projects:
                log_event(
                    context, log, "warn",
                    f"💣 {source_card.get('card_id') if source_card else '???'} tried to explode, but no valid targets."
                )
                return

            destroyed = random.sample(all_projects, min(int(value), len(all_projects)))
            for d in destroyed:
                destroy_card(d, log, player=player, opponent=opponent, source=source_card, context=context)
                log_event(
                    context, log, "destroy",
                    f"💥 {source_card.get('card_id') if source_card else '???'} explodes! {d.get('card_id', '???')} is destroyed!"
                )
        else:
            log_event(
                context, log, "rng",
                f"😮 {source_card['card_id']} did **not** explode ({int(chance * 100)}% chance)"
            )

    elif act_type == "add_or_subtract_mc":
        # Parse "+A/-B" or single numeric
        gain_val = lose_val = 0.0
        if isinstance(action_value, str) and "/" in action_value:
            try:
                clean = action_value.replace(" ", "")
                plus, minus = clean.split("/", 1)
                gain_val = float(plus.replace("+", ""))
                lose_val = float(minus.replace("-", ""))
            except Exception as e:
                log_event(context, log, "warn", f"⚠️ Failed to parse add_or_subtract_mc '{action_value}': {e}")
                gain_val = lose_val = 0.0
        elif isinstance(action_value, (int, float)):
            gain_val = float(action_value)
            lose_val = 0.0

        if card.get("card_type") != "Project":
            log_event(context, log, "skip",
                      f"🚫 Skipping add_or_subtract_mc: {card.get('card_id','???')} is not a Project")
            return

        owner = card.get("owner", "Unknown")
        card_id = card.get("card_id", "???")
        before = card.get("current_mc", 0.0)

        if random.random() < 0.5:
            after = max(0.0, before + gain_val)
            card["current_mc"] = after
            if (after - before) > 0:
                card["was_buffed"] = True
                card["last_buff_amount"] = (after - before)
            log_event(
                context, log, "rng",
                f"🎲 {owner}’s {card_id} won the flip! Gains +{gain_val:.1f} "
                f"→ {before:.1f} → {after:.1f}"
            )
        else:
            raw_after = before - lose_val
            after = max(0.0, raw_after)
            card["current_mc"] = after
            actual_loss = before - after
            if actual_loss > 0:
                card["was_debuffed"] = True
                card["last_debuff_amount"] = actual_loss
                ensure_btd_tracking(
                    card, actual_loss,
                    player=player, context=context, log=log,
                    match_state=context.get("match_state")
                )
            log_event(
                context, log, "rng",
                f"🎲 {owner}’s {card_id} lost the flip! Loses -{lose_val:.1f} "
                f"→ {before:.1f} → {after:.1f}"
            )

    elif act_type == "subtract_mc":
        try:
            amount = float(value)
        except Exception as e:
            log_event(context, log, "warn", f"⚠️ Failed to parse subtract_mc value '{value}': {e}")
            return

        source_id = source_card.get("card_id", "???") if source_card else "???"
        if not targets:
            log_event(context, log, "warn", f"⚠️ {source_id} found no targets for subtract_mc.")
            return

        for target in targets:
            if not target or target.get("destroyed"):
                continue
            if target.get("card_type") != "Project":
                log_event(context, log, "skip",
                          f"🚫 Skipping subtract_mc: {target.get('card_id','???')} is not a Project")
                continue

            if target.get("immune_debuff", False):
                log_event(context, log, "immune",
                          f"🛡️ {target['card_id']} resisted a debuff (immune).")
                continue

            # First-debuff shield?
            if maybe_block_first_debuff(target, source_card, effect, context, log):
                log_event(context, log, "immune",
                          f"First-debuff shield negated subtract_mc on {target.get('card_id','???')}",
                          card=target)
                continue

            before = target.get("current_mc", 0.0)
            raw_after = before - amount
            after = max(0.0, raw_after)
            target["current_mc"] = after

            actual_loss = max(0.0, before - after)
            if actual_loss > 0:
                target["was_debuffed"] = True
                target["last_debuff_amount"] = actual_loss
                ensure_btd_tracking(
                    target, actual_loss,
                    player=owner_player_of(target, player, opponent),
                    context=context, log=log,
                    match_state=(context or {}).get("match_state")
                )

            owner = target.get("owner", "Unknown")
            card_id = target.get("card_id", "???")
            log_event(
                context, log, "debuff",
                f"{source_id} reduces {owner}’s {card_id} by -{amount:.1f} MC "
                f"→ {before:.1f} → {after:.1f}",
                card=target
            )
        return

    elif act_type == "subtract_mc_liq_crisis":
        try:
            amount = float(action_value)
        except Exception as e:
            log_event(context, log, "warn", f"⚠️ Failed to parse subtract_mc_liq_crisis value '{action_value}': {e}")
            amount = 0.0

        emoji = "➖"
        for target in targets:
            if not target or target.get("destroyed"):
                continue
            if target.get("card_type") != "Project":
                log_event(context, log, "skip",
                          f"🚫 Skipping subtract_mc_liq_crisis: {target.get('card_id','???')} is not a Project")
                continue

            if target.get("immune_debuff", False):
                log_event(context, log, "immune", f"🛡️ {target['card_id']} resisted a debuff (immune).")
                continue

            if maybe_block_first_debuff(target, source_card, effect, context, log):
                log_event(context, log, "immune",
                          f"First-debuff shield negated subtract_mc_liq_crisis on {target.get('card_id')}",
                          card=target)
                continue

            current_mc = target.get("current_mc", 0.0)
            if 15 <= current_mc <= 30:
                before = current_mc
                target["current_mc"] = before - amount
                after = target["current_mc"]

                if amount > 0:
                    target["was_debuffed"] = True
                    target["last_debuff_amount"] = amount
                    ensure_btd_tracking(
                        target, amount,
                        player=player, context=context, log=log,
                        match_state=context.get("match_state")
                    )

                owner = target.get("owner", "Unknown")
                card_id = target.get("card_id", "???")
                source_id = source_card.get("card_id", "???") if source_card else "???"

                log_event(context, log, "info",
                          f"{emoji} {source_id} reduces {owner}’s {card_id} by -{amount:.1f} MC "
                          f"(Liquidity Crisis) → {before:.1f} → {after:.1f}")
            else:
                log_event(context, log, "info",
                          f"⚖️ {source_card.get('card_id','???')} skips {target.get('card_id','???')} "
                          f"(MC {current_mc} not in 15–30 range)")

    elif act_type == "arm_first_debuff_negate_other_projects":
        arm_first_debuff_sentinel(context, player, card, mode="negate", scope="other_projects", log=log)

    elif act_type == "assign_mc":
        if isinstance(action_value, str) and "+" in action_value and "-" in action_value:
            try:
                plus_val, minus_val = action_value.replace(" ", "").split("/")
                plus_val = float(plus_val.replace("+", ""))
                minus_val = float(minus_val.replace("-", ""))
            except Exception:
                plus_val = minus_val = 0.0
        else:
            plus_val = minus_val = 0.0

        if isinstance(card, tuple) and len(card) == 2:
            card1, card2 = card

            before1 = card1.get("current_mc", 0)
            card1["current_mc"] = before1 + plus_val
            after1 = card1["current_mc"]
            if plus_val > 0:
                card1["was_buffed"] = True
                card1["last_buff_amount"] = plus_val

            before2 = card2.get("current_mc", 0)
            card2["current_mc"] = before2 - minus_val
            after2 = card2["current_mc"]

            if minus_val > 0:
                card2["was_debuffed"] = True
                card2["last_debuff_amount"] = minus_val
                ensure_btd_tracking(
                    card2, minus_val,
                    player=player, context=context, log=log,
                    match_state=context.get("match_state")
                )

            log_event(context, log, "info",
                      f"⚖️ {player_name}’s {card1['card_id']} +{plus_val} MC → {before1:.1f} → {after1:.1f}")
            log_event(context, log, "info",
                      f"⚖️ {player_name}’s {card2['card_id']} -{minus_val} MC → {before2:.1f} → {after2:.1f}")
        else:
            log_event(context, log, "warn", f"⚠️ assign_mc failed — invalid target format.")

    elif act_type == "assign_mc_split":
        # Expect formats like "+5/-5" or a single number (treat as +X/0)
        plus_val = minus_val = 0.0
        if isinstance(action_value, str) and "/" in action_value:
            try:
                clean = action_value.replace(" ", "")
                a, b = clean.split("/", 1)
                plus_val = float(a)
                minus_val = float(b)
            except Exception as e:
                log_event(context, log, "warn",
                          f"⚠️ assign_mc_split failed — invalid value '{action_value}': {e}")
                return
        elif isinstance(action_value, (int, float)):
            plus_val = float(action_value)
            minus_val = 0.0
        else:
            log_event(context, log, "warn",
                      f"⚠️ assign_mc_split failed — invalid value type: {type(action_value).__name__}")
            return

        if not isinstance(targets, list) or len(targets) != 2:
            log_event(context, log, "warn",
                      f"⚠️ assign_mc_split failed — expected 2 targets, got: {targets}")
            return

        card1, card2 = targets
        if card1 is card2:
            log_event(context, log, "skip",
                      "⚠️ assign_mc_split skipped — both targets are the same card")
            return

        # Buff target (card1)
        if card1 and not card1.get("destroyed", False) and card1.get("card_type") == "Project":
            before1 = card1.get("current_mc", 0.0)
            after1 = max(0.0, before1 + plus_val)
            card1["current_mc"] = after1
            if (after1 - before1) > 0:
                card1["was_buffed"] = True
                card1["last_buff_amount"] = (after1 - before1)
            log_event(
                context, log, "info",
                f"⚖️ {player_name}’s {card1.get('card_id','???')} +{plus_val:.1f} MC → {before1:.1f} → {after1:.1f}",
                card=card1
            )
        else:
            log_event(context, log, "skip",
                      f"🚫 Skipping buff side: invalid target {card1}")

        # Debuff target (card2)
        if card2 and not card2.get("destroyed", False) and card2.get("card_type") == "Project":
            before2 = card2.get("current_mc", 0.0)
            if card2.get("immune_debuff", False) and minus_val > 0:
                log_event(context, log, "immune",
                          f"🛡️ {card2.get('card_id','???')} resisted a debuff (immune).")
                after2 = before2
            else:
                after2 = max(0.0, before2 - minus_val)
                card2["current_mc"] = after2
                if (before2 - after2) > 0:
                    card2["was_debuffed"] = True
                    card2["last_debuff_amount"] = (before2 - after2)
                    ensure_btd_tracking(
                        card2, (before2 - after2),
                        player=player, context=context, log=log,
                        match_state=(context or {}).get("match_state")
                    )
            log_event(
                context, log, "info",
                f"⚖️ {player_name}’s {card2.get('card_id','???')} -{minus_val:.1f} MC → {before2:.1f} → {after2:.1f}",
                card=card2
            )
        else:
            log_event(context, log, "skip",
                      f"🚫 Skipping debuff side: invalid target {card2}")
        return

    elif act_type == "destroy_and_add_mc":
        # Twee verschillende kaartteksten delen deze actienaam:
        #
        #   COC_DAK_R1           offer je eigen laagste Project op om je hoogste
        #                        te versterken — levert twee doelwitten aan
        #   COC_DAK_M1           vernietig een vijandelijk Project en pak zelf de
        #   COC_DAK_Founder_M1   MC — leveren er via random_enemy maar een aan
        #
        # De tweede vorm viel stil op de lengtecontrole hieronder, waardoor beide
        # kaarten wel "triggered" logden maar niets deden. Daarom eerst uitsplitsen
        # op het doelwittype in plaats van op het aantal doelwitten.
        group = context.get("group")

        if str(target_type or "").strip().lower() != "own_lowest_and_highest":
            slachtoffers = [t for t in targets
                            if t.get("card_type") == "Project" and not t.get("destroyed")]
            if not slachtoffers:
                group and group.add("skip", "no living enemy Project to destroy")
                return

            victim = slachtoffers[0]
            destroy_card(victim, log, player=player, opponent=opponent,
                         source=source_card, context=context)

            # "gain +X MC" gaat naar de bron als dat een Project is (COC_DAK_M1).
            # Founders hebben base_mc 0 en tellen niet mee voor de eindstand, dus
            # daar zou de MC verdampen; die gaat naar je sterkste Project.
            if source_card.get("card_type") == "Project" and not source_card.get("destroyed"):
                ontvanger = source_card
            else:
                eigen = _proj(field)
                ontvanger = max(eigen, key=lambda c: c.get("current_mc", 0.0)) if eigen else None

            if ontvanger is None:
                group and group.add("skip", "no surviving Project to receive the MC")
                return

            voor, na = _zet_mc(ontvanger, ontvanger.get("current_mc", 0.0) + (value or 0.0), "add_mc")
            if (value or 0) > 0:
                ontvanger["was_buffed"] = True
                ontvanger["last_buff_amount"] = value
            group and group.add(
                "buff",
                f"{ontvanger['card_id']} gains +{value:.1f} MC → {voor:.1f} → {na:.1f}"
            )
            return

        targets2 = list(targets)
        if len(targets2) < 2:
            group and group.add("skip", "needs lowest and highest targets")
            return

        lowest, highest = targets2[0], targets2[1]

        # 1) Destroy your own lowest project
        destroy_card(
            lowest, log,
            player=context["player"], opponent=context["opponent"],
            source=card, context=context
        )

        # 2) Add MC to your highest project (if it’s still alive)
        try:
            add_val = float(action_value)
        except Exception:
            add_val = 0.0

        if not highest.get("destroyed", False):
            before = highest.get("current_mc", 0)
            highest["current_mc"] = before + add_val
            if add_val > 0:
                highest["was_buffed"] = True
                highest["last_buff_amount"] = add_val
            group and group.add(
                "buff",
                f"{highest['card_id']} gains +{add_val:.1f} MC → {before:.1f} → {highest['current_mc']:.1f}"
            )
        else:
            group and group.add("skip",
                                f"highest target {highest['card_id']} was destroyed; no buff applied")

    elif act_type == "destroy_enemy_or_self":
        roll = random.random()
        if roll < 0.75:
            valid = [
                c for c in opponent.field
                if c.get("card_type") == "Project" and not c.get("destroyed")
            ]
            if valid:
                victim = random.choice(valid)
                destroy_card(victim, log, player=player, opponent=opponent, source=source_card, context=context)
                log_event(
                    context, log, "destroy",
                    f"💥 {source_card['card_id']} destroys enemy {victim['card_id']} (75% branch)"
                )
            else:
                log_event(
                    context, log, "warn",
                    f"⚠️ {source_card['card_id']} tried to destroy enemy but none found."
                )
        else:
            valid = [
                c for c in player.field
                if c.get("card_type") == "Project" and not c.get("destroyed")
            ]
            if len(valid) >= 2:
                victims = random.sample(valid, 2)
                for v in victims:
                    destroy_card(v, log, player=player, opponent=opponent, source=source_card, context=context)
                    log_event(
                        context, log, "destroy",
                        f"💥 {source_card['card_id']} destroys own {v['card_id']} (25% branch)"
                    )
            else:
                log_event(
                    context, log, "warn",
                    f"⚠️ {source_card['card_id']} tried to destroy 2 own Projects but not enough found."
                )

    elif act_type == "destroy_and_gain_mc":
        for target in targets:
            if not target or not isinstance(target, dict):
                continue
            if target.get("card_type") == "Project" and not target.get("destroyed", False):
                try:
                    destroy_card(target, log, player=player, opponent=opponent, source=source_card, context=context)

                    if target.get("owner") == opponent.name:
                        if not getattr(opponent, "first_friendly_destroyed", False):
                            opponent.first_friendly_destroyed = True
                            log_event(context, log, "immune",
                                      f"🛡️ First friendly Project destroyed for {opponent.name}")

                    valid_projects = [
                        c for c in player.field
                        if c.get("card_type") == "Project" and not c.get("destroyed", False)
                    ]
                    if not valid_projects:
                        log_event(context, log, "warn", f"⚠️ {player.name} has no valid Project to gain MC.")
                        continue

                    highest = max(valid_projects, key=lambda c: c.get("current_mc", 0))
                    gain = float(action_value or 0)
                    before = highest.get("current_mc", 0)
                    highest["current_mc"] = before + gain

                    if "track_mc_change" in globals():
                        track_mc_change(
                            highest, before, highest["current_mc"],
                            player=player, action_type="destroy_and_gain_mc",
                            context=context, log=log
                        )

                    log_event(
                        context, log, "buff",
                        f"📈 ➕ {player.name} gains +{gain:.1f} MC for the destruction "
                        f"({highest['card_id']} → {before:.1f} → {highest['current_mc']:.1f})"
                    )
                except Exception as e:
                    log_event(context, log, "info", f"❌ Error in destroy_and_gain_mc: {e}")

    elif act_type == "destroy_common_and_gain_mc":
        commons = [
            c for c in player.field
            if c.get("rarity", "").lower() == "common"
            and c.get("card_type") == "Project"
            and not c.get("destroyed", False)
        ]
        if commons:
            card_to_destroy = commons[0]
            card_to_destroy["_destroyed_mc_snapshot"] = card_to_destroy.get("current_mc", 0)
            card_to_destroy["destroyed"] = True

            if not getattr(player, "first_friendly_destroyed", False):
                player.first_friendly_destroyed = True
                log_event(context, log, "immune", f"🛡️ First friendly Project destroyed for {player.name}")

            source_id = source_card.get("card_id", "???") if source_card else "???"
            log_event(context, log, "destroy",
                      f"💥 {player.name}'s {card_to_destroy['card_id']} (Common) destroyed by {source_id}")

            try:
                gain = float(action_value)
            except Exception:
                gain = 0.0

            before = card.get("current_mc", card.get("base_mc", 0))
            card["current_mc"] = before + gain
            after = card["current_mc"]

            if after > before:
                card["was_buffed"] = True
                card["last_buff_amount"] = after - before

            log_event(
                context, log, "buff",
                f"➕ {player.name}’s {card['card_id']} gains +{gain:.1f} MC "
                f"→ {before:.1f} → {after:.1f}"
            )
        else:
            source_id = source_card.get("card_id", "???") if source_card else "???"
            log_event(context, log, "warn", f"⚠️ No Common Project found to destroy for {source_id}")

    elif act_type == "add_mc_split":
        if isinstance(action_value, str) and "+" in action_value and "-" in action_value:
            try:
                plus_val, minus_val = action_value.replace(" ", "").split("/")
                plus_val = float(plus_val.replace("+", ""))
                minus_val = float(minus_val.replace("-", ""))
            except Exception:
                plus_val = minus_val = 0.0
        else:
            plus_val = minus_val = 0.0

        machines = [
            c for c in field
            if "Machine" in c.get("tags", []) and not c.get("destroyed")
        ]

        for c in machines:
            before = c.get("current_mc", 0)
            c["current_mc"] = before + plus_val
            after = c["current_mc"]
            if plus_val > 0:
                c["was_buffed"] = True
                c["last_buff_amount"] = plus_val
            log_event(
                context, log, "buff",
                f"➕ {player_name}’s {c['card_id']} (Machine) gains +{plus_val:.1f} MC "
                f"→ {before:.1f} → {after:.1f}"
            )

        before = card.get("current_mc", 0)
        card["current_mc"] = before - minus_val
        after = card["current_mc"]

        if minus_val > 0:
            card["was_debuffed"] = True
            card["last_debuff_amount"] = minus_val
            if player and card.get("owner") == player.name:
                player.mc_loss_this_phase += minus_val
                player.mc_loss_total += minus_val
            ensure_btd_tracking(
                card, minus_val,
                player=player, context=context, log=log,
                match_state=context.get("match_state")
            )

        log_event(
            context, log, "debuff",
            f"➖ {player_name}’s {card['card_id']} loses -{minus_val:.1f} MC "
            f"→ {before:.1f} → {after:.1f}"
        )

    elif act_type == "triple_mc":
        for target in context.get("targets", []):
            if target.get("card_type") == "Project" and not target.get("destroyed"):
                before = target.get("current_mc", 0)
                after = before * 3
                target["current_mc"] = after
                if after > before:
                    target["was_buffed"] = True
                    target["last_buff_amount"] = after - before
                log_event(
                    context, log, "buff",
                    f"✨ {card['card_id']} triples {player_name}’s {target['card_id']} "
                    f"→ {before:.1f} → {after:.1f}"
                )

    elif act_type == "reflect_debuff":
        card["reflect_debuff"] = True
        log_event(context, log, "reflect",
                  f"🪞 {player_name}’s {card['card_id']} will reflect the next debuff effect that hits it.")

    elif act_type == "add_mc_and_prevent_debuff":
        try:
            v = float(action_value)
        except Exception:
            v = 0.0
        before = card.get("current_mc", 0)
        after = before + v
        card["current_mc"] = after
        card["immune_debuff"] = True
        if after > before:
            card["was_buffed"] = True
            card["last_buff_amount"] = after - before
        log_event(
            context, log, "info",
            f"🟢 {player_name}’s {card['card_id']} gains +{v:.1f} MC and becomes immune to debuffs "
            f"→ {before:.1f} → {after:.1f}"
        )

    elif act_type == "add_mc_per_rarity":
        rarity = (effect.get("condition_value") or "").strip().lower()
        count = 0
        for target in targets:
            if (
                target.get("card_type") == "Project"
                and not target.get("destroyed", False)
                and target.get("rarity", "").lower() == rarity
            ):
                before = target.get("current_mc", 0)
                after = before + value
                target["current_mc"] = after
                if after > before:
                    target["was_buffed"] = True
                    target["last_buff_amount"] = after - before
                log_event(
                    context, log, "buff",
                    f"🏅 {source_card['card_id']} boosts {player.name}’s {target['card_id']} "
                    f"by +{value:.1f} MC → {before:.1f} → {after:.1f}"
                )
                count += 1
        if count == 0:
            log_event(context, log, "buff",
                      f"🏅 {source_card['card_id']} found no valid {rarity.title()} Projects to boost.")

    elif act_type == "double_effect_next_phase":
        card["double_effect"] = True
        log_event(context, log, "buff",
                  f"♻️ {player_name}’s {card['card_id']} will double its next effect.")

    elif act_type == "gain_mc_if_destroyed":
        try:
            v = float(action_value)
        except Exception:
            v = 0.0
        card["gain_mc_if_destroyed"] = v
        card["_pending_buff_gain"] = v
        log_event(
            context, log, "destroy",
            f"💣 {player_name}’s {card['card_id']} is marked to gain +{v} MC if destroyed later."
        )

    elif act_type == "prevent_debuff":
        for target in targets or []:
            if not target or target.get("destroyed"):
                continue
            target["immune_debuff"] = True
            log_event(context, log, "immune",
                      f"🛡️ {player.name}’s {target['card_id']} is now immune to debuff effects.")

    elif act_type == "steal_mc":
        steal_amount = float(value) if value is not None else 0.0

        def _owner_player_of(card_obj):
            if not card_obj:
                return None
            if player and card_obj.get("owner") == player.name:
                return player
            if opponent and card_obj.get("owner") == opponent.name:
                return opponent
            return None

        if (effect.get("condition_type") or "") == "enemy_highest_mc":
            enemy_projects = [c for c in opponent_field
                              if c.get("card_type") == "Project" and not c.get("destroyed")]
            if not enemy_projects:
                log_event(context, log, "warn",
                          f"⚠️ {source_card.get('card_id','???')} could not find enemy Project to steal from.")
                return

            highest = max(enemy_projects, key=lambda x: x.get("current_mc", 0.0))
            highest["targeted_by_debuff"] = True
            track_first_debuff(
                highest, source_card, effect,
                victim_player=_owner_player_of(highest), log=log
            )

            if highest.get("immune_debuff", False) or maybe_block_first_debuff(highest, source_card, effect, context, log):
                log_event(context, log, "immune",
                          f"🛡️ {highest.get('card_id')} resisted/negated a debuff.", card=highest)
                return

            before_enemy = float(highest.get("current_mc", 0.0))
            before_self = float(source_card.get("current_mc", 0.0))
            actual = min(steal_amount, max(0.0, before_enemy))
            highest["current_mc"] = max(0.0, before_enemy - actual)
            source_card["current_mc"] = before_self + actual

            after_enemy = highest["current_mc"]
            after_self = source_card["current_mc"]

            if actual > 0:
                highest["was_debuffed"] = True
                highest["last_debuff_amount"] = actual
                source_card["was_buffed"] = True
                source_card["last_buff_amount"] = actual
                # ✅ pass POSITIVE loss
                ensure_btd_tracking(
                    highest, actual,
                    player=_owner_player_of(highest), context=context, log=log,
                    match_state=context.get("match_state")
                )

            log_event(
                context, log, "steal",
                f"💰 {source_card.get('card_id','???')} steals {actual:.1f} MC from "
                f"{highest.get('card_id','???')} → {before_enemy:.1f} → {after_enemy:.1f} "
                f"& gains → {before_self:.1f} → {after_self:.1f}"
            )

        else:
            if not targets:
                log_event(context, log, "warn",
                          f"⚠️ {source_card.get('card_id','???')} found no valid targets for steal_mc.")
                return

            for target in targets:
                if not target or target.get("destroyed"):
                    continue

                target["targeted_by_debuff"] = True
                track_first_debuff(
                    target, source_card, effect,
                    victim_player=_owner_player_of(target), log=log
                )

                if target.get("immune_debuff", False) or maybe_block_first_debuff(target, source_card, effect, context, log):
                    log_event(context, log, "immune",
                              f"🛡️ {target.get('card_id')} resisted/negated a debuff.", card=target)
                    continue

                before_target = float(target.get("current_mc", 0.0))
                before_self = float(source_card.get("current_mc", 0.0))
                actual = min(steal_amount, max(0.0, before_target))

                target["current_mc"] = max(0.0, before_target - actual)
                source_card["current_mc"] = before_self + actual

                after_target = target["current_mc"]
                after_self = source_card["current_mc"]

                if actual > 0:
                    target["was_debuffed"] = True
                    target["last_debuff_amount"] = actual
                    source_card["was_buffed"] = True
                    source_card["last_buff_amount"] = actual
                    # ✅ POSITIVE loss
                    ensure_btd_tracking(
                        target, actual,
                        player=_owner_player_of(target), context=context, log=log,
                        match_state=context.get("match_state")
                    )

                log_event(
                    context, log, "steal",
                    f"💰 {source_card.get('card_id','???')} steals {actual:.1f} MC from "
                    f"{target.get('card_id','???')} → {before_target:.1f} → {after_target:.1f} "
                    f"& gains → {before_self:.1f} → {after_self:.1f}"
                )

    elif act_type == "random_double_or_destroy":
        print(f"[DEBUG] Whale Games effect running from {source_card.get('card_id')}")
        own_projects = [c for c in field if c.get("card_type") == "Project" and not c.get("destroyed")]
        enemy_projects = [c for c in opponent_field if c.get("card_type") == "Project" and not c.get("destroyed")]

        if not own_projects or not enemy_projects:
            log_event(context, log, "warn", f"⚠️ {source_card['card_id']} tried Whale Games but one side has no Projects.")
            return

        own_target = random.choice(own_projects)
        enemy_target = random.choice(enemy_projects)

        if random.random() < 0.5:
            before = own_target["current_mc"]
            own_target["current_mc"] = before * 2
            after = own_target["current_mc"]
            own_target["was_buffed"] = True
            own_target["last_buff_amount"] = after - before
            log_event(
                context, log, "rng",
                f"🐳 {source_card['card_id']} doubles {player.name}’s {own_target['card_id']} MC → {before:.1f} → {after:.1f}"
            )

            enemy_target["_destroyed_mc_snapshot"] = enemy_target.get("current_mc", 0)
            enemy_target["destroyed"] = True
            if hasattr(opponent, "destroyed_cards"):
                opponent.destroyed_cards.append(enemy_target)
            log_event(context, log, "destroy",
                      f"💥 {source_card['card_id']} destroys {opponent.name}’s {enemy_target['card_id']}")

            if not getattr(opponent, "first_friendly_destroyed", False):
                opponent.first_friendly_destroyed = True
                log_event(context, log, "immune", f"🛡️ First friendly Project destroyed for {opponent.name}")
        else:
            before = enemy_target["current_mc"]
            enemy_target["current_mc"] = before * 2
            after = enemy_target["current_mc"]
            enemy_target["was_buffed"] = True
            enemy_target["last_buff_amount"] = after - before
            log_event(
                context, log, "rng",
                f"🐳 {source_card['card_id']} doubles {opponent.name}’s {enemy_target['card_id']} MC → {before:.1f} → {after:.1f}"
            )

            own_target["_destroyed_mc_snapshot"] = own_target.get("current_mc", 0)
            own_target["destroyed"] = True
            if hasattr(player, "destroyed_cards"):
                player.destroyed_cards.append(own_target)
            log_event(context, log, "destroy",
                      f"💥 {source_card['card_id']} destroys {player.name}’s {own_target['card_id']}")

            if not getattr(player, "first_friendly_destroyed", False):
                player.first_friendly_destroyed = True
                log_event(context, log, "immune", f"🛡️ First friendly Project destroyed for {player.name}")

    elif act_type == "gain_mc_when_own_loses":
        if not player or not source_card:
            log_event(context, log, "info",
                      f"❌ {player_name} → {source_card.get('card_id', '???')} failed: player or source_card missing.")
            return

        losses = max(0.0, getattr(player, "mc_loss_this_phase", 0.0))
        if losses <= 0:
            log_event(context, log, "warn", f"⚠️ {source_card['card_id']} checked but no own MC losses this phase.")
            return

        current_gain = source_card.get("_cmr2_gain", 0.0)
        base_mc = float(source_card.get("base_mc", 0))
        current_mc = float(source_card.get("current_mc", base_mc))

        try:
            per_loss_gain = float(action_value)
        except Exception:
            per_loss_gain = 0.0

        possible_gain = min(per_loss_gain * losses, 10 - current_gain)
        if possible_gain <= 0:
            log_event(context, log, "skip", f"⛔ {source_card['card_id']} already at max +10 bonus from effect.")
            return

        if source_card.get("immune_buff", False):
            log_event(context, log, "immune", f"🛡️ {source_card['card_id']} resisted a buff (immune).")
            return

        before = current_mc
        after = before + possible_gain
        source_card["current_mc"] = after
        source_card["_cmr2_gain"] = current_gain + possible_gain
        source_card["was_buffed"] = True
        source_card["last_buff_amount"] = possible_gain

        log_event(
            context, log, "buff",
            f"➕ {player_name}’s {source_card['card_id']} gains +{possible_gain:.1f} MC "
            f"from {losses} MC losses → {before:.1f} → {after:.1f} "
            f"(total bonus {source_card['_cmr2_gain']:.1f}/10)"
        )

    elif act_type == "add_mc_permanent":
        try:
            gain = float(value)
        except Exception:
            gain = 0.0

        before = card.get("current_mc", 0)
        card["current_mc"] = before + gain
        after = card["current_mc"]

        card["permanent_mc_bonus"] = card.get("permanent_mc_bonus", 0) + gain
        if gain > 0:
            card["was_buffed"] = True
            card["last_buff_amount"] = gain

        log_event(
            context, log, "buff",
            f"➕ {player_name}’s {card['card_id']} gains +{gain:.1f} MC permanently "
            f"→ {before:.1f} → {after:.1f}"
        )

    elif act_type == "disable":
        card["effects_disabled"] = True
        log_event(context, log, "skip",
                  f"🚫 {player_name}’s {card['card_id']} effects are disabled.")

    elif act_type == "reflect":
        if getattr(player, "first_debuff_blocked", False):
            return
        data = getattr(player, "first_debuff_data", None)
        if not data:
            return

        reflected_effect = data.get("effect")
        origin_card = data.get("source_card")
        if not reflected_effect or not origin_card:
            log.append(pretty_log("warn",
                                  f"⚠️ {source_card.get('card_id')} could not reflect — missing effect or source.",
                                  source_card))
            return

        log.append(pretty_log("reflect",
                              f"🪞 {source_card['card_id']} reflected the debuff back to {origin_card['card_id']}",
                              source_card))

        ctx2 = dict(context or {})
        ctx2.update({
            "targets": [origin_card],
            "effect": reflected_effect,
            "source_card": source_card,
            "player": player,
            "opponent": opponent,
            "field": player.field,
            "opponent_field": opponent.field,
            "is_reflected": True,
        })

        apply_action(
            source_card,
            reflected_effect.get("action_type"),
            reflected_effect.get("action_value"),
            opponent.name,
            log,
            ctx2
        )

        player.first_debuff_blocked = True
        player.first_debuff_data = None

    elif act_type == "revive_half_mc":
        if not card.get("destroyed", False):
            log_event(context, log, "info", f"❌ {player_name}’s {card['card_id']} failed revive: not destroyed.")
            return

        base_mc = card.get("base_mc", 0)
        mc_before_destruction = card.get("current_mc", base_mc)
        revived_mc = max(0, int(mc_before_destruction * 0.5))

        card["destroyed"] = False
        card["current_mc"] = revived_mc

        log_event(
            context, log, "revive",
            f"🩻 {player_name}’s {card['card_id']} is revived with {revived_mc} MC (50% of {mc_before_destruction})"
        )

    elif act_type == "destroy_and_transfer_base_mc":
        valid_targets = [t for t in targets if t and not t.get("destroyed")]
        if not valid_targets:
            log_event(context, log, "info", f"❌ {source_card.get('card_id', '???')} found no valid target to destroy.")
            return

        valid_own = [
            c for c in player.field
            if c.get("card_type") == "Project" and not c.get("destroyed")
        ]
        if not valid_own:
            log_event(context, log, "info",
                      f"❌ {source_card.get('card_id', '???')} found no valid own Project to receive MC.")
            return

        lowest_own = min(valid_own, key=lambda c: c.get("current_mc", 0))
        for victim in valid_targets:
            before = lowest_own["current_mc"]
            destroy_card(victim, log, player=player, opponent=opponent, source=source_card, context=context)

            if victim.get("destroyed", False):
                transfer_value = float(victim.get("base_mc", 0))
                lowest_own["current_mc"] = before + transfer_value
                after = lowest_own["current_mc"]

                if transfer_value > 0:
                    lowest_own["was_buffed"] = True
                    lowest_own["last_buff_amount"] = transfer_value

                log_event(
                    context, log, "destroy",
                    f"💥 {source_card.get('card_id', '???')} destroys {victim.get('card_id', '???')} "
                    f"(base {transfer_value:.1f} MC) → transfers to {lowest_own['card_id']} → {before:.1f} → {after:.1f}"
                )

    elif act_type == "add_mc_per_tag":
        tag = (effect.get("condition_value") or "").strip()
        if not tag:
            log_event(
                context, log, "warn",
                f"⚠️ {source_card.get('card_id', '???')} failed: no tag specified for add_mc_per_tag."
            )
            return

        try:
            per_tag_gain = float(value)
        except (TypeError, ValueError):
            per_tag_gain = 0.0

        count = sum(
            1
            for c in player.field
            if (
                c.get("card_type") == "Project"
                and not c.get("destroyed", False)
                and any(t.lower() == tag.lower() for t in c.get("tags", []))
            )
        )

        total_gain = count * per_tag_gain
        if total_gain <= 0:
            log_event(
                context, log, "info",
                f"ℹ️ {source_card.get('card_id', '???')} found {count} {tag}-tagged Projects but no MC gained."
            )
            return

        if card.get("immune_buff", False):
            log_event(context, log, "immune", f"🛡️ {card['card_id']} resisted a buff (immune).")
            return

        before = card.get("current_mc", 0)
        after = before + total_gain
        card["current_mc"] = after

        card["was_buffed"] = True
        card["last_buff_amount"] = total_gain

        if not context.get("suppress_generic_logs", False):
            log_event(
                context, log, "buff",
                f"🏷️ {source_card.get('card_id', '???')} gains +{total_gain:.1f} MC "
                f"for {count} {tag}-tagged Projects → {before:.1f} → {after:.1f}"
            )

    elif act_type == "wolfswap_e2_add_mc":
        # ✅ Wolfswap_E2: Gain MC equal to the average base MC of destroyed enemy Projects
        destroyed = getattr(opponent, "destroyed_cards", [])
        if destroyed:
            avg_mc = (sum(c.get("base_mc", 0) for c in destroyed) / len(destroyed)) if destroyed else 0.0
            before = card.get("current_mc", 0)
            card["current_mc"] = before + avg_mc
            after = card["current_mc"]

            if after > before:
                card["was_buffed"] = True
                card["last_buff_amount"] = after - before

            if log is not None:
                log_event(
                    context, log, "buff",
                    f"➕ {source_card['card_id']} gains +{avg_mc:.1f} MC "
                    f"(average base MC of destroyed enemy Projects) → {before:.1f} → {after:.1f}"
                )
        else:
            if log is not None:
                log_event(
                    context, log, "warn",
                    f"⚠️ {source_card['card_id']} tried to activate but no enemy Projects were destroyed."
                )

    elif action_type in ("destroy + add_mc", "destroy+add_mc", "destroy_+_add_mc"):
    # Legacy alias for "destroy + add_mc"
        before = float(card.get("current_mc", card.get("base_mc", 0.0)))

        # Centralized destruction: handles tracking + deathrattles
        destroy_card(
            card,
            log,
            player=player,
            opponent=opponent,
            source=source_card,
            context=context
        )

        try:
            gain = float(value)
        except Exception:
            gain = 0.0

        card["current_mc"] = before + gain
        after = card["current_mc"]

        if gain > 0:
            card["was_buffed"] = True
            card["last_buff_amount"] = gain

        log_event(
            context, log, "destroy",
            f"💥 {player_name}’s {card['card_id']} destroyed & gains +{gain:.1f} MC → {before:.1f} → {after:.1f}"
        )


    # ✅ Special case — tag = Meme
    elif (effect and effect.get("condition_type") == "tag"
          and effect.get("target_type") == "all_meme_tagged"):
        for target in field:
            if (
                target.get("card_type") == "Project"
                and not target.get("destroyed")
                and "Meme" in target.get("tags", [])
            ):
                before = target["current_mc"]
                target["current_mc"] = before + value
                after = target["current_mc"]

                if after > before:
                    target["was_buffed"] = True
                    target["last_buff_amount"] = after - before

                log_event(
                    context, log, "buff",
                    f"➕ {source_card['card_id']} boosts {player.name}’s Meme-tagged {target['card_id']} "
                    f"by +{value:.1f} MC → {before:.1f} → {after:.1f}"
                )

    # ✅ Default case: handle targets, including lowest_own_project
    else:
        for target in targets:
            if not target or target.get("destroyed"):
                continue
            if target.get("card_type") != "Project":
                log_event(context, log, "skip",
                          f"🚫 Skipping add_mc: {target.get('card_id', '???')} is not a Project")
                continue

            before = target["current_mc"]
            target["current_mc"] = before + value
            after = target["current_mc"]
            owner = target.get("owner", player.name if player else "Unknown")

            if after > before:
                target["was_buffed"] = True
                target["last_buff_amount"] = after - before

            if effect and effect.get("target_type") == "lowest_own_project":
                log_event(
                    context, log, "buff",
                    f"➕ {source_card['card_id']} boosts {owner}’s lowest Project {target['card_id']} "
                    f"by +{value:.1f} MC → {before:.1f} → {after:.1f}"
                )
            else:
                log_event(
                    context, log, "buff",
                    f"➕ {source_card['card_id']} boosts {owner}’s {target['card_id']} "
                    f"by +{value:.1f} MC → {before:.1f} → {after:.1f}"
                )

        # Optional combo: destroy Common card after buff if specified
        if effect and effect.get("condition_value") == "destroy_common":
            common_projects = [
                c for c in player.field
                if c.get("rarity", "").lower() == "common"
                and c.get("card_type") == "Project"
                and not c.get("destroyed")
                and c != source_card
            ]
            if common_projects:
                to_destroy = common_projects[0]
                to_destroy["destroyed"] = True
                player.destroyed_cards.append(to_destroy)
                log_event(context, log, "death",
                          f"💀 {to_destroy['card_id']} was destroyed by {source_card['card_id']}’s effect")
            else:
                log_event(context, log, "warn",
                          f"⚠️ No Common Project found to destroy for {source_card['card_id']}")
                
                

