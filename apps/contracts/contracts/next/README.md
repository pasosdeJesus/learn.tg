# V6 (not deployed)

`LearnTGVaultsV6.sol` is the next scholarship vault: same interface as V5 plus
self-enforcing accounting (`totalRecordedUsdt/Slearn` never above the tokens held,
`retireCourse`, float-only emergency withdrawals, `accountingState()`).

It lives in this `next/` folder, with its tests in `test/next/`, so the code of the
versions in production stays apart from what is being designed and tested. Its
tests are part of the normal `pnpm test`.

Design, evidence and the migration rule: `doc/LearnTGVaultsV6.md` (R-#221).
Deploy with `bin/next/deployLearnTGVaultsV6` once the operator decides; the entrypoint and
its run script live in `bin/next/` and `scripts/next/`, and the ABI is synced to
`apps/web/abis/next/`.
