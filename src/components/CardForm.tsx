'use client';

import React from 'react';
import CardFormContainer from './CardForm/CardFormContainer';

// No props needed as CardFormContainer now handles wallet connection internally
const CardForm: React.FC = () => {
  return <CardFormContainer />;
};

export default CardForm;
