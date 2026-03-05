'use client';

import { useEffect, useState, use } from 'react';
import { useSession } from 'next-auth/react';
import { useAccount } from 'wagmi';
import Link from 'next/link';

const translations = {
  en: {
    title: "✝️ Diligent Records",
    status: "Status",
    installed: "✅ Installed as app",
    browser: "🌐 Browser view",
    wallet: "Wallet",
    notFound: "❌ Not found",
    signed: "🔐 (signed)",
    connected: "⚠️ (only connected)",
    securityWarning: "⚠️ For better security, sign the session using the 'Connect Wallet' button",
    daily: "📅 Daily Record (demo)",
    weekly: "📊 Weekly Record (demo)",
    monthly: "📈 Monthly Record (demo)",
    install: "📲 Install App",
    alreadyInstalled: "📱 The app is already installed",
    openFromApps: "To open as a standalone app, visit",
    chromeApps: "chrome://apps",
    footer: "\"The plans of the diligent lead to abundance\"",
    proverbs: "Proverbs 21:5",
    loading: "Cargando sesión...",
    noWallet: "🔌 Conecta y firma",
    noWalletInstructions: "Para usar Diligent Records, necesitas:",
    step1: "Conectar tu wallet",
    step2: "Firmar el mensaje de autenticación",
    connectButton: "Usa el botón 'Connect Wallet' en la esquina superior derecha",
  }
};

export default function DiligentRecordsPage({ params }: { params: Promise<{ lang: string }> }) {
  const resolvedParams = use(params);
  const { lang } = resolvedParams;
  const t = translations[lang as keyof typeof translations] || translations.en;
  
  const [isInstalled, setIsInstalled] = useState(false);
  const [wallet, setWallet] = useState<string | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  
  // Usar sesión (requiere haber firmado)
  const { data: session, status } = useSession();
  const { address } = useAccount();

  useEffect(() => {
    // Detectar si está instalada como PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
    
    // Prioridad 1: Usar la dirección de la sesión (ya firmó)
    if (session?.address) {
      localStorage.setItem('wallet_address', session.address);
      setWallet(session.address);
      console.log('✅ Wallet desde sesión (firmada):', session.address);
    }
    // Prioridad 2: Si no hay sesión pero hay cuenta conectada
    else if (address) {
      localStorage.setItem('wallet_address', address);
      setWallet(address);
      console.log('⚠️ Wallet desde cuenta (sin firma):', address);
    }
    // Prioridad 3: Intentar leer del localStorage (para offline)
    else {
      const savedWallet = localStorage.getItem('wallet_address');
      if (savedWallet) {
        setWallet(savedWallet);
        console.log('📴 Wallet desde localStorage (offline):', savedWallet);
      }
    }

    // Capturar evento de instalación
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });

    // Agregar link al manifest en el head
    const link = document.createElement('link');
    link.rel = 'manifest';
    link.href = '/manifest.json';
    document.head.appendChild(link);
  }, [session, address]);
  
  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };
  
  // Mostrar estado de carga mientras verifica sesión
  if (status === 'loading') {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <p>{t.loading}</p>
      </div>
    );
  }
  
  // Si no hay wallet, mostrar mensaje para conectar/firmar
  if (!wallet) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', maxWidth: '600px', margin: '0 auto' }}>
        <h2>{t.noWallet}</h2>
        <p>{t.noWalletInstructions}</p>
        <ol style={{ textAlign: 'left', margin: '20px auto', display: 'inline-block' }}>
          <li>{t.step1}</li>
          <li>{t.step2}</li>
        </ol>
        <p>{t.connectButton}</p>
      </div>
    );
  }
  
  // Determinar si la wallet es "firmada" o solo conectada
  const isSigned = session?.address === wallet;
  
  return (
    <div style={{ 
      maxWidth: '600px', 
      margin: '0 auto', 
      padding: '20px',
      fontFamily: 'system-ui, sans-serif',
      textAlign: 'center',
      backgroundColor: '#ffffff',
      minHeight: '100vh'
    }}>
      <h1 style={{ color: '#2B6B4E' }}>{t.title}</h1>
      
      <div style={{ 
        background: '#f0f0f0', 
        padding: '20px', 
        borderRadius: '10px',
        margin: '20px 0'
      }}>
        <p><strong>{t.status}:</strong> {isInstalled ? t.installed : t.browser}</p>
        <p>
          <strong>{t.wallet}:</strong> ✅ {wallet.slice(0,6)}...{wallet.slice(-4)}
          {isSigned ? ` ${t.signed}` : ` ${t.connected}`}
        </p>
        {!isSigned && (
          <p style={{ color: '#856404', background: '#fff3cd', padding: '10px', borderRadius: '5px' }}>
            {t.securityWarning}
          </p>
        )}
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '10px',
        maxWidth: '300px',
        margin: '0 auto'
      }}>
        <button 
          onClick={() => alert('Coming soon')}
          style={{
            padding: '15px',
            background: '#2B6B4E',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          {t.daily}
        </button>
        
        <button 
          onClick={() => alert('Coming soon')}
          style={{
            padding: '15px',
            background: '#4a6fa5',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          {t.weekly}
        </button>

        <button 
          onClick={() => alert('Coming soon')}
          style={{
            padding: '15px',
            background: '#8B4513',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          {t.monthly}
        </button>
      </div>
      
      {/* CASO 1: App NO instalada, vista en navegador */}
      {!isInstalled && !window.matchMedia('(display-mode: standalone)').matches && (
        <div style={{ 
          marginTop: '30px',
          padding: '15px',
          background: '#fff3cd',
          borderRadius: '5px'
        }}>
          {deferredPrompt ? (
            <button
              onClick={handleInstallClick}
              style={{
                padding: '10px 20px',
                background: '#2B6B4E',
                color: 'white',
                border: 'none',
                borderRadius: '5px',
                fontSize: '16px',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              {t.install}
            </button>
          ) : (
            <div style={{ 
              marginTop: '30px',
              padding: '15px',
              background: '#e8f5e9',
              borderRadius: '5px',
              color: '#2e7d32'
            }}>
              <p>📱 <strong>{t.alreadyInstalled}</strong></p>
              <p>{t.openFromApps}</p>
              <p style={{ 
                fontFamily: 'monospace', 
                background: '#fff', 
                padding: '8px', 
                borderRadius: '4px',
                display: 'inline-block'
              }}>
                chrome://apps
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* CASO 2: App SÍ instalada, pero vista en navegador */}
      {isInstalled && window.matchMedia('(display-mode: browser)').matches && (
        <div style={{ 
          marginTop: '30px',
          padding: '15px',
          background: '#e8f5e9',
          borderRadius: '5px',
          color: '#2e7d32'
        }}>
          <p>📱 <strong>{t.alreadyInstalled}</strong></p>
          <p>{t.openFromApps}</p>
          <p style={{ 
            fontFamily: 'monospace', 
            background: '#fff', 
            padding: '8px', 
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            chrome://apps
          </p>
        </div>
      )}
      
      {/* CASO 3: App abierta desde chrome://apps - NO mostrar mensaje de instalación */}
      
      <footer style={{ marginTop: '40px', color: '#666' }}>
        <p>{t.footer}</p>
        <small>{t.proverbs}</small>
      </footer>
    </div>
  );
}
