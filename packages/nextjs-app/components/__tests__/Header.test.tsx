import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Header from '../Header';
import '@testing-library/jest-dom';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { mainnet } from 'wagmi/chains';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider } from '@rainbow-me/rainbowkit';

const config = createConfig({
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(),
  },
});
const queryClient = new QueryClient();
function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={config}>
        <RainbowKitProvider>{ui}</RainbowKitProvider>
      </WagmiProvider>
    </QueryClientProvider>
  );
}

describe('Header', () => {
  it('renders logo and title in English', () => {
    renderWithProviders(<Header lang="en" />);
    expect(screen.getByAltText('imglogo')).toBeInTheDocument();
    expect(screen.getByText(/Learn through games/)).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/');
  });

  it('renders title in Spanish', () => {
    renderWithProviders(<Header lang="es" />);
    expect(screen.getByText(/Aprender mediante juegos/)).toBeInTheDocument();
  });

  it('shows ConnectButton when MiniPay is not present', () => {
    renderWithProviders(<Header lang="en" />);
    expect(screen.getByText(/Connect/)).toBeInTheDocument();
  });

  it('hides ConnectButton when MiniPay is present', () => {
    window.ethereum = { isMiniPay: true };
    renderWithProviders(<Header lang="en" />);
    expect(screen.queryByText(/Connect/)).not.toBeInTheDocument();
  });
});
