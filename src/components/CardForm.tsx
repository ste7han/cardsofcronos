'use client';

import React from 'react';
import CardFormContainer from './CardForm/CardFormContainer';

interface CardFormProps {
  isWalletConnected: boolean;
  onConnectWallet: () => void;
}

const CardForm: React.FC<CardFormProps> = ({ isWalletConnected, onConnectWallet }) => {
  return (
    <CardFormContainer 
      isWalletConnected={isWalletConnected} 
      onConnectWallet={onConnectWallet} 
    />
  );
};

export default CardForm;
