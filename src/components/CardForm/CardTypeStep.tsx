'use client';

import React from 'react';
import { StepProps, CardType } from './types';
import Image from 'next/image';

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
          imagePath="/project.png"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Project'}
          register={register}
          onSelect={() => handleSelectCardType('Project')}
        />

        {/* Founder Card */}
        <CardTypeOption
          type="Founder"
          imagePath="/founder.png"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Founder'}
          register={register}
          onSelect={() => handleSelectCardType('Founder')}
        />

        {/* Crofam Card */}
        <CardTypeOption
          type="Crofam"
          imagePath="/crofam.png"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Crofam'}
          register={register}
          onSelect={() => handleSelectCardType('Crofam')}
        />

        {/* Influencer Card */}
        <CardTypeOption
          type="Influencer"
          imagePath="/influencer.png"
          cost="100,000 🔥"
          isSelected={watchCardType === 'Influencer'}
          register={register}
          onSelect={() => handleSelectCardType('Influencer')}
        />

        {/* Event Card */}
        <CardTypeOption
          type="Event"
          imagePath="/event.jpg" // Updated to correct event.jpg image
          cost="100,000 🔥"
          isSelected={watchCardType === 'Event'}
          register={register}
          onSelect={() => handleSelectCardType('Event')}
        />

        {/* Roast Card */}
        <CardTypeOption
          type="Roast"
          imagePath="/roast.png"
          cost="250,000 🔥"
          isSelected={watchCardType === 'Roast'}
          register={register}
          onSelect={() => handleSelectCardType('Roast')}
        />

        {/* Special Card */}
        <CardTypeOption
          type="Special"
          imagePath="/special.png"
          cost="500,000 🔥"
          isSelected={watchCardType === 'Special'}
          register={register}
          onSelect={() => handleSelectCardType('Special')}
        />

        {/* Parody Card */}
        <CardTypeOption
          type="Parody"
          imagePath="/parody.png"
          cost="250,000 🔥"
          isSelected={watchCardType === 'Parody'}
          register={register}
          onSelect={() => handleSelectCardType('Parody')}
        />

        {/* Fusion Card */}
        <CardTypeOption
          type="Fusion"
          imagePath="/fusion.png" // Updated to correct fusion.png image
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
  imagePath: string;
  cost: string;
  isSelected: boolean;
  register: StepProps['register'];
  onSelect: () => void;
}

const CardTypeOption: React.FC<CardTypeOptionProps> = ({
  type,
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
        value={type}
        {...register('cardType')}
        className="hidden"
        onChange={onSelect}
      />
      <div className="flex flex-col items-center">
        <div className="w-full h-32 mb-3 overflow-hidden rounded-lg flex items-center justify-center relative">
          <Image 
            src={imagePath} 
            alt={`${type} Card Type`}
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'contain' }}
            className="rounded-lg"
          />
        </div>
        <h3 className="text-xl font-bold">{type}</h3>
        <p className="text-sm text-gray-300">{cost}</p>
      </div>
    </label>
  );
};

export default CardTypeStep;
