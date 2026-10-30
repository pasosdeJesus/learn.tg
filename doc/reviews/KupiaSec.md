# 1. Voluntary review from KupiaSec

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

Thanks for your time and effort in reviewing the contracts.

We couldn't reproduce an exploitable vulnerability but just found bad
accounting practices in the contract (as you pointed out), a lack of
policy to retire vaults and a mistake with the retired course 106 
when the version 2 of LearnTGVault was running, which led to a difference of 
8 USDT between what was reported and the crypto available in the contract
(we think that the course was retired in the database but we donated 10USDT
 to it by mistake, adding 8 to its balance, when we realized, we withdrew
the 8 USDT  with an emergency withdrawal, but forgot to put its balance in 0).

| Date (UTC) | Block | Transaction | What it shows |
|---|---|---|---|
| 2026-01-13 21:04:31 | 56,437,513 | `0xb2440af75b9a01d6ceeb1451ad627c34d1a6b960304ab2e46d5d84fd9d29162b` | `deposit(106, 10000000)` on V2: 2.00 USDT fee + **8.00 USDT to the vault**, `balanceUsdt = 8000000` |
| 2026-01-13 21:06:12 | 56,437,614 | `0x6f22cc3aa5ba531cda22b0d5fa512cb1457018ee92b3901b53104d548600e0e2` | `emergencyWithdrawUsdt(8000000)` on V2: the 8 USDT go back to the owner **and course 106 keeps its 8 USDT on the books** (there is no call to zero them) |
| 2026-06-02 06:19:08 | 68,480,390 | `0x101de78b5611cd1dbba5398ef033a3026d6dad25be596294d92152928c6284ab` | `emergencyWithdrawUsdt(8248137)` on V2: the whole balance to the owner, books untouched |
| 2026-06-02 06:19:11 | 68,480,393 | `0x846f46d841f59221100090ef7f9f91993387a35183353656130993b1231171ff` | the same **8,248,137** sent to V3: the withdrawal was the first half of the migration |
| 2026-06-09 18:43:36 | 69,129,858 | `0xa3ec6a919b33bd23a2e62f1ef027eca8ab44ece6bb36f4dc74c90c689e61d351` | V3 swept: 11.418021 USDT |
| 2026-06-09 18:43:41 | 69,129,863 | `0x457eb0c18f27b6d81aec02e6bfded987a55241b6905d8d6df93f5841277e8fcb` | 11.418021 USDT into V4 |
| 2026-08-12 14:33:57 | 74,644,479 | `0xc7d1d70a44bd6d991817d5d453bb54bde60ef620f991b171da24ce26e0922b73` | V4 swept: 12.224915 USDT |
| 2026-08-12 14:33:58 | 74,644,485 | `0x7ebe9731e833b5246485c085bce0e69b0862291fe5a976304168f2170927854f` | 12.224915 USDT into V5 |
| 2026-08-12 14:36:25 | 74,644,627 | `0xb64a1d1b0adb190fa4f30d54f86a209ab58a222b451a67a147500ed3e5233c10` | `setVaultBalance(106, 8000000, 0)` in the V5 setup |

The sum of the per-course books against the tokens held, read from each
contract (the mapping survives the migrations):

| Version | Sum of books | Tokens held | Over |
|---|---|---|---|
| V2 (before its sweep) | 16.248137 | 8.248137 | 8.000000 |
| V3 (`0x34B04781546Db02b008aE3A066b9512A52914728`, before its sweep) | 19.418021 | 11.418021 | 8.000000 |
| V4 (`0x42DC9a547D98cD6891F38C8e6134D52a83580479`, before its sweep) | 20.265825 | 12.224915 | 8.040910 |
| V5 after its setup (`0x4d1607A8AEfCdF7B24208E5ceA1e55085781Fc3B`) | 20.262753 | 12.224915 | 8.037838 |
| V5 today, with 106 zeroed | 13.236402 | 13.195492 | 0.040910 |

We found that the remaining 0,040910 comes from runing twice the 
migration V3->V4 (that was not fully idempotent).


To correct the problems we have:

1. Started the design version 6 of the contract solving the accounting problems
   and including a policy to retire a vault, see
   https://github.com/pasosdeJesus/learn.tg/tree/main/apps/contracts/contracts/next
2. Adjusted to 0 the value reported in the retired course 106
3. Started the design of the migration from V5 to V6 making it idempotent
   in case it stops and improving infrastructure for that

To acknowledge you, we have just created a document:
https://github.com/pasosdeJesus/learn.tg/blob/main/doc/reviews/KupiaSec.md

As you can see at https://learn.tg/en/transparency our economy is tiny,
learn.tg is far from being economically profitable, currently it is 
a commitment from me and my experience with God. Unfortunately we don't
count with the resources for a full audit from you. However if you want
to do a partial audit for example of the proposed V6 of the LearnTGVault
contract for a tiny stipend (let's say 100 USDT), we will do our effort 
to raise that for you.


Blessings
