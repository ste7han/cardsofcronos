'use client';

import React, { useEffect } from 'react';
import { StepProps, Rarity } from './types';
import Image from 'next/image';

const RarityStep: React.FC<StepProps> = ({ register, watch, setValue, onNext, onBack, burnAmount = 0 }) => {
  const watchRarity = watch('rarity');
  const watchCardType = watch('cardType');

  // Set default rarity based on card type
  useEffect(() => {
    if (watchCardType === 'Roast' && watchRarity !== 'Mythical') {
      setValue('rarity', 'Mythical');
    } else if (watchCardType === 'Founder' && 
              !['Epic', 'Legendary', 'Mythical'].includes(watchRarity)) {
      setValue('rarity', 'Epic');
    }
  }, [watchCardType, watchRarity, setValue]);

  const handleSelectRarity = (rarity: Rarity) => {
    setValue('rarity', rarity);
    setTimeout(() => onNext(), 300); // Auto-advance after selection
  };

  // Filter rarities based on card type
  const getAvailableRarities = () => {
    if (watchCardType === 'Roast') {
      return ['Mythical'];
    } else if (watchCardType === 'Founder') {
      return ['Epic', 'Legendary', 'Mythical'];
    } else {
      return ['Common', 'Rare', 'Epic', 'Legendary', 'Mythical'];
    }
  };

  const availableRarities = getAvailableRarities();

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Select Rarity</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Common Rarity */}
        {availableRarities.includes('Common') && (
          <RarityOption
            rarity="Common"
            imagePath="/common.png"
            cost="10,000 🔥"
            isSelected={watchRarity === 'Common'}
            register={register}
            onSelect={() => handleSelectRarity('Common')}
          />
        )}

        {/* Rare Rarity */}
        {availableRarities.includes('Rare') && (
          <RarityOption
            rarity="Rare"
            imagePath="/rare.png"
            cost="20,000 🔥"
            isSelected={watchRarity === 'Rare'}
            register={register}
            onSelect={() => handleSelectRarity('Rare')}
          />
        )}

        {/* Epic Rarity */}
        {availableRarities.includes('Epic') && (
          <RarityOption
            rarity="Epic"
            imagePath={watchCardType === 'Founder' ? "/founderepic.png" : "/epic.png"}
            cost="50,000 🔥"
            isSelected={watchRarity === 'Epic'}
            register={register}
            onSelect={() => handleSelectRarity('Epic')}
          />
        )}

        {/* Legendary Rarity */}
        {availableRarities.includes('Legendary') && (
          <RarityOption
            rarity="Legendary"
            imagePath={watchCardType === 'Founder' ? "/founderlegendary.png" : "/legendary.png"}
            cost="100,000 🔥"
            isSelected={watchRarity === 'Legendary'}
            register={register}
            onSelect={() => handleSelectRarity('Legendary')}
          />
        )}

        {/* Mythical Rarity */}
        {availableRarities.includes('Mythical') && (
          <RarityOption
            rarity="Mythical"
            imagePath={watchCardType === 'Founder' ? "/foundermythical.png" : 
                       watchCardType === 'Roast' ? "/roast.png" : "/mythical.png"}
            cost="250,000 🔥"
            isSelected={watchRarity === 'Mythical'}
            register={register}
            onSelect={() => handleSelectRarity('Mythical')}
          />
        )}
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

interface RarityOptionProps {
  rarity: Rarity;
  imagePath: string;
  cost: string;
  isSelected: boolean;
  register: StepProps['register'];
  onSelect: () => void;
}

const RarityOption: React.FC<RarityOptionProps> = ({
  rarity,
  imagePath,
  cost,
  isSelected,
  register,
  onSelect,
}) => {
  return (
    <label
      className={`card p-4 cursor-pointer transition-all ${
        isSelected ? 'border-[#FFD700] ring-2 ring-[#FFD700]' : 'border-[#9D4EDD]'
      }`}
      onClick={(e) => {
        // Prevent default to avoid double-triggering with the input's onChange
        e.preventDefault();
        onSelect();
      }}
    >
      <input
        type="radio"
        value={rarity}
        {...register('rarity')}
        className="hidden"
        onChange={onSelect}
      />
      <div className="flex flex-col items-center">
        <div className="w-full h-32 mb-3 overflow-hidden rounded-lg flex items-center justify-center relative">
          <Image 
            src={imagePath} 
            alt={`${rarity} Rarity`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'contain' }}
            className="rounded-lg"
          />
        </div>
        <h3 className="text-xl font-bold">{rarity}</h3>
        <p className="text-sm text-gray-300">{cost}</p>
      </div>
    </label>
  );
};

export default RarityStep;
