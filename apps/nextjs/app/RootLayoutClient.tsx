'use client';

import { usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import { AppProvider } from '@/providers/AppProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from '@pasosdejesus/m/shadcn-components/ui/toaster'

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Detectar si es diligent-records
  const isDiligentRecords = pathname?.includes('/diligent-records') || false;
  
  return (
    <ErrorBoundary>
    <AppProvider>
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
    </ErrorBoundary>
  );
}
