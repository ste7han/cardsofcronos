'use client';

import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers'; 
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config';
import { useAppKit } from '@/hooks/useAppKit';

const CROCARD_ADDRESS = "0xECf3361441512c1e9F6A6e8734D86614D8e795BC";
const TOTAL_SUPPLY_CROCARD = 1000000000; 
const RPC_URL = "https://evm.cronos.org";

interface RewardToken {
  name: string;
  per01Percent: number;
  icon: string;
}

const REWARD_DATA: RewardToken[] = [
  { name: "PACK", per01Percent: 10, icon: "🐺" },
  { name: "CRY", per01Percent: 1500, icon: "👾" },
  { name: "CAW777", per01Percent: 500, icon: "🐦" },
  { name: "NFX", per01Percent: 0.1, icon: "🦊" },
  { name: "CLOVE", per01Percent: 500, icon: "🐷" },
  { name: "OBS", per01Percent: 100, icon: "💎" },
  { name: "CRKS", per01Percent: 10, icon: "🦝" },
];

export default function RewardsPage() {
  const { appKitAccount, openAppKit } = useAppKit();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeAddress, setActiveAddress] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
  }, []);

  // DE MAGICKE FIX: Directe check voor MetaMask Browser
  useEffect(() => {
    if (!mounted) return;

    const detectWallet = async () => {
      // 1. Probeer AppKit (Reown)
      let addr = appKitAccount?.address;

      // 2. Als dat niet werkt, probeer de MetaMask Injected Provider (window.ethereum)
      if (!addr && (window as any).ethereum) {
        try {
          const provider = new ethers.providers.Web3Provider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            addr = accounts[0];
          }
        } catch (e) {
          console.error("MetaMask detection error", e);
        }
      }

      // 3. Update de state als we een adres hebben gevonden
      if (addr && addr !== activeAddress) {
        setActiveAddress(addr);
      }
    };

    detectWallet();
    const interval = setInterval(detectWallet, 2000); // Blijf checken
    return () => clearInterval(interval);
  }, [mounted, appKitAccount, activeAddress]);

  // Fetch balance
  useEffect(() => {
    if (!mounted || !activeAddress) return;

    const fetchBalance = async () => {
      setLoading(true);
      try {
        const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
        const abi = ["function balanceOf(address) view returns (uint256)"];
        const contract = new ethers.Contract(CROCARD_ADDRESS, abi, provider);
        const bal = await contract.balanceOf(activeAddress);
        setBalance(Number(ethers.utils.formatUnits(bal, 18)));
      } catch (e) {
        console.error("Error fetching balance:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBalance();
  }, [mounted, activeAddress]);

  const multiplier = (balance / TOTAL_SUPPLY_CROCARD) * 100 / 0.1;

  const handleClaim = async () => {
    if (!activeAddress) return alert("Please connect your wallet first");
    setClaiming(true);
    try {
      const functions = getFunctions(app);
      const claimFunction = httpsCallable(functions, 'claimWeeklyTokens');
      const result: any = await claimFunction({ address: activeAddress });
      alert(result.data.message);
    } catch (error: any) {
      alert(error.message || "Claim failed");
    } finally {
      setClaiming(false);
    }
  };

  if (!mounted) return <div className="min-h-screen bg-black"></div>;

  return (
    <div className="min-h-screen bg-black text-white font-['Spectral']">
      {/* VERBETERDE HEADER KOPPELING */}
      <Header 
        isWalletConnected={!!activeAddress} 
        walletAddress={activeAddress} 
        onConnectWallet={openAppKit} 
      />
      
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-['Cinzel'] text-[var(--secondary)] mb-4 tracking-widest uppercase">
              Weekly Rewards
            </h1>
            <p className="text-gray-400 max-w-xl mx-auto px-4">
              Hold $CROCARD to unlock weekly ecosystem rewards.
            </p>
          </div>

          <div className="modern-card p-6 md:p-8 mb-8 border border-blue-500/30 bg-blue-500/5 backdrop-blur-md rounded-2xl flex flex-col md:flex-row justify-between items-center mx-4">
            <div className="text-center md:text-left">
              <p className="text-xs text-blue-400 uppercase tracking-widest mb-1">Your Holdings</p>
              <h2 className="text-2xl md:text-3xl font-bold font-['Cinzel']">
                {loading ? "..." : balance.toLocaleString()} <span className="text-sm text-gray-500">$CROCARD</span>
              </h2>
            </div>
            <div className="mt-6 md:mt-0 text-center md:text-right">
              <p className="text-xs text-purple-400 uppercase tracking-widest mb-1">Reward Multiplier</p>
              <h2 className="text-2xl md:text-3xl font-bold font-['Cinzel']">
                {loading ? "..." : multiplier.toFixed(4)}x
              </h2>
            </div>
          </div>

          {!activeAddress ? (
            <div className="text-center py-10">
              <button 
                onClick={openAppKit}
                className="bg-[var(--secondary)] text-black px-8 py-3 rounded-full font-bold animate-pulse"
              >
                CONNECT WALLET TO VIEW REWARDS
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10 px-4">
              {REWARD_DATA.map((token) => (
                <div key={token.name} className="p-6 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-blue-500/50 transition-all group">
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-3xl">{token.icon}</span>
                    <span className="text-xs font-bold text-gray-500 tracking-widest uppercase">{token.name}</span>
                  </div>
                  <p className="text-gray-500 text-[10px] uppercase mb-1">Available to claim:</p>
                  <h3 className="text-xl font-bold text-white">
                    {loading ? "..." : (multiplier * token.per01Percent).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </h3>
                </div>
              ))}
            </div>
          )}

          {activeAddress && (
            <div className="text-center bg-gradient-to-b from-transparent to-blue-900/10 p-6 md:p-10 rounded-3xl border-t border-white/5 mx-4">
              <button
                onClick={handleClaim}
                disabled={claiming || balance === 0}
                className={`w-full md:w-auto px-12 py-4 rounded-full font-bold text-xl transition-all ${
                  claiming || balance === 0
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-400 text-white shadow-[0_0_30px_rgba(37,99,235,0.3)]"
                }`}
              >
                {claiming ? "PROCESSING..." : "CLAIM ALL REWARDS"}
              </button>
              <p className="mt-6 text-[10px] text-gray-600 uppercase tracking-widest">
                * Weekly claim (Mon-Sun). Gas fees in CRO apply.
              </p>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}