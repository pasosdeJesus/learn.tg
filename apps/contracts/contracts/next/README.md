# V6 (not deployed)

`LearnTGVaultsV6.sol` is the next scholarship vault: same interface as V5 plus
self-enforcing accounting (`totalRecordedUsdt/Slearn` never above the tokens held,
`retireCourse`, float-only emergency withdrawals, `accountingState()`).

**Settled (2026-11-21):** the "already paid" guard stays keyed by address
(`guidePaidUSDT[courseId][guideId][student]`). The "one guide, one payment per account" rule is
enforced in the backend and the database, not on-chain, so that the link between a person's
wallets is never published — it would undermine the decision not to publish completions of
category B courses and would add identification risk for students in a classified region.
See R-#303 (https://github.com/pasosdeJesus/learn.tg/issues/303) §6. Do not add an account key
to this contract without revisiting that decision.

It lives in this `next/` folder, with its tests in `test/next/`, so the code of the
versions in production stays apart from what is being designed and tested. Its
tests are part of the normal `pnpm test`.

Design, evidence and the migration rule: R-#293 (https://github.com/pasosdeJesus/learn.tg/issues/293)
and R-#221 (the finding).
Deploy with `bin/next/deployLearnTGVaultsV6` once the operator decides; the entrypoint and
its run script live in `bin/next/` and `scripts/next/`, and the ABI is synced to
`apps/web/abis/next/`.
