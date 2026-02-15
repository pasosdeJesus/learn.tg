'use client';

import { usePathname } from 'next/navigation';
import Layout from '@/components/Layout';
import { AppProvider } from '@/providers/AppProvider';

export default function RootLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Detectar si es diligent-records
  const isDiligentRecords = pathname?.includes('/diligent-records') || false;
  
  return (
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
  );
}
