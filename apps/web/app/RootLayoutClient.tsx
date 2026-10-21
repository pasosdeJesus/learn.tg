'use client';

import { usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import { AppProvider } from '@/providers/AppProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ReferralCodeCapture } from '@/components/ReferralCodeCapture';
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar';
import { Toaster } from '@pasosdejesus/m/shadcn-components/ui/toaster'
import { logger, DebugConsole } from '@pasosdejesus/m/debug'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Enable floating debug console for mobile debugging
  if (typeof window !== 'undefined') {
    if (process.env.NEXT_PUBLIC_M_DEBUGGER_CONSOLE === '1') {
      (logger as any).floatingConsoleEnabled = true
    }
  }
  
  // Detectar si es diligent-records
  const isDiligentRecords = pathname?.includes('/diligent-records') || false;
  
  return (
    // `key={pathname}`: un error de una ruta no debe dejar la app atrapada en la página
    // de error al navegar a otra (reporte del operador, 2026-09-23: sin conexión, al
    // abrir el crucigrama solo decía "Connection Error" y no se podía salir).
    <ErrorBoundary key={pathname}>
    <AppProvider>
      <ReferralCodeCapture />
      <ServiceWorkerRegistrar />
      {isDiligentRecords ? (
        // Para diligent-records: SOLO AppProvider, sin Layout
        <div style={{ minHeight: '100vh' }}>
          {children}
        </div>
      ) : (
        // Para el resto: AppProvider + Layout normal
        <Layout>{children}</Layout>
      )}
    </AppProvider>
    <Toaster />
    {/* <DebugConsole /> */}
    <style>{`[data-slot=\"toast-viewport\"], ol.fixed.top-0 { max-width: 380px !important; width: auto !important; }`}</style>
    </ErrorBoundary>
  );
}
