'use client';

import React from 'react';
import Link from 'next/link';

interface SuccessScreenProps {
  transactionHash: string | null;
  onCreateAnother: () => void;
  paymentFailed?: boolean;
  errorMessage?: string;
  orderReference?: string;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ 
  transactionHash, 
  onCreateAnother, 
  paymentFailed = false,
  errorMessage = '',
  orderReference = ''
}) => {
  return (
    <div className="card p-6 text-center my-8 mx-auto max-w-3xl">
      <div className="text-5xl mb-4">{paymentFailed ? '🔄' : '🎉'}</div>
      
      {paymentFailed ? (
        <>
          <h2 className="text-2xl font-bold mb-4">Request Saved for Manual Verification</h2>
          <div className="mb-4 p-4 bg-yellow-900/30 rounded-lg border border-yellow-500/30">
            <p className="mb-2">Your card request was saved, but the payment transaction failed.</p>
            <p>Our team will review your request manually.</p>
          </div>
          
          {errorMessage && (
            <div className="mb-4 text-sm">
              <p className="text-red-400">Error details: {errorMessage}</p>
            </div>
          )}
          
          {orderReference && (
            <div className="mb-6">
              <p className="text-sm mb-2">Your Order Reference:</p>
              <p className="font-mono bg-purple-900/30 p-2 rounded break-all">{orderReference}</p>
              <p className="text-sm mt-2 text-gray-400">Please save this reference number for support inquiries</p>
            </div>
          )}
        </>
      ) : (
        <>
          <h2 className="text-2xl font-bold mb-4">Request Submitted Successfully!</h2>
          <p className="mb-4">Your card request has been submitted and tokens have been burned.</p>

          {transactionHash && (
            <div className="mb-6">
              <p className="text-sm mb-2">Transaction Hash:</p>
              <a
                href={`https://cronoscan.com/tx/${transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#9D4EDD] break-all hover:underline"
              >
                {transactionHash}
              </a>
            </div>
          )}
        </>
      )}

      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          type="button"
          onClick={onCreateAnother}
          className="btn-primary py-4 px-8 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
        >
          Create Another Card
        </button>

        <Link
          href="/orders"
          className="btn-secondary py-4 px-8 text-lg font-bold shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
        >
          View Your Orders
        </Link>
      </div>
    </div>
  );
};

export default SuccessScreen;
