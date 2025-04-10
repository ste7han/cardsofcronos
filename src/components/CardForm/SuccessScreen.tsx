'use client';

import React from 'react';
import Link from 'next/link';

interface SuccessScreenProps {
  transactionHash: string | null;
  onCreateAnother: () => void;
}

const SuccessScreen: React.FC<SuccessScreenProps> = ({ transactionHash, onCreateAnother }) => {
  return (
    <div className="card p-6 text-center my-8 mx-auto max-w-3xl">
      <div className="text-5xl mb-4">🎉</div>
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
