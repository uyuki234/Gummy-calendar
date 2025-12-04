import { useState } from 'react';
import { initTokenClient, ensureAccessToken } from '@/lib/auth';

export function useGoogleAuth() {
  const [isReady, setIsReady] = useState(false);

  const initialize = () => {
    initTokenClient();
    setIsReady(true);
  };

  const getAccessToken = async (): Promise<string> => {
    return ensureAccessToken();
  };

  return { isReady, initialize, getAccessToken };
}
