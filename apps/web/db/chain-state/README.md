# Chain state (journal of an on-chain migration)

One JSON per migration, written by the migration itself:

```
LearnTGVaults-v5-to-v6-<network>.json            the journal
LearnTGVaults-v5-to-v6-<network>-guidepaid.json  per-pair progress of a long copy
```

It is **not** a backup. `db/backups/` holds the `pg_dump` output: disposable, gitignored,
restorable with `bin/m db:structure:load`. This folder holds numbers that **no longer exist
on-chain** once a migration zeroes the source books, plus every transaction hash of the
migration. It is the audit trail and the resume point, so it is kept and committed.

Producer and schema: `apps/web/lib/chain-state.ts` (`openChainState`). The current consumer is
`db/migrations/next/20261030_contract-to-v6.ts`.

## File shape

```json
{
  "schema": 1,
  "contract": "LearnTGVaults",
  "from": "V5",
  "to": "V6",
  "network": "celo",
  "chainId": 42220,
  "addresses": { "from": "0x4d16…", "to": "0x…", "usdt": "0x4806…", "slearn": "0x27fd…" },
  "createdAt": "…",
  "updatedAt": "…",
  "status": "running | verified | failed",
  "snapshot": [ /* the per-course books before moving anything */ ],
  "pending": { "drainUsdt": "8248137" },
  "transactions": [ { "step": "pause SLEARN", "hash": "0x…", "at": "…" } ],
  "problems": ["…"],
  "pausedByUs": false,
  "drainedUsdt": "0",
  "drainedSlearn": "0"
}
```

`status` is explicit, never inferred. `pending` holds a value written **before** an
irreversible step and cleared after it, so a crash in between is reconciled on the next run
instead of double counting or forgetting tokens. The base fields (`contract`, `from`, `to`,
`network`, `chainId`, `addresses`, `schema`) are validated when the file is reopened: a
journal from another network, chain, schema or pair of contracts is refused, not reused.

## Rules

- Written before the first transaction; the snapshot is the only copy of the source books
  after they are zeroed.
- The network and the versions are part of the name, the chain and the addresses are part of
  the content: the file cannot be used by accident on another deployment.
- Keep it after the migration: it answers "which transactions moved this money and what were
  the books before".

## Moving this to `m`

`apps/web/lib/chain-state.ts` has no project imports (only `fs` and `path`) and no knowledge of
LearnTGVaults: it is the candidate for `@pasosdejesus/m/blockchain/chain-state`, so the next
project (or the ClusterFunds and SLEARN migrations here) reuse the same journal instead of
reinventing it. Proposed surface, already implemented locally:

```ts
import { baseChainStateFile, chainStatePath, openChainState } from '@pasosdejesus/m/blockchain/chain-state'

const store = await openChainState<MyFile>({
  dir: path.join(process.cwd(), 'db', 'chain-state'),
  contract: 'ClusterFundsV2', from: 'V2', to: 'V3', network, chainId,
  addresses: { from, to },
  create: () => ({ ...baseChainStateFile({ contract, from, to, network, chainId, addresses: { from, to } }), mySnapshot }),
})
store.file               // loaded (resume) or created
store.recordTx(step, hash)
store.setPending('drain', amount) / store.getPending('drain') / store.clearPending('drain')
store.markVerified() / store.fail(problems)
```

With it, an `m` command could be `m chain:state:show <file>` (print the snapshot, the pending
values and the transactions) and `m chain:state:verify <file>` (status, problems, last hash),
reusable by any migration written with the library.
