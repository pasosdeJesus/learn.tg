
# 1. Voluntary audit from KupiaSec

We received the following email from sales@kupia.io

Hi Vladimir,

We came across learn.tg while looking at new projects on Celo and read the
contracts in pasosdeJesus/learn.tg at the latest commit.

The issue (Unaudited change)
Where: apps/contracts/contracts/SLEARN.sol processPayment with its
_distributeVault and _distributeMissional helpers, LearnTGVaultsV5.sol
payScholarship and ClusterFundsV2.sol, reworked in the "New structure" and
"improve contracts" commits of 21 and 23 Oct 2026.
What we saw: we found no audit of any version. SLEARN sends the USDT half to
learnTGVault but mints the SLEARN half to learnTGVaultSLEARN, a separately set
address, and then records both amounts on learnTGVault through
recordCourseFunds. payScholarship only checks one course's recorded balance
against the whole contract balance, never the sum of all courses.
What we would check first: whether the recorded per-course balances can add up
to more than the vault really holds, so a scholarship for one course is paid out
of USDT or SLEARN that was raised for another course, and the last students in
line get ScholarshipInsufficientFunds.
We have not tested this against your live deployment, so please verify on your
side.

Why we think this is more than one line item
- SLEARN is backed by USDT in hot reserves (learnTgReserve, stableSlReserve)
  that processPayment and redeemForSLE pull from with transferFrom, so the
backing depends on every rate and allowance staying in line with
usdtToSlearnRate.
- ClusterFundsV2 lets the fee wallets reach 100% while donor cashback can add up
  to 50% more, so a donation could revert or be split differently than the donor
was told.
- The money is scholarships, UBI and donations for learners, and four vault
  versions (V3 to V5) plus two ClusterFunds versions sit in the repo, so it
matters which one holds funds today.

Offer
If a follow-up review would be useful, we would be glad to scope a private
audit: full coverage of SLEARN, LearnTGVaultsV5, ClusterFundsV2 and CeloUbi plus
the deployment and role configuration, with proof-of-concept tests for anything
we confirm. Happy to send our methodology and a fixed quote.

About us: our auditors have earned up to $250k in a single Curve bounty, with 13
first places and 36 top-3 finishes in public contests. The fix review is
included, at a competitive price.

sec.kupia.io
Nordin Sabli, KupiaSec


# 2. Our answer

Thanks for your time and effort reporting.

Based in your report we couldn't find a vulnerability but just bad
accounting practices in the contract, a lack o policy to retire
vaults and an incomplete retiring of the course with id 106 when V2 of
LearnTGVault was running, that lead to a difference of 8 USDT between
what was reported and the crypto available in the contract.

To correct the problem we have:

1. Started the version 6 of the contract solving the accounting problems
   and including a policy to retire a vault.
2. Adjusted to 0 the value reported in the retired course 106

With this the difference between the crypto available and the sum of what 
is reported is less than 0.05 USDT that we guess could be due to 
differences in rounding.

To acknowledge you, we have just created a document:
https://github.com/pasosdeJesus/learn.tg/blob/main/audit/KupiaSec.md

As you can see at https://learn.tg/en/transparency our economy is tiny,
learn.tg is far from being economically profitable, currently it is 
a commitment from me and my experience with God. Unfortunately we don't
count with the resources for a full audit from you. However if you want
to do a partial audit for a tiny stipend (let's say 50 USDT), we will
do our effort to raise that for you.


Blessings
