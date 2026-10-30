# V5 -> V6 migration (not wired to `db:migrate`)

`20261030_contract-to-v6.ts` mirrors a scholarship vault from `LearnTGVaultsV5` to
`LearnTGVaultsV6`: it moves the tokens, copies the per-course books and the `guidePaid`
records, and repoints SLEARN. It lives **here, in a subdirectory**, because
kysely-ctl only reads the files directly under `db/migrations` (`readdir`, not
recursive), so `bin/m db:migrate` will not run it until it is moved one level up. The
loader proves it on every run with `WARN Ignoring next - not a TS file`.

The module was loaded once through `bin/m db:migrate` with the file in place: it
resolves its imports (viem, ethers, the JSON ABIs, `_lib`) and stops at the preflight
with `LearnTGVaults V6 not deployed — address not found`, as intended.

Read `doc/LearnTGVaultsV6.md` and `REQ/221` first: this script exists because the
V3→V4 migration was run twice on 2026-06-09/10 and its `setVaultBalance` re-applied the
snapshot, leaving 0.040910 USDT of extra books. Everything below is meant to make that
impossible.

## What it does, in this order

1. **Preflight, read-only, or resume.** On a fresh run it checks both contracts' `VERSION`
   (5 and 6), that both use the same USDT/SLEARN, that the source is not `accountingBroken`,
   that `Σ books ≤ held`, and that the target is **empty**: no balances, no vaults, zero
   `totalRecorded*`, not broken. Any of these fails and nothing is written. If the **state
   file** already exists it resumes from it instead (see below).
2. **Journal.** `db/chain-state/LearnTGVaults-v5-to-v6-<network>.json` is written before the first
   transaction: the per-course snapshot (the only copy of the numbers once the source books are
   zeroed), `drainedUsdt/Slearn`, `pausedByUs`, every transaction hash and, at the end,
   `status`/`problems`; `db/chain-state/LearnTGVaults-v5-to-v6-<network>-guidepaid.json` is the
   progress of the `guidePaid` copy. Both are handled by `apps/web/lib/chain-state.ts`, a
   project-agnostic journal (`db/chain-state/README.md`) meant to move into `m`.
3. **Stop if `V6_MIGRATION_DRY_RUN=1`.** The dry run prints the table (with how much was
   already drained and how many transactions are recorded) and exits.
4. **Pause SLEARN** (`pause()`, `onlyAdmin`) so no purchase can land in the middle.
5. **Zero the source books** with `setVaultBalance(courseId, 0, 0)` for every course with a
   balance. First it reads them again: if any book moved since the snapshot it stops instead of
   zeroing a number the migration does not own.
6. **Drain the source**: `emergencyWithdrawUSDT(held)` / `SLEARN`. With the books at zero the
   contract allows it (V6's rule, and V5 permits any amount).
7. **Send the same amounts to V6** (owner transfer, one tx per token).
8. **Create the vaults and set the balances** in V6. The tokens go in first on purpose: V6's
   `setVaultBalance` refuses a balance the contract cannot back, so the order cannot be inverted.
9. **Repoint SLEARN** at V6 (`setLearnTGVault`, `setLearnTGVaultSLEARN`), authorize SLEARN on V6
   (`setSlearnContractRole`) and V6 on SLEARN (`addAuthorizedTransfer`).
10. **Copy `guidePaid`** from the source, in batches, with a progress file for resume.
11. **Verify** `accountingState()`: `Σ recorded == snapshot`, `held == drained`, `broken ==
    false`, and every balance matches. Only then **unpause** SLEARN (if this migration paused it).
12. Print the next steps and keep the state file with the hashes.

Every write is recorded with its transaction hash in the state file, so the operator can
check them one by one on Blockscout.

## Idempotent and resumable

Each step reads the chain and acts only on the difference, so an interrupted run continues
where it stopped: run the same command again (the state file is detected and used). In
particular:

| Step | What a re-run does |
|---|---|
| pause | sees `paused` and does nothing |
| zero books | skips the courses already at 0, and stops if a book changed since the snapshot |
| drain | withdraws only what is still in the source; a withdrawal that was sent just before a crash is reconciled from `pendingDrainUsdt/Slearn` (if the balance is 0 it went through) and counted once |
| send to V6 | transfers only the difference between `drained` and what V6 holds; aborts if V6 holds more |
| createVault / setVaultBalance | skips what already exists and what already matches the snapshot |
| SLEARN repoint | compares every address/role and sets only what differs |
| guidePaid | uses its own progress file, one key per (user, course, guide) |

The one thing it cannot fix by itself is a purchase or a payment that moved a book between the
snapshot and the zeroing: it stops with "the source books changed since the snapshot" and the
operator reconciles by hand.

## Safety rails

| Guard | Why |
|---|---|
| `V6_MIGRATION_CONFIRM=<network>` required for writes | a typo cannot sweep mainnet |
| `V6_MIGRATION_DRY_RUN=1` is the default when the runner is used without the variable | look before touching money |
| refuses a non-empty target **without** a state file | a foreign or half-done migration stops instead of re-applying a snapshot; with a state file it resumes |
| fails if a book moved since the snapshot | a purchase during the window would make the restored numbers lie |
| verifies `Σ books ≤ held` in the source before pausing | `make vault-check` must be green first |
| pauses SLEARN for the whole window | no purchase can land in the old vault after the sweep |
| writes the balances only after the tokens arrive | V6 enforces it too, but the script should fail before the transaction |

## Running it

It runs with the project's migration runner (kysely-ctl + jiti), never with `tsx`: viem's
subpaths do not resolve under that loader on this platform. So the file first moves up one
level, which is also the moment it becomes a recorded migration:

```sh
cd apps/web
# 1. Deploy V6 (operator): cd apps/contracts && bin/next/deployLearnTGVaultsV6
# 2. Move the file into the migration folder:
git mv db/migrations/next/20261030_contract-to-v6.ts db/migrations/
# 3. Look at the plan. It raises on purpose, so the migration is NOT recorded:
V6_MIGRATION_DRY_RUN=1 bin/m db:migrate
# 4. Execute it (kysely-ctl records it as applied, which stops re-runs):
V6_MIGRATION_CONFIRM=<celo|celoSepolia> bin/m db:migrate
# 5. Verify:
make vault-check ARGS="--network celo"     # now reads accountingState() on V6
```

`V6_ADDRESS=0x…` overrides the address from `deployments/LearnTGVaults/V6/<network>.json`
(useful right after a testnet deploy, before the JSON is committed).

If step 4 aborts halfway, do not re-run it: the target is no longer empty, so the preflight
stops with "the target vault is not empty". Reconcile by hand with the backup JSON (it lists
every transaction hash) and only then resume.

`bin/m db:migrate` of this `m` version **exits 0 even when a migration fails** (the error is
printed and the migration is not recorded). Trust the log and this query, not the status:

```sh
bin/m db:console "SELECT name FROM kysely_migration ORDER BY name DESC LIMIT 3"
```
`down()` is empty on purpose: tokens and balances moved; a rollback is a manual migration.
