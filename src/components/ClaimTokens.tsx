'use client';

import React, { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '@/firebase/config'; // Zorg dat dit pad klopt naar je firebase config
import { useAppKit } from '@/hooks/useAppKit';

export const ClaimTokens = () => {
  const { appKitAccount } = useAppKit();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');

  const handleClaim = async () => {
    // Check of wallet verbonden is
    const userAddress = appKitAccount?.address;
    if (!userAddress) {
      return alert("Verbind eerst je wallet!");
    }
    
    setLoading(true);
    setStatus('Bezig met claimen...');

    try {
      const functions = getFunctions(app);
      // We roepen de functie aan
      const claimFunction = httpsCallable(functions, 'claimWeeklyTokens');
      
      const result: any = await claimFunction({ address: userAddress });
      
      console.log('Claim resultaat:', result.data);
      alert(result.data.message || "Tokens succesvol geclaimd!");
      setStatus('Claim succesvol!');
    } catch (error: any) {
      console.error('Claim fout:', error);
      // Firebase errors hebben een 'message' veld
      alert("Fout: " + (error.message || "Onbekende fout opgetreden"));
      setStatus('Claim mislukt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-gray-900 border border-gray-700 rounded-xl text-white shadow-lg">
      <h2 className="text-2xl font-bold mb-2 text-blue-400">🎁 Wekelijkse Rewards</h2>
      <p className="mb-6 text-gray-400 text-sm">
        Ontvang $PACK, $CRY, $NFX en meer op basis van je $CROCARD holdings. 
        Je kunt één keer per week claimen.
      </p>
      
      <div className="flex flex-col items-center">
        <button 
          onClick={handleClaim}
          disabled={loading}
          className={`w-full py-3 px-6 rounded-full font-bold text-lg transition-all ${
            loading 
              ? "bg-gray-600 cursor-not-allowed" 
              : "bg-blue-600 hover:bg-blue-500 shadow-blue-500/20 shadow-xl"
          }`}
        >
          {loading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 mr-3 border-t-2 border-white rounded-full" viewBox="0 0 24 24"></svg>
              Verwerken...
            </span>
          ) : "Claim Nu Rewards"}
        </button>
        
        {status && <p className="mt-4 text-xs text-gray-500">{status}</p>}
      </div>
    </div>
  );
};