'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { ethers } from 'ethers';

// Firebase
import { db, authReady } from '@/firebase/config';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';

// Data
import allCardsData from '@/lib/cards.json';
import tokenMappingRaw from '@/lib/token_mapping.json';

import { useAppKit } from '@/hooks/useAppKit';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { BattleFlow, BattleResult, BattleLog } from '@/components/arena/GameEngine';
import { DeckCard } from '@/components/arena/DeckCard';
import { LobbySystem } from '@/components/arena/LobbySystem';

const TOKEN_MAPPING: Record<string, string> = tokenMappingRaw as Record<string, string>;

type View = 'scan' | 'lobby' | 'deck-builder' | 'waiting-for-opponent' | 'fighting' | 'result' | 'log' | 'error';

function PvPArenaContent() {
  const { appKitAccount, openAppKit } = useAppKit();
  const [mounted, setMounted] = useState(false);

  // State
  const [view, setView] = useState<View>('scan');

  // Game Data
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [stake, setStake] = useState(100);
  const [ownedCardIds, setOwnedCardIds] = useState<string[]>([]);
  const [selectedCards, setSelectedCards] = useState<any[]>([]);

  const [battleResult, setBattleResult] = useState<any>(null);
  const [finalScores, setFinalScores] = useState({ s1: 0, s2: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [activeAddress, setActiveAddress] = useState<string | undefined>(undefined);

  // De Firestore-listener mag NIET opnieuw abonneren bij elke schermwissel —
  // dat was de oorzaak van de dubbel uitgevoerde battle. Hij leest de huidige
  // view daarom via een ref in plaats van via zijn closure.
  const viewRef = useRef<View>(view);
  useEffect(() => { viewRef.current = view; }, [view]);

  useEffect(() => { setMounted(true); }, []);

  // Wallet
  useEffect(() => {
    if (!mounted) return;
    const detectWallet = async () => {
      let addr = appKitAccount?.address;
      if (!addr && (window as any).ethereum) {
        try {
          const provider = new (ethers as any).providers.Web3Provider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) addr = accounts[0];
        } catch (e) {}
      }
      setActiveAddress(prev => (addr && addr !== prev ? addr : prev));
    };
    detectWallet();
    const interval = setInterval(detectWallet, 2000);
    return () => clearInterval(interval);
  }, [mounted, appKitAccount]);

  // API Scan Logic
  const scanWalletForCards = async () => {
    if (!activeAddress) { alert("Connect wallet first"); openAppKit(); return; }
    setIsLoading(true); setLoadingText("Scanning Blockchain...");
    try {
        const response = await fetch(`/api/scan?address=${activeAddress}`);
        if (!response.ok) throw new Error("Server Scan Error");
        const data = await response.json();
        const ownedTokenIds: number[] = data.ownedIds || [];

        const matchedCards: string[] = [];
        ownedTokenIds.forEach(id => {
            const mapId = TOKEN_MAPPING[id.toString()];
            if (mapId) matchedCards.push(mapId);
        });
        const uniqueCards = [...new Set(matchedCards)];
        setOwnedCardIds(uniqueCards);

        if (uniqueCards.length === 0) {
            setErrorMessage("No Cards of Cronos NFTs found in this wallet. You need at least 5 different Projects, 5 different Supports and 1 Founder to enter the arena.");
            setView('error');
            return;
        }

        setView('lobby');
    } catch (e: any) { alert("Scan failed: " + e.message); }
    finally { setIsLoading(false); }
  };

  // --- LOBBY JOINED / CREATED ---
  const handleEnterLobby = (id: string, host: boolean, wager: number) => {
    setLobbyId(id);
    setIsHost(host);
    setStake(wager);
    setView('deck-builder');
  };

  // Alles wat aan deze match hangt loslaten. Zonder het wissen van lobbyId
  // bleef de listener actief en gooide die je meteen terug in het gevecht.
  const leaveMatch = (next: View = 'lobby') => {
    setLobbyId(null);
    setIsHost(false);
    setBattleResult(null);
    setSelectedCards([]);
    setFinalScores({ s1: 0, s2: 0 });
    setLoadingText("");
    setErrorMessage("");
    setView(next);
  };

  // --- REAL-TIME LOBBY LISTENER ---
  // Abonneert alleen op lobbyId. De server bepaalt de uitslag; deze client
  // start niets meer zelf.
  useEffect(() => {
    if (!lobbyId) return;

    const unsub = onSnapshot(doc(db, "lobbies", lobbyId),
      (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        if (data.status === 'error') {
          setErrorMessage(data.errorMessage || "The battle could not be resolved.");
          setView('error');
          return;
        }

        if (data.status === 'battling') {
          setLoadingText("Server is resolving the battle...");
          return;
        }

        if (data.status === 'finished' && data.battleResult) {
          // Alleen binnenstappen als we het gevecht nog niet bekijken; anders
          // herstart een nieuw snapshot de animatie halverwege.
          const current = viewRef.current;
          if (current !== 'fighting' && current !== 'result' && current !== 'log') {
            setBattleResult(data.battleResult);
            setView('fighting');
          }
        }
      },
      (error) => {
        console.error("Lobby sync error", error);
        setErrorMessage("Lost connection to the match. Please return to the arena.");
        setView('error');
      }
    );
    return () => unsub();
  }, [lobbyId]);

  // --- SUBMIT DECK ---
  const handleSubmitDeck = async () => {
    if (!lobbyId || !activeAddress || !isDeckValid) return;
    setIsLoading(true);
    setLoadingText("Locking in Deck...");

    try {
       await authReady;
       const lobbyRef = doc(db, "lobbies", lobbyId);
       const myDeck = selectedCards.map(c => c.card_id);

       // Alleen je eigen deckveld. De server pikt op wanneer beide er staan.
       await updateDoc(lobbyRef, isHost ? { hostDeck: myDeck } : { guestDeck: myDeck });

       setView('waiting-for-opponent');
    } catch (e) {
       console.error(e);
       alert("Error submitting deck");
    } finally {
       setIsLoading(false);
    }
  };

  // --- HELPERS ---
  const getCount = (type: string) => selectedCards.filter(c => c.card_type === type || (type === 'Support' && c.card_type === 'Event')).length;
  const isDeckValid = getCount('Project') === 5 && getCount('Support') === 5 && getCount('Founder') === 1;
  const toggleCard = (card: any) => {
    const isSelected = selectedCards.find(c => c.card_id === card.card_id);
    if (isSelected) setSelectedCards(selectedCards.filter(c => c.card_id !== card.card_id));
    else {
      if (card.card_type === 'Project' && getCount('Project') >= 5) return;
      if ((card.card_type === 'Support' || card.card_type === 'Event') && getCount('Support') >= 5) return;
      if (card.card_type === 'Founder' && getCount('Founder') >= 1) return;
      setSelectedCards([...selectedCards, card]);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-black" />;

  // --- VIEWS ---

  const perspective = isHost ? 'p1' : 'p2';

  if (view === 'result' && battleResult) return (
    <BattleResult
      result={battleResult}
      score1={finalScores.s1}
      score2={finalScores.s2}
      perspective={perspective}
      opponentLabel="Opponent"
      onBack={() => leaveMatch('lobby')}
      onLog={() => setView('log')}
      onShare={() => {
        if (!battleResult?.battleId) return;
        navigator.clipboard.writeText(`${window.location.origin}/arena/training?match=${battleResult.battleId}`);
        alert("Replay link copied!");
      }}
    />
  );
  if (view === 'log' && battleResult) return <BattleLog logs={battleResult.logs} onClose={() => setView('result')} />;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-['Spectral']">
      <Header isWalletConnected={!!activeAddress} walletAddress={activeAddress} onConnectWallet={openAppKit} />
      <main className="container mx-auto px-4 py-8">

        {/* 1. SCAN SCREEN */}
        {view === 'scan' && (
           <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in">
              <h2 className="text-5xl font-black font-['Cinzel'] text-amber-500 mb-4 uppercase">Live Combat</h2>
              <p className="text-gray-500 mb-10 text-sm">We need to scan your wallet to see your playable cards.</p>
              <button onClick={scanWalletForCards} disabled={isLoading} className="px-12 py-4 bg-amber-500 text-black font-black uppercase tracking-widest rounded-full hover:bg-amber-400">
                 {isLoading ? loadingText : 'Scan Inventory & Enter Lobby'}
              </button>
           </div>
        )}

        {/* 2. LOBBY SYSTEM */}
        {view === 'lobby' && (
           <LobbySystem activeAddress={activeAddress || ""} onJoinGame={handleEnterLobby} />
        )}

        {/* 3. DECK BUILDER */}
        {view === 'deck-builder' && (
          <div className="max-w-7xl mx-auto animate-in fade-in">
             <div className="flex justify-between items-center mb-6">
                <button onClick={() => leaveMatch('lobby')} className="text-xs uppercase font-bold text-gray-500 hover:text-white">← Cancel</button>
                <div className="text-center">
                    <h2 className="text-2xl font-['Cinzel'] text-amber-500 uppercase">Assemble Deck</h2>
                    <p className="text-xs text-gray-500">Friendly match · {stake} pts on the line</p>
                </div>
                <div className="flex gap-2 text-[10px] font-bold uppercase text-gray-500 bg-gray-900 px-4 py-2 rounded-lg border border-white/10">
                    <span>Prj: {getCount('Project')}/5</span>
                    <span>Sup: {getCount('Support')}/5</span>
                    <span>Fdr: {getCount('Founder')}/1</span>
                </div>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 h-[550px] overflow-y-auto p-6 bg-white/5 rounded-3xl mb-8 border border-white/5 shadow-inner">
              {(allCardsData as any[])
                .filter(card => ownedCardIds.includes(card.card_id))
                .map((card) => (
                    <DeckCard
                      key={card.card_id}
                      card={card}
                      isSelected={!!selectedCards.find(c => c.card_id === card.card_id)}
                      onToggle={toggleCard}
                      colorTheme="amber"
                    />
              ))}
            </div>

            <div className="flex justify-center">
               <button
                 disabled={!isDeckValid || isLoading}
                 onClick={handleSubmitDeck}
                 className={`px-24 py-5 rounded-full font-black text-xl uppercase tracking-[0.2em] shadow-lg transition-all
                   ${isDeckValid && !isLoading ? 'bg-amber-500 text-black hover:scale-[1.02]' : 'bg-gray-800 text-gray-500 cursor-not-allowed'}`}
               >
                {isLoading ? loadingText : 'LOCK IN DECK'}
              </button>
            </div>
          </div>
        )}

        {/* 4. WAITING SCREEN */}
        {view === 'waiting-for-opponent' && (
           <div className="flex flex-col items-center justify-center py-32">
              <h2 className="text-4xl font-['Cinzel'] text-amber-500 mb-4 uppercase animate-pulse">
                {loadingText || "Waiting for Opponent..."}
              </h2>
              <p className="text-gray-500 mb-10">Deck locked. The battle starts automatically once both decks are in.</p>
              <button onClick={() => leaveMatch('lobby')} className="text-xs uppercase font-bold text-gray-600 hover:text-white border border-white/10 rounded-full px-6 py-3">
                Leave match
              </button>
           </div>
        )}

        {/* 5. FIGHTING */}
        {view === 'fighting' && battleResult && (
          <BattleFlow
            result={battleResult}
            perspective={perspective}
            opponentLabel="Opponent"
            onBack={() => leaveMatch('lobby')}
            onFinish={(s1, s2) => { setFinalScores({ s1, s2 }); setView('result'); }}
          />
        )}

        {/* 6. ERROR */}
        {view === 'error' && (
           <div className="flex flex-col items-center justify-center py-32 text-center">
              <h2 className="text-4xl font-['Cinzel'] text-red-500 mb-4 uppercase">Match Interrupted</h2>
              <p className="text-gray-400 max-w-md mb-10">{errorMessage}</p>
              <button onClick={() => leaveMatch('lobby')} className="px-12 py-4 bg-white text-black font-black uppercase tracking-widest rounded-full hover:bg-amber-400">
                Return to Arena
              </button>
           </div>
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function PvPPage() {
  return <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-amber-500 font-black uppercase tracking-[0.5em] animate-pulse">Establishing Connection...</div>}><PvPArenaContent /></Suspense>;
}
