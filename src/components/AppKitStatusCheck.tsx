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
  
  return (
    <div className="fixed bottom-4 right-4 p-2 bg-black/50 backdrop-blur-sm rounded text-xs z-[1000]">
      <div>
        <span className="text-gray-400">Context: </span>
        <span className={isInitialized ? 'text-green-400' : 'text-red-400'}>
          {isInitialized ? 'Initialized' : 'Not Initialized'}
        </span>
      </div>
      <div>
        <span className="text-gray-400">Window: </span>
        <span className={windowStatus === 'Initialized' ? 'text-green-400' : 'text-red-400'}>
          {windowStatus}
        </span>
      </div>
    </div>
  );
};

export default AppKitStatusCheck;
