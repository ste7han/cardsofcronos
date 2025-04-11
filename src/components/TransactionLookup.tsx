'use client';

import React, { useState } from 'react';
import { getOrderByTransactionHash } from '@/firebase/firestore';

interface TransactionLookupProps {
  onOrderFound: (order: any) => void;
}

const TransactionLookup: React.FC<TransactionLookupProps> = ({ onOrderFound }) => {
  const [transactionHash, setTransactionHash] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic validation
    if (!transactionHash) {
      setError('Please enter a transaction hash');
      return;
    }
    
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch order by transaction hash
      const order = await getOrderByTransactionHash(transactionHash);
      
      if (!order) {
        setError('No order found with this transaction hash');
        return;
      }
      
      // Call the callback with the found order
      onOrderFound(order);
      
      // Clear the input field
      setTransactionHash('');
    } catch (err) {
      console.error('Error looking up transaction:', err);
      setError('An error occurred while looking up the transaction');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card p-4 mb-6">
      <h2 className="text-xl font-bold mb-4 text-[var(--secondary)]">Find Order by Transaction Hash</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label 
            htmlFor="transactionHash" 
            className="block text-sm font-medium mb-1"
          >
            Transaction Hash
          </label>
          <input
            id="transactionHash"
            type="text"
            value={transactionHash}
            onChange={(e) => setTransactionHash(e.target.value)}
            placeholder="0x..."
            className="w-full p-2 bg-[var(--cosmic-black)]/30 border border-[var(--cosmic-black)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent"
          />
        </div>
        
        {error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}
        
        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Looking up...
            </span>
          ) : (
            'Look Up Order'
          )}
        </button>
      </form>
    </div>
  );
};

export default TransactionLookup;
