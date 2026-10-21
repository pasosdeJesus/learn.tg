// Browser extensions — window.ethereum injected by Web3 wallets
export {}
declare global {
  interface Window {
    ethereum?: {
      isMiniPay?: boolean
      on: (event: string, callback: (...args: any[]) => void) => void
      removeListener: (event: string, callback: (...args: any[]) => void) => void
      request: (args: { method: string; params?: any[] }) => Promise<any>
    }
  }
}
