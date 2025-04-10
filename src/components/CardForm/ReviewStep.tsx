'use client';

import React from 'react';
import { StepProps } from './types';
import Image from 'next/image';

interface ReviewStepProps extends Omit<StepProps, 'onNext'> {
  imagePreview: string | null;
  isWalletConnected: boolean;
  onConnectWallet: () => void;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: () => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  watch,
  onBack,
  imagePreview,
  burnAmount = 0,
  isWalletConnected,
  onConnectWallet,
  isSubmitting,
  error,
  onSubmit
}) => {
  const watchCardType = watch('cardType');
  const watchRarity = watch('rarity');
  const watchAnimated = watch('animated');
  const watchName = watch('name');
  const watchDescription = watch('description');
  const watchSocialLink = watch('socialLink');
  const watchEmail = watch('email');

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Review & Submit</h2>

      <div className="card p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
            <h3 className="text-base font-bold text-[var(--secondary)]">Card Type</h3>
            <p className="text-white/90">{watchCardType}</p>
          </div>
          <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
            <h3 className="text-base font-bold text-[var(--secondary)]">Rarity</h3>
            <p className="text-white/90">{watchRarity}</p>
          </div>
          <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
            <h3 className="text-base font-bold text-[var(--secondary)]">Name</h3>
            <p className="text-white/90">{watchName}</p>
          </div>
          <div className="p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
            <h3 className="text-base font-bold text-[var(--secondary)]">Email</h3>
            <p className="text-white/90 break-all">{watchEmail}</p>
          </div>
        </div>

        <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
          <h3 className="text-base font-bold text-[var(--secondary)]">Description</h3>
          <p className="text-white/90">{watchDescription}</p>
        </div>

        <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
          <h3 className="text-base font-bold text-[var(--secondary)]">Social Link</h3>
          <p className="text-white/90 break-all">{watchSocialLink}</p>
        </div>

        <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
          <h3 className="text-base font-bold text-[var(--secondary)]">Animated</h3>
          <p className="text-white/90">{watchAnimated ? 'Yes' : 'No'}</p>
        </div>

        {imagePreview && (
          <div className="mt-4 p-3 bg-[var(--cosmic-black)]/30 rounded-lg">
            <h3 className="text-base font-bold text-[var(--secondary)]">Image</h3>
            <div className="w-40 h-40 sm:w-32 sm:h-32 mt-2 mx-auto relative">
              <Image 
                src={imagePreview} 
                alt="Preview" 
                fill
                sizes="(max-width: 768px) 160px, 128px"
                style={{ objectFit: 'cover' }}
                className="rounded-md" 
              />
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-[#0A0A23] border border-[#9D4EDD] rounded-md">
          <h3 className="text-lg font-bold text-center">Total Burn Amount</h3>
          <p className="text-2xl font-bold text-[#FFD700] text-center">{burnAmount.toLocaleString()} 🔥</p>
        </div>
      </div>

      {/* Wallet Reminder */}
      {!isWalletConnected && (
        <div className="bg-yellow-900/30 border border-yellow-600 rounded-md p-4 text-center">
          <p className="text-yellow-500 mb-2">You need to connect your wallet to proceed</p>
          <button
            type="button"
            onClick={onConnectWallet}
            className="btn-primary py-3 px-6 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50"
          >
            Connect Wallet
          </button>
        </div>
      )}

      {/* Errors */}
      {error && (
        <div className="bg-red-900/30 border border-red-600 rounded-md p-4">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary w-full sm:flex-1 py-4 text-lg font-bold shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
          >
            Back
          </button>
        )}
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || !isWalletConnected}
          className={`btn-primary w-full sm:flex-1 py-4 text-lg font-bold shadow-lg shadow-[#9D4EDD]/30 hover:shadow-[#9D4EDD]/50 ${
            isSubmitting || !isWalletConnected ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isSubmitting ? 'Processing...' : 'Burn Tokens & Submit'}
        </button>
      </div>
    </div>
  );
};

export default ReviewStep;
