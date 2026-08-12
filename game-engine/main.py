from firebase_functions import https_fn
from firebase_admin import initialize_app, firestore
import os
import sys

# Initialiseer de app (als dat nog niet gebeurd is)
try:
    initialize_app()
except ValueError:
    pass

@https_fn.on_call(memory=512, timeout_sec=60) # Iets meer timeout voor zekerheid
def start_battle_python(req: https_fn.CallableRequest):
    # LAZY IMPORT
    from match_simulator import simulate_match_with_decks
    
    data = req.data
    
    # Haal data op uit de request
    deck1_ids = data.get("deckA_ids")
    deck2_ids = data.get("deckB_ids")
    stake = data.get("stake", 0)
    mode = data.get("mode", "training") # 'pvp' of 'training'
    lobby_id = data.get("lobbyId", None) # NIEUW: Koppel aan lobby
    
    # Validatie
    if not deck1_ids or not isinstance(deck1_ids, list):
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Invalid Deck A")
    if not deck2_ids or not isinstance(deck2_ids, list):
        raise https_fn.HttpsError(code=https_fn.FunctionsErrorCode.INVALID_ARGUMENT, message="Invalid Deck B")

    try:
        # 1. Run de simulator
        log_blocks, deck1_final, deck2_final = simulate_match_with_decks(
            deck1_ids=deck1_ids,
            deck2_ids=deck2_ids
        )

        # 2. Bereken scores
        p1_score = sum(c.get("current_mc", 0) for c in deck1_final if not c.get("destroyed"))
        p2_score = sum(c.get("current_mc", 0) for c in deck2_final if not c.get("destroyed"))
        
        winner = "Player 1" if p1_score > p2_score else "Player 2" if p2_score > p1_score else "Draw"

        # 3. Opslaan in Firestore
        db = firestore.client()
        match_data = {
            "player1_ids": deck1_ids,
            "player2_ids": deck2_ids,
            "winner": winner,
            "finalScores": {"p1": p1_score, "p2": p2_score},
            "finalFields": {"p1": deck1_final, "p2": deck2_final},
            "logs": log_blocks,
            "timestamp": firestore.SERVER_TIMESTAMP,
            "stake": stake,
            "mode": mode
        }
        
        # Als er een lobby ID is, sla die op (handig voor PvP historie)
        if lobby_id:
            match_data["lobbyId"] = lobby_id

        _, doc_ref = db.collection("matches").add(match_data)

        # 4. Return resultaat naar frontend
        return {
            "battleId": doc_ref.id, 
            "winner": winner,
            "finalScores": {"p1": p1_score, "p2": p2_score},
            "finalFields": {"p1": deck1_final, "p2": deck2_final},
            "logs": log_blocks 
        }

    except Exception as e:
        print(f"BATTLE ERROR: {str(e)}")
        # Stuur de echte error terug zodat je in de frontend weet wat er mis ging
        raise https_fn.HttpsError(
            code=https_fn.FunctionsErrorCode.INTERNAL,
            message=f"Simulator Error: {str(e)}"
        )