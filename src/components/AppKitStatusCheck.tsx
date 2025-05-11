'use client';

import React, { useEffect, useState } from 'react';
import { useAppKitInitialized } from './AppKitProvider';

/**
 * A simple component to check and display the AppKit initialization status
 */
const AppKitStatusCheck: React.FC = () => {
  const isInitialized = useAppKitInitialized();
  const [windowStatus, setWindowStatus] = useState<string>('N/A');
  
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const checkStatus = () => {
      try {
        const status = (window as any).AppKitInitialized ? 'Initialized' : 'Not Initialized';
        setWindowStatus(status);
      } catch (error) {
        setWindowStatus('Error checking status');
      }
    };
    
    checkStatus();
    
    // Check every second
    const interval = setInterval(checkStatus, 1000);
    return () => clearInterval(interval);
  }, []);
  
  return null;
};

export default AppKitStatusCheck;
