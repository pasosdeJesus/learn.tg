# GoodDollar UBI: direct on-chain claim

How learn.tg claims the daily GoodDollar UBI (G$) **without** `@goodsdks/citizen-sdk`
and without forcing a face verification that the protocol does not require. This is
the analysis behind https://github.com/pasosdeJesus/learn.tg/issues/275 and the code
that implements it. Read it before touching the GoodDollar claim
(`components/GoodDollarClaimButton.tsx`, `lib/gooddollar-protocol.ts`).

The reference implementation is the official GoodDollar browser wallet,
`github.com/GoodDollar/GoodWallet` (see *GoodWallet reference* below).

---

## 1. Why the citizen-sdk is not in the claim path

The original button claimed through `@goodsdks/citizen-sdk`
(`new IdentitySDK(...)`, `new ClaimSDK(...)`, `claimSDK.claim()`). The SDK is not
just a helper: it enforces its own client-side **verification-freshness policy**.
When it decides the address needs a fresh face verification it redirects to
`goodid.gooddollar.org`, throws `Error: User requires identity verification.`, and
the claim never happens, **even for a whitelisted address the protocol would pay
immediately**. It also makes learn.tg depend on GoodDollar's services
(`goodid.gooddollar.org`, `goodserver.gooddollar.org`): if either is down, the
button cannot complete even for an already-verified learner.

Measured on Celo mainnet (2026-10-01) for the address that hit the gate:

| Call | Result |
|---|---|
| `IdentityV2.getWhitelistedRoot(address)` | the address itself, so **whitelisted** |
| `IdentityV2.getWhitelistedOnChainId(address)` | **42220** (Celo) |
| `IdentityV2.lastAuthenticated(address)` | 21 days old |
| `UBIScheme.checkEntitlement(root)` | `114579521971939197166`, so **UBI available today** |

There was no whitelist, chain or entitlement problem: the demand was the SDK's own
freshness rule. The protocol has no such gate. A direct CLI claim proved it with
real money: tx
`0x31d264ee2f04e28cd5296d60e37850b23aefc55812e84f41d32d933d6435d358`, status
success, `to` the UBIScheme, input `0x4e71d92d` (`claim()`), a `Transfer` of
114.579521971939197166 G$ to the address, and `checkEntitlement` became 0 while
`lastAuthenticated` stayed 21 days old. The claim needed no FaceTec re-verification.

## 2. The direct claim (what learn.tg does now)

Read the protocol and act, the same flow as GoodWallet:

1. `IdentityV2.getWhitelistedRoot(address)`. If the root is not `zeroAddress`, the
   address is whitelisted.
2. If whitelisted, `UBIScheme.checkEntitlement(root)`. If `> 0`, there is UBI today.
3. `resolveGoodDollarAction({ chainId, whitelisted, entitlement })` decides:
   - **`direct-claim`**: `UBIScheme.claim()` signed by the wallet, no GoodID;
   - **`verify`**: sign the fixed FV message (`personal_sign`) and redirect to
     GoodID; on return, `syncWhitelist` and re-read;
   - **`nothing-today`**: honest message ("you already claimed today"), disabled;
   - **`unsupported-chain`**: honest message, disabled (GoodDollar has no UBI on
     Celo Sepolia).
4. On mount, `parseGoodIdReturn(window.location.href)` handles the GoodID return:
   `verified=true` calls `GET goodserver.gooddollar.org/syncWhitelist/{address}`
   before reading; `verified=false` shows the reason.
5. `detectProtocolChange({ chainId, identityHasCode, ubiHasCode, ubiPaused, gDecimals })`
   reports a protocol change as its own message instead of failing opaquely.

`@goodsdks/citizen-sdk` stays **installed but out of the runtime claim path**: it is
only the source the protocol tests cross-check against, so a redeploy or a changed
message fails a test instead of breaking silently.

Two details that mattered in the browser (2026-10-02):

- `useWriteContract` must send `eth_sendTransaction` with `from`, otherwise the
  in-app provider fills a bad nonce and the RPC answers `-32602 Invalid params`.
- The FV message and the GoodID `account` parameter must use the **EIP-55
  checksummed** address. A lowercase address (what `useAuthAddress()` returns) makes
  GoodID answer "Login information is missing".

## 3. Code map

| Piece | File |
|---|---|
| The protocol in one place: addresses, ABIs, selectors, G$ decimals, FV message, GoodID link builder, `resolveGoodDollarAction()`, `detectProtocolChange()`, `parseGoodIdReturn()` | `apps/nextjs/lib/gooddollar-protocol.ts` |
| Why the button can or cannot act (`ready`, `no-wallet`, `locked`, `provider-unsupported`, `network-unsupported`, `sdk-error`) | `apps/nextjs/lib/gooddollar-reason.ts` |
| The button: reads the protocol, resolves the action, writes `claim()` or redirects to GoodID; `data-reason`, `data-action`, `data-testid` | `apps/nextjs/components/GoodDollarClaimButton.tsx` |
| Cross-checks every constant against the installed official SDK | `apps/nextjs/lib/__tests__/gooddollar-protocol.test.ts` |
| The four actions, the button states, no SDK mocks | `apps/nextjs/components/__tests__/GoodDollarClaimButton.test.tsx` |
| Direct-claim reference for cron (checks whitelist and entitlement, signs and broadcasts `claim()`, `--dry-run` to only read) | `apps/nextjs/scripts/claim-gooddollar-ubi.mjs` |
| E2E, production only: unverified wallet resolves to `verify` and opens GoodID without sending a transaction | `apps/nextjs/e2e/specs/gooddollar-not-whitelisted.spec.mjs` |
| E2E, production only: verified wallet resolves to `direct-claim` and claims | `apps/nextjs/e2e/specs/gooddollar-claim-real.spec.mjs` |

## 4. Protocol constants (Celo mainnet)

From the official SDK's `chainConfigs[42220].contracts.production`, the same source
GoodWallet uses:

| Value | Celo mainnet |
|---|---|
| Chain ID | `42220` (`50` Fuse, `122` XDC also supported by the protocol; Celo Sepolia has no UBI) |
| `IdentityV2` | `0xC361A6E67822a0EDc17D899227dd9FC50BD62F42` |
| `UBIScheme` | `0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1` |
| G$ (ERC-20) | `0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A` |
| G$ decimals | **18** (2 on Fuse) |
| `claim()` selector | `0x4e71d92d` |
| GoodID / backend | `https://goodid.gooddollar.org` / `https://goodserver.gooddollar.org` |

The fixed message signed for the face verification (`GOODDOLLAR_FV_MESSAGE`) is the
same string GoodWallet sends. `goodDollarProtocolSignature()` joins the watched
values into one stable string for logs and events.

## 5. GoodWallet reference

The pattern imitated is the official browser wallet. The clone used for the analysis
lives on the development VM:

- Local clone: `/var/www/adJ-ia/GoodWallet` (Next.js, `version` 2.1.2)
- Upstream: https://github.com/GoodDollar/GoodWallet
- Commit analysed: `a2e66c4e6cbd141bf2c78226911177bf5e0b6ff7` (2026-09-09)

It does **not** use `@goodsdks/citizen-sdk`; it claims against the contracts directly
with `@gooddollar/goodprotocol` ABIs plus ethers v6. learn.tg imitates the flow and
stays on viem.

| What to compare against | File in the clone |
|---|---|
| Whitelist read (`getWhitelistedRoot` / `getWhitelistedOnChainId`, `isWhitelisted = root !== zeroAddress`) | `src/gooddollar/stores/identityStore.ts` |
| Fixed FV message (`FV_IDENTIFIER_MSG2`), `generateGoodIDLink`, `parseGoodIDRedirectUrl`, `syncWhitelist` | `src/gooddollar/methods/goodid.ts` |
| Entitlement and claim (`checkEntitlement`, `paused`, `currentDay`, `periodStart`, `getDailyStats`, `dailyCyclePool`, `encodeMethodCall(UBIScheme, 'claim')`) | `src/gooddollar/stores/ubiStore.ts` |
| Where the return is handled (`syncWhitelist`, `:393`) and GoodID is opened (`window.open(link, "_self")`, `:558-563`) | `src/sections/GoodDollar/components/Claim/ClaimView.tsx` |
| ABI and address source (`@gooddollar/goodprotocol` `artifacts/abis/*.min.json`, `releases/deployment.json`, `getG$ContractAddress`) | `src/gooddollar/contracts/pool.ts`, `src/gooddollar/config.ts` |
| Divvi attribution (`GD_DATASUFFIX`, `submitReferral`) | `src/gooddollar/methods/divvi.ts` |

Addresses come from `@gooddollar/goodprotocol/releases/deployment.json`, network key
`<env>-celo` for Celo.

## 6. Testing

Unit (make sure the protocol constants still match the installed SDK and the button
resolves the four actions):

```sh
cd apps/nextjs
make type
make test-lib test-components
```

E2E (production only, because GoodDollar has no UBI on Celo Sepolia):

```sh
# unverified address (apps/.env): resolves to verify, opens GoodID, sends no transaction
CHROME_PATH=/usr/local/bin/chrome make test-e2e-gooddollar-not-whitelisted

# verified address: resolves to direct-claim and claims
PROD_SPECS=1 GOODDOLLAR_WALLET=external GOODDOLLAR_PRIVATE_KEY=0x... \
  CHROME_PATH=/usr/local/bin/chrome IPDES=learn.tg PUERTOPRU=443 CHAIN_ID=42220 \
  SITE_URL=https://learn.tg bin/m test:e2e gooddollar-claim-real
```

Both specs import the wallet through the UI and its SIWE reloads the page, so they
use an incognito context, wait for the session by two signals
(`wallet-selector-in-app` or `learn.tg.sessionAddress`) and unlock the wallet if it
came back `data-reason="locked"`.

## 7. Maintenance: noticing protocol changes

GoodDollar can change its contracts or the FV message without notice.
`detectProtocolChange()` in the button reports a change as its own message, and
`lib/__tests__/gooddollar-protocol.test.ts` cross-checks every constant against the
installed SDK. When the SDK updates, run the tests and update the constants here and
in `lib/gooddollar-protocol.ts` together.

## 8. Status and follow-ups

Closed on production (2026-10-08): the operator ran the two manual checks that cannot
be automated, and both work —

1. A real `direct-claim` on mainnet with a **verified** address (a little CELO for
   gas; the reference run cost about 0.065 CELO).
2. The `verify` path end to end with a real face (FaceTec cannot be automated):
   GoodID returns `verified=true`, learn.tg calls `syncWhitelist`, re-reads, and the
   profile gets `lastgooddollarverification` (7 points).

Not blocking, still open:

3. `firstname` for the GoodID link: today the account is sent; if a profile name is
   wanted it has to come from the session.
4. Divvi attribution (`GD_DATASUFFIX`) is dropped by the direct claim; out of scope,
   but state it if the project ever wants the referral.
