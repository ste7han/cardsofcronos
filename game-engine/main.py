import random
import traceback

from firebase_functions import https_fn, firestore_fn, options
from firebase_admin import initialize_app, firestore

# Initialiseer de app (als dat nog niet gebeurd is)
try:
    initialize_app()
except ValueError:
    pass

MAX_SEED = 2 ** 31 - 1


def _simulate(deck1_ids, deck2_ids, seed=None):
    """Draai één match. Geeft de payload terug die de frontend verwacht.

    De score komt uit calculate_total_mc — dezelfde functie die het logboek en
    het overwinningsscherm gebruiken. Hiervoor telde deze functie álle
    niet-vernietigde kaarten mee, inclusief Support- en Founder-kaarten waarvan
    de MC door acties gemuteerd wordt. Daardoor kon de score op het scherm
    afwijken van de stand in het logboek van diezelfde match.
    """
    # LAZY IMPORT — de engine is groot; alleen laden als er echt gevochten wordt.
    from match_simulator import simulate_match_with_decks, calculate_total_mc

    if seed is None:
        seed = random.SystemRandom().randrange(MAX_SEED)

    log_blocks, deck1_final, deck2_final = simulate_match_with_decks(
        deck1_ids=deck1_ids,
        deck2_ids=deck2_ids,
        seed=seed,
    )

    p1_score = calculate_total_mc(deck1_final)
    p2_score = calculate_total_mc(deck2_final)
    winner = "Player 1" if p1_score > p2_score else "Player 2" if p2_score > p1_score else "Draw"

    return {
        "winner": winner,
        "seed": seed,
        "finalScores": {"p1": p1_score, "p2": p2_score},
        "finalFields": {"p1": deck1_final, "p2": deck2_final},
        "logs": log_blocks,
    }


def _store_match(result, *, deck1_ids, deck2_ids, mode, stake=0,
                 lobby_id=None, player1_address=None, player2_address=None):
    """Schrijf het matchdocument en geef de payload met battleId terug."""
    db = firestore.client()
    match_data = {
        "player1_ids": deck1_ids,
        "player2_ids": deck2_ids,
        "player1Address": player1_address,
        "player2Address": player2_address,
        "winner": result["winner"],
        "seed": result["seed"],
        "finalScores": result["finalScores"],
        "finalFields": result["finalFields"],
        "logs": result["logs"],
        "timestamp": firestore.SERVER_TIMESTAMP,
        "stake": stake,
        "mode": mode,
    }
    if lobby_id:
        match_data["lobbyId"] = lobby_id

    _, doc_ref = db.collection("matches").add(match_data)
    return {"battleId": doc_ref.id, **result}


# ---------------------------------------------------------------------------
# TRAINING — de speler vecht tegen een lokaal gegenereerd CPU-deck.
# ---------------------------------------------------------------------------
@https_fn.on_call(memory=options.MemoryOption.MB_512, timeout_sec=120)
def start_battle_python(req: https_fn.CallableRequest):
    if req.auth is None:
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.UNAUTHENTICATED,
            message="Sign in before starting a battle.",
        )

    data = req.data or {}
    deck1_ids = data.get("deckA_ids")
    deck2_ids = data.get("deckB_ids")
    stake = data.get("stake", 0)
    mode = data.get("mode", "training")

    if not deck1_ids or not isinstance(deck1_ids, list):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Invalid Deck A")
    if not deck2_ids or not isinstance(deck2_ids, list):
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Invalid Deck B")

    # PvP loopt via de lobby-trigger hieronder, niet via deze callable. Anders
    # zou een speler zijn eigen PvP-uitslag kunnen laten uitrekenen.
    if mode != "training":
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT,
            message="PvP battles are started by the server, not by the client.")

    try:
        result = _simulate(deck1_ids, deck2_ids)
    except ValueError as e:
        # Deckvalidatie — dit mag de speler weten.
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message=str(e))
    except Exception:
        # Interne fout: loggen, maar niet naar de client lekken.
        print("BATTLE ERROR:\n" + traceback.format_exc())
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message="The battle simulator failed. Please try again.")

    return _store_match(result, deck1_ids=deck1_ids, deck2_ids=deck2_ids,
                        mode="training", stake=stake)


# ---------------------------------------------------------------------------
# PVP — de server is scheidsrechter.
#
# Hiervoor startte de browser van de host de battle en schreef die het resultaat
# terug. Dat gaf twee problemen: de battle liep twee keer (met een ongeseede
# engine dus met twee verschillende winnaars), en als de host zijn tab sloot
# bleef de gast eeuwig wachten. Nu claimt deze trigger de lobby in een
# transactie en rekent hij precies één keer.
# ---------------------------------------------------------------------------
@firestore_fn.on_document_updated(
    document="lobbies/{lobbyId}",
    memory=options.MemoryOption.MB_512,
    timeout_sec=300,
)
def on_lobby_ready(event: firestore_fn.Event) -> None:
    after = event.data.after if event.data else None
    if after is None or not after.exists:
        return

    data = after.to_dict() or {}
    if data.get("status") != "selecting_decks":
        return
    if not data.get("hostDeck") or not data.get("guestDeck"):
        return

    lobby_id = event.params["lobbyId"]
    db = firestore.client()
    lobby_ref = db.collection("lobbies").document(lobby_id)

    # 1. Claim de match. Dit gebeurt VOOR de simulatie, zodat een tweede
    #    invocatie (retry, extra write) er niet langs kan.
    @firestore.transactional
    def claim(transaction):
        snap = lobby_ref.get(transaction=transaction)
        current = snap.to_dict() or {}
        if current.get("status") != "selecting_decks":
            return None
        if not current.get("hostDeck") or not current.get("guestDeck"):
            return None
        transaction.update(lobby_ref, {"status": "battling"})
        return current

    claimed = claim(db.transaction())
    if claimed is None:
        print(f"[lobby {lobby_id}] al geclaimd door een andere invocatie — overslaan")
        return

    host_deck = claimed["hostDeck"]
    guest_deck = claimed["guestDeck"]

    # 2. Simuleren en wegschrijven.
    try:
        result = _simulate(host_deck, guest_deck)
        stored = _store_match(
            result,
            deck1_ids=host_deck,
            deck2_ids=guest_deck,
            mode="pvp",
            stake=claimed.get("wager", 0),
            lobby_id=lobby_id,
            player1_address=claimed.get("hostAddress"),
            player2_address=claimed.get("guestAddress"),
        )
    except ValueError as e:
        print(f"[lobby {lobby_id}] ongeldig deck: {e}")
        lobby_ref.update({"status": "error", "errorMessage": str(e)})
        return
    except Exception:
        print(f"[lobby {lobby_id}] simulatie mislukt:\n" + traceback.format_exc())
        lobby_ref.update({
            "status": "error",
            "errorMessage": "The battle simulator failed. Please start a new match.",
        })
        return

    # 3. Beide spelers lezen dit ene document.
    lobby_ref.update({
        "status": "finished",
        "matchId": stored["battleId"],
        "battleResult": stored,
        "finishedAt": firestore.SERVER_TIMESTAMP,
    })
    print(f"[lobby {lobby_id}] klaar — winnaar {stored['winner']}, match {stored['battleId']}")
