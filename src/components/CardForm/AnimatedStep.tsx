'use client';

import React from 'react';
import { StepProps } from './types';
import Image from 'next/image';

const AnimatedStep: React.FC<StepProps> = ({ register, watch, setValue, onNext, onBack, burnAmount = 0 }) => {
  const watchAnimated = watch('animated');

  const handleSelectAnimated = (animated: boolean) => {
    setValue('animated', animated);
    setTimeout(() => onNext(), 300); // Auto-advance after selection
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Animated / Moving</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Static Option */}
        <label
          className={`card p-4 cursor-pointer transition-all ${
            !watchAnimated ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'
          }`}
          onClick={(e) => {
            e.preventDefault();
            handleSelectAnimated(false);
          }}
        >
          <input
            type="radio"
            value="false"
            {...register('animated')}
            className="hidden"
            onChange={() => handleSelectAnimated(false)}
          />
          <div className="flex flex-col items-center">
            <div className="w-full h-32 mb-3 overflow-hidden rounded-lg flex items-center justify-center relative">
              <Image 
                src="/animated.png" 
                alt="Static Image"
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                style={{ objectFit: 'contain' }}
                className="rounded-lg"
              />
            </div>
            <h3 className="text-xl font-bold">No</h3>
            <p className="text-sm text-gray-300">Static Image</p>
          </div>
        </label>

        {/* Animated Option */}
        <label
          className={`card p-4 cursor-pointer transition-all ${
            watchAnimated ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'
          }`}
          onClick={(e) => {
            e.preventDefault();
            handleSelectAnimated(true);
          }}
        >
          <input
            type="radio"
            value="true"
            {...register('animated')}
            className="hidden"
            onChange={() => handleSelectAnimated(true)}
          />
          <div className="flex flex-col items-center">
            <div className="w-full h-32 mb-3 overflow-hidden rounded-lg flex items-center justify-center">
              <video 
                src="/currycro_mythical.mp4" 
                className="w-full h-full object-cover rounded-lg"
                autoPlay 
                loop 
                muted 
                playsInline
              />
            </div>
            <h3 className="text-xl font-bold">Yes</h3>
            <p className="text-sm text-gray-300">500,000 🔥</p>
          </div>
        </label>
      </div>

      <div className="card p-4 text-center">
        <h3 className="text-lg font-bold">Total Burn Amount</h3>
        <p className="text-2xl font-bold text-[#FFD700]">{burnAmount.toLocaleString()} 🔥</p>
      </div>

      {/* Navigation buttons */}
      {onBack && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary w-full sm:flex-1 py-4 text-lg font-bold shadow-lg shadow-[#FFD700]/20 hover:shadow-[#FFD700]/30"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
};

export default AnimatedStep;
