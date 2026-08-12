'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ethers } from 'ethers';

// Firebase
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app, db } from '@/firebase/config';
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

function PvPArenaContent() {
  const { appKitAccount, openAppKit } = useAppKit();
  const [mounted, setMounted] = useState(false);
  
  // State
  const [view, setView] = useState<'scan' | 'lobby' | 'deck-builder' | 'waiting-for-opponent' | 'fighting' | 'result' | 'log'>('scan');
  
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
  const [activeAddress, setActiveAddress] = useState<string | undefined>(undefined);

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
      if (addr && addr !== activeAddress) setActiveAddress(addr);
    };
    detectWallet();
    const interval = setInterval(detectWallet, 2000);
    return () => clearInterval(interval);
  }, [mounted, appKitAccount, activeAddress]);

  // API Scan Logic (Zelfde als voorheen)
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
        
        // NA DE SCAN GAAN WE NAAR DE LOBBY IPV DIRECT DECK BUILDER
        setView('lobby'); 
    } catch (e: any) { alert("Scan failed: " + e.message); } 
    finally { setIsLoading(false); }
  };

  // --- LOBBY JOINED / CREATED ---
  const handleEnterLobby = (id: string, host: boolean, wager: number) => {
    setLobbyId(id);
    setIsHost(host);
    setStake(wager);
    setView('deck-builder'); // Nu mag je je deck kiezen voor DEZE game
  };

  // --- REAL-TIME LOBBY LISTENER ---
  useEffect(() => {
    if (!lobbyId) return;

    const unsub = onSnapshot(doc(db, "lobbies", lobbyId), (snapshot) => {
        const data = snapshot.data();
        if (!data) return;

        // Als beide spelers klaar zijn, start host de engine
        const hostReady = data.hostDeck && data.hostDeck.length > 0;
        const guestReady = data.guestDeck && data.guestDeck.length > 0;

        if (hostReady && guestReady && data.status !== 'battling' && data.status !== 'finished') {
            if (isHost && !battleResult) {
                console.log("Both players ready! I am host, starting battle engine...");
                triggerBattle(data);
            } else if (!battleResult) {
                setLoadingText("Host is calculating battle...");
            }
        }

        // HIER IS DE FIX:
        // We kijken nu of we NIET in 'result' of 'log' zitten.
        // Als we daar al zijn, mag de listener de view NIET meer veranderen.
        if (view !== 'result' && view !== 'log') {
            if (data.status === 'battling' && data.battleResult) {
                setBattleResult(data.battleResult);
                setView('fighting');
            }
        }
    });
    return () => unsub();
  }, [lobbyId, isHost, battleResult, view]); // 'view' toegevoegd aan dependencies

  // --- SUBMIT DECK (UPDATED) ---
  const handleSubmitDeck = async () => {
    if (!lobbyId || !activeAddress) return;
    setIsLoading(true);
    setLoadingText("Locking in Deck...");

    try {
       // 1. Haal de huidige stand van zaken op
       // We moeten weten of de ANDER al klaar is.
       const lobbyRef = doc(db, "lobbies", lobbyId);
       // We gebruiken een transactie of gewoon een get() omdat we toch optimistisch zijn
       // (In een echte app zou je dit via een Cloud Function doen om cheaten te voorkomen)
       
       const myDeck = selectedCards.map(c => c.card_id);
       
       // Update Firestore
       if (isHost) {
           // Ik ben host. Ik sla mijn deck op.
           // Als guestDeck al bestaat (niet null is), dan zijn we klaar!
           // Maar we kunnen dat hier niet checken zonder eerst te lezen.
           // Een simpele 'update' volstaat, de listener pikt het wel op.
           await updateDoc(lobbyRef, { hostDeck: myDeck });
       } else {
           // Ik ben guest.
           await updateDoc(lobbyRef, { guestDeck: myDeck });
       }
       
       // Ga naar wachtscherm
       setView('waiting-for-opponent');

    } catch (e) {
       console.error(e);
       alert("Error submitting deck");
    } finally {
       setIsLoading(false);
    }
  };

  // --- TRIGGER BATTLE (Cloud Function) ---
  const triggerBattle = async (lobbyData: any) => {
     try {
       console.log("Both players ready! Triggering Python Engine...");
       const functions = getFunctions(app);
       const startBattleFunc = httpsCallable(functions, 'start_battle_python'); // We passen deze later aan voor PvP
       
       // We sturen nu expliciet BEIDE decks naar de backend
       // (Je moet je backend hier wel op aanpassen, zie volgende stap!)
       const result: any = await startBattleFunc({ 
           mode: 'pvp',
           deckA_ids: lobbyData.hostDeck,
           deckB_ids: lobbyData.guestDeck,
           stake: lobbyData.wager
       });

       console.log("🔥 BATTLE RESULT:", result.data);

       // Sla het resultaat op in Firestore zodat BEIDE spelers het zien
       await updateDoc(doc(db, "lobbies", lobbyId!), {
           status: 'battling',
           battleResult: result.data
       });

     } catch (e) {
         console.error("Battle Trigger Error", e);
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

  if (view === 'result' && battleResult) return <BattleResult result={battleResult} score1={finalScores.s1} score2={finalScores.s2} onBack={() => { setView('lobby'); setBattleResult(null); setSelectedCards([]); }} onLog={() => setView('log')} onShare={() => {}} />;
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
                <button onClick={() => setView('lobby')} className="text-xs uppercase font-bold text-gray-500 hover:text-white">← Cancel</button>
                <div className="text-center">
                    <h2 className="text-2xl font-['Cinzel'] text-amber-500 uppercase">Assemble Deck</h2>
                    <p className="text-xs text-gray-500">Stakes: {stake} $CRO</p>
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
           <div className="flex flex-col items-center justify-center py-32 animate-pulse">
              <h2 className="text-4xl font-['Cinzel'] text-amber-500 mb-4 uppercase">Waiting for Opponent...</h2>
              <p className="text-gray-500">Deck locked. Battle will start automatically.</p>
           </div>
        )}

        {/* 5. FIGHTING */}
        {view === 'fighting' && battleResult && (
          <BattleFlow result={battleResult} onBack={() => setView('lobby')} onFinish={(s1, s2) => { setFinalScores({s1, s2}); setView('result'); }} />
        )}

      </main>
      <Footer />
    </div>
  );
}

export default function PvPPage() {
  return <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-amber-500 font-black uppercase tracking-[0.5em] animate-pulse">Establishing Connection...</div>}><PvPArenaContent /></Suspense>;
}