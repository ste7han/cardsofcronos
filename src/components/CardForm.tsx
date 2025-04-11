'use client';

import React from 'react';
import InitializedCardFormContainer from './CardForm/InitializedCardFormContainer';

// Use the wrapper component that ensures AppKit is initialized
const CardForm: React.FC = () => {
  return <InitializedCardFormContainer />;
};

export default CardForm;
