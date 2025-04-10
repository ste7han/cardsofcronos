'use client';

import React from 'react';
import { StepProps, Rarity } from './types';

const RarityStep: React.FC<StepProps> = ({ register, watch, setValue, onNext, onBack, burnAmount = 0 }) => {
  const watchRarity = watch('rarity');

  const handleSelectRarity = (rarity: Rarity) => {
    setValue('rarity', rarity);
    setTimeout(() => onNext(), 300); // Auto-advance after selection
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Select Rarity</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Common Rarity */}
        <RarityOption
          rarity="Common"
          icon="⚪"
          color="bg-gray-500"
          cost="10,000 🔥"
          isSelected={watchRarity === 'Common'}
          register={register}
          onSelect={() => handleSelectRarity('Common')}
        />

        {/* Rare Rarity */}
        <RarityOption
          rarity="Rare"
          icon="🟨"
          color="bg-yellow-500"
          cost="20,000 🔥"
          isSelected={watchRarity === 'Rare'}
          register={register}
          onSelect={() => handleSelectRarity('Rare')}
        />

        {/* Epic Rarity */}
        <RarityOption
          rarity="Epic"
          icon="🟪"
          color="bg-purple-500"
          cost="50,000 🔥"
          isSelected={watchRarity === 'Epic'}
          register={register}
          onSelect={() => handleSelectRarity('Epic')}
        />

        {/* Legendary Rarity */}
        <RarityOption
          rarity="Legendary"
          icon="🟧"
          color="bg-orange-500"
          cost="100,000 🔥"
          isSelected={watchRarity === 'Legendary'}
          register={register}
          onSelect={() => handleSelectRarity('Legendary')}
        />

        {/* Mythical Rarity */}
        <RarityOption
          rarity="Mythical"
          icon="⚫"
          color="bg-black"
          cost="250,000 🔥"
          isSelected={watchRarity === 'Mythical'}
          register={register}
          onSelect={() => handleSelectRarity('Mythical')}
        />
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
            className="btn-secondary py-2 px-6 text-sm font-medium"
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
  icon: string;
  color: string;
  cost: string;
  isSelected: boolean;
  register: StepProps['register'];
  onSelect: () => void;
}

const RarityOption: React.FC<RarityOptionProps> = ({
  rarity,
  icon,
  color,
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
        <div className={`w-full h-32 mb-3 overflow-hidden rounded-lg ${color} flex items-center justify-center`}>
          <span className="text-4xl">{icon}</span>
        </div>
        <h3 className="text-xl font-bold">{rarity}</h3>
        <p className="text-sm text-gray-300">{cost}</p>
      </div>
    </label>
  );
};

export default RarityStep;
