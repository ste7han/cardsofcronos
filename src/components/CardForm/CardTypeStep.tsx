'use client';

import React from 'react';
import { StepProps, CardType } from './types';

const CardTypeStep: React.FC<StepProps> = ({ register, watch, setValue, onNext }) => {
  const watchCardType = watch('cardType');

  const handleSelectCardType = (type: CardType) => {
    setValue('cardType', type);
    setTimeout(() => onNext(), 300); // Auto-advance after selection
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-center">Select Card Type</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Project Card */}
        <CardTypeOption
          type="Project"
          icon="🟩"
          color="bg-green-500"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Project'}
          register={register}
          onSelect={() => handleSelectCardType('Project')}
        />

        {/* Founder Card */}
        <CardTypeOption
          type="Founder"
          icon="🟥"
          color="bg-red-500"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Founder'}
          register={register}
          onSelect={() => handleSelectCardType('Founder')}
        />

        {/* Crofam Card */}
        <CardTypeOption
          type="Crofam"
          icon="🟦"
          color="bg-blue-500"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Crofam'}
          register={register}
          onSelect={() => handleSelectCardType('Crofam')}
        />

        {/* Influencer Card */}
        <CardTypeOption
          type="Influencer"
          icon="🟪"
          color="bg-purple-500"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Influencer'}
          register={register}
          onSelect={() => handleSelectCardType('Influencer')}
        />

        {/* Event Card */}
        <CardTypeOption
          type="Event"
          icon="🟨"
          color="bg-yellow-500"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Event'}
          register={register}
          onSelect={() => handleSelectCardType('Event')}
        />

        {/* Roast Card */}
        <CardTypeOption
          type="Roast"
          icon="🟥"
          color="bg-red-500"
          cost="250,000 🔥"
          isSelected={watchCardType === 'Roast'}
          register={register}
          onSelect={() => handleSelectCardType('Roast')}
        />

        {/* Special Card */}
        <CardTypeOption
          type="Special"
          icon="⚫"
          color="bg-black"
          cost="500,000 🔥"
          isSelected={watchCardType === 'Special'}
          register={register}
          onSelect={() => handleSelectCardType('Special')}
        />

        {/* Parody Card */}
        <CardTypeOption
          type="Parody"
          icon="🟪"
          color="bg-purple-500"
          cost="250,000 🔥"
          isSelected={watchCardType === 'Parody'}
          register={register}
          onSelect={() => handleSelectCardType('Parody')}
        />

        {/* Fusion Card */}
        <CardTypeOption
          type="Fusion"
          icon="🟫"
          color="bg-amber-800"
          cost="250,000 🔥"
          isSelected={watchCardType === 'Fusion'}
          register={register}
          onSelect={() => handleSelectCardType('Fusion')}
        />
      </div>
    </div>
  );
};

interface CardTypeOptionProps {
  type: CardType;
  icon: string;
  color: string;
  cost: string;
  isSelected: boolean;
  register: StepProps['register'];
  onSelect: () => void;
}

const CardTypeOption: React.FC<CardTypeOptionProps> = ({
  type,
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
        value={type}
        {...register('cardType')}
        className="hidden"
        onChange={onSelect}
      />
      <div className="flex flex-col items-center">
        <div className={`w-full h-32 mb-3 overflow-hidden rounded-lg ${color} flex items-center justify-center`}>
          <span className="text-4xl">{icon}</span>
        </div>
        <h3 className="text-xl font-bold">{type}</h3>
        <p className="text-sm text-gray-300">{cost}</p>
      </div>
    </label>
  );
};

export default CardTypeStep;
