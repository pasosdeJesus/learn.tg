// apps/nextjs/app/[lang]/diligent-records/layout.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useAuthAddress } from '@/lib/hooks/useAuthAddress';
import { ConnectWalletButton } from '@/components/ConnectWalletButton';
import { useState, useEffect, use, useMemo } from 'react';
import { createComponentT } from '@/lib/hooks/useTranslation';

export default function DiligentRecordsLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const resolvedParams = use(params);
  const { lang } = resolvedParams;
  const [isOnline, setIsOnline] = useState(true);
  const { status } = useSession();
  const { address, isAuthenticated } = useAuthAddress();
  const t = useMemo(() => createComponentT(lang, {
    en: { online: 'Online', offline: 'Offline', connectWallet: 'Connect Wallet', signedSession: 'Signed session' },
    es: { online: 'En línea', offline: 'Fuera de línea', connectWallet: 'Conectar Wallet', signedSession: 'Sesión firmada' },
  }), [lang]);
  
  useEffect(() => {
    setIsOnline(navigator.onLine);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: '#f5f5f5'
    }}>
      <header style={{
        backgroundColor: '#2B6B4E',
        color: 'white',
        padding: '12px 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '24px' }}>📋</span>
          <span style={{ fontWeight: 'bold' }}>Diligent Records</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '14px',
            backgroundColor: 'rgba(255,255,255,0.2)',
            padding: '4px 10px',
            borderRadius: '20px'
          }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isOnline ? '#4CAF50' : '#f44336',
              display: 'inline-block'
            }} />
            <span>{isOnline ? t('online') : t('offline')}</span>
          </div>
          
          {isOnline && !isAuthenticated && (
            <ConnectWalletButton lang={lang} />
          )}
          
          {isAuthenticated && address && (
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              {address.slice(0,6)}...{address.slice(-4)}
            </div>
          )}
          
          {status === 'authenticated' && (
            <span style={{ fontSize: '18px' }} title={t('signedSession')}>
              🔐
            </span>
          )}
        </div>
      </header>
      
      <main>
        {children}
      </main>
    </div>
  );
}
