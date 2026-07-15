# Wallet Auth — Custom Implementation

How wallet connection, SIWE authentication, and transaction signing work in
learn.tg after removing RainbowKit + wagmi (R-#186).

## Architecture

```
┌─────────────────────────────────────────────────┐
│                    App Layer                      │
│  ConnectWalletButton  WalletEventListener         │
│         │                    │                   │
│         ▼                    ▼                   │
│  window.ethereum (direct)   useSession()          │
│         │                    │                   │
│         ▼                    ▼                   │
│  ┌──────────┐    ┌──────────────────────┐        │
│  │  SIWE    │───▶│  NextAuth Session     │        │
│  │  sign    │    │  (JWT in cookie)      │        │
│  └──────────┘    └──────────┬───────────┘        │
│                             │                    │
│              ┌──────────────▼──────────────┐     │
│              │      useAuthAddress()        │     │
│              │  session ∥ localStorage      │     │
│              └──────────────┬──────────────┘     │
│                             │                    │
│         ┌───────────────────▼──────────────┐     │
│         │   usePublicClient / useWalletClient│     │
│         │   useWriteContract                │     │
│         │   (viem + custom(window.ethereum)) │     │
│         └──────────────────────────────────┘     │
└─────────────────────────────────────────────────┘
```

**Key principle:** NextAuth session JWT is the single source of truth for
user identity. Wallet connection state (wagmi) is no longer tracked
separately.

## Components

### ConnectWalletButton (`components/ConnectWalletButton.tsx`)

Custom connect/disconnect button. Replaces RainbowKit's `ConnectButton`.

**Connect flow:**
1. `window.ethereum.request({ method: 'eth_requestAccounts' })`
2. Ensure correct chain (Celo mainnet or Sepolia)
3. Get CSRF token from `/api/auth/csrf`
4. Build SIWE message with EIP-55 checksummed address (`getAddress()`)
5. Sign via `window.ethereum.request({ method: 'personal_sign', ... })`
6. POST to `/api/auth/callback/credentials`
7. Store `sessionAddress` + `authToken` in localStorage
8. Reload page (NextAuth reads session cookie on mount)

**Disconnect flow:**
1. Remove `sessionAddress` + `authToken` from localStorage
2. Call NextAuth `signOut({ redirect: false })`
3. Redirect to `/`

**Features:**
- i18n support (en/es)
- MiniPay auto-connect (detects `window.ethereum.isMiniPay`)
- EIP-55 address normalization (OneKey returns lowercase)
- Hydration-safe localStorage (useState + useEffect, no SSR mismatch)
- Chain detection + auto-switch with fallback to `wallet_addEthereumChain`

### WalletEventListener (`components/WalletEventListener.tsx`)

Mounts at layout level (`AppProvider`). Listens for wallet events and syncs
app state.

**Events handled:**

| Event | Action |
|-------|--------|
| `accountsChanged` with empty array | Clear localStorage + signOut |
| `disconnect` | Clear localStorage + signOut |
| `session?.address` becomes `null` | Clear localStorage (covers session expiry, signOut from another tab, etc.) |

When any of these fire, both `learn.tg.sessionAddress` and
`learn.tg.authToken` are removed from localStorage, and NextAuth signOut is
called.

## Hooks

### useAuthAddress (`lib/hooks/useAuthAddress.ts`)

Returns the authenticated user's address from NextAuth session, with
localStorage fallback for navigation persistence (NextAuth bug #5719).

```ts
const { address, sessionAddress, isAuthenticated } = useAuthAddress()
```

- `address` — session address or localStorage fallback
- `sessionAddress` — session address only (undefined if not authenticated)
- `isAuthenticated` — true if address exists from either source

Replaces `useAccount().address` from wagmi.

### usePublicClient (`lib/hooks/useWallet.ts`)

Creates a viem `PublicClient` using `window.ethereum` as transport.
Memoized — no state, no re-renders.

```ts
const publicClient = usePublicClient()
// → PublicClient with custom(window.ethereum) transport
```

### useWalletClient (`lib/hooks/useWallet.ts`)

Creates a viem `WalletClient` with the authenticated account from
`useAuthAddress()`.

```ts
const { data: walletClient } = useWalletClient()
// → WalletClient with account from NextAuth session
```

Returns `null` if not authenticated (no address available to sign).

### useWriteContract (`lib/hooks/useWriteContract.ts`)

Encodes contract calls with viem's `encodeFunctionData` and sends via
`window.ethereum.request({ method: 'eth_sendTransaction' })`.

```ts
const { data: hash, writeContract } = useWriteContract()

await writeContract({
  address: contractAddress,
  abi: contractAbi,
  functionName: 'transfer',
  args: [to, amount],
})
```

## localStorage Convention

Two keys managed by the auth system:

| Key | Purpose | Set by | Cleared by |
|-----|---------|--------|------------|
| `learn.tg.sessionAddress` | Wallet address for UI persistence | `ConnectWalletButton` on connect | `WalletEventListener` on disconnect/session loss |
| `learn.tg.authToken` | CSRF token reused as API auth token | `ConnectWalletButton` on connect | `WalletEventListener` on disconnect/session loss |

These survive NextAuth's `useSession()` losing state on client-side
navigation (bug #5719), ensuring the UI doesn't flash "Connect Wallet"
between page transitions.

The auth token is the SIWE nonce obtained via `getCsrfToken()` during the
connect flow. It's stored in `billetera_usuario.token` in the database
and sent with every authenticated API request. See
[SIWE Auth Flow](siwe-auth-flow.md) for the full protocol.

## Comparison with Previous Approach

| Aspect | Before (RainbowKit + wagmi) | After (custom) |
|--------|----------------------------|----------------|
| Connect button | `ConnectButton` from RainbowKit | `ConnectWalletButton` (own) |
| Wallet state | wagmi `useAccount()` | NextAuth `useSession()` |
| Public client | wagmi `usePublicClient()` | `usePublicClient()` (viem + custom transport) |
| Wallet client | wagmi `useWalletClient()` | `useWalletClient()` (viem + custom transport) |
| Contract writes | wagmi `useWriteContract()` | `useWriteContract()` (eth_sendTransaction direct) |
| Disconnect detection | wagmi events | `window.ethereum` events + session watch |
| Bundle impact | ~200KB (RainbowKit + wagmi) | ~5KB (custom hooks + viem utilities) |
| Navigation resilience | Fragile (wagmi state loss → reconnect popups) | Solid (NextAuth session + localStorage fallback) |

## Key Files

| File | Purpose |
|------|---------|
| `components/ConnectWalletButton.tsx` | Connect/Disconnect button with SIWE via window.ethereum |
| `components/WalletEventListener.tsx` | Wallet event listener + session-based auth cleanup |
| `lib/hooks/useAuthAddress.ts` | Unified hook: session ∥ localStorage |
| `lib/hooks/useWallet.ts` | usePublicClient + useWalletClient (viem, no wagmi) |
| `lib/hooks/useWriteContract.ts` | useWriteContract via eth_sendTransaction |
| `doc/siwe-auth-flow.md` | SIWE handshake protocol (NextAuth backend) |
| `REQ/186.md` | Full migration specification and history |
