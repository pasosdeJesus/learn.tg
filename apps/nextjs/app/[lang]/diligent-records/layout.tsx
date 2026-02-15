// apps/nextjs/app/[lang]/diligent-records/layout.tsx
'use client';

import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useState, useEffect } from 'react';

export default function DiligentRecordsLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { lang: string };
}) {
  const [isOnline, setIsOnline] = useState(true);
  const { status } = useSession();
  const { isConnected } = useAccount();
  
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
            <span>{isOnline ? (params.lang === 'es' ? 'En línea' : 'Online') : (params.lang === 'es' ? 'Fuera de línea' : 'Offline')}</span>
          </div>
          
          {isOnline && !isConnected && (
            <ConnectButton.Custom>
              {({ openConnectModal }) => (
                <button
                  onClick={openConnectModal}
                  style={{
                    backgroundColor: 'white',
                    color: '#2B6B4E',
                    border: 'none',
                    padding: '8px 16px',
                    borderRadius: '20px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    fontSize: '14px'
                  }}
                >
                  {params.lang === 'es' ? 'Conectar Wallet' : 'Connect Wallet'}
                </button>
              )}
            </ConnectButton.Custom>
          )}
          
          {isConnected && (
            <div style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '14px',
              fontFamily: 'monospace'
            }}>
              {useAccount().address?.slice(0,6)}...{useAccount().address?.slice(-4)}
            </div>
          )}
          
          {status === 'authenticated' && (
            <span style={{ fontSize: '18px' }} title={params.lang === 'es' ? 'Sesión firmada' : 'Signed session'}>
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
