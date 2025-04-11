import { UseFormRegister, UseFormWatch, UseFormSetValue, FieldErrors } from 'react-hook-form';

export type CardType = 'Project' | 'Founder' | 'Crofam' | 'Influencer' | 'Event' | 'Roast' | 'Special' | 'Parody' | 'Fusion';
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary' | 'Mythical';

export interface FormInputs {
  cardType: CardType;
  rarity: Rarity;
  animated: boolean;
  name: string;
  description: string;
  socialLink: string;
  email: string;
}

export interface StepProps {
  register: UseFormRegister<FormInputs>;
  watch: UseFormWatch<FormInputs>;
  setValue: UseFormSetValue<FormInputs>;
  errors: FieldErrors<FormInputs>;
  onNext: () => void;
  onBack?: () => void;
  burnAmount?: number;
}
