# SLEARN: Whitepaper

## A Utility Token for Community-Powered Learning

*Fundamental Disclaimer: SLEARN is a restricted‑access utility token.
It is not an investment, a security, or a cryptocurrency for speculation.
It is a digital tool to be used inside the [learn.tg](http://learn.tg)
ecosystem. Its value is indexed to the Leone (SLE) only for internal
accounting stability. It cannot be bought or traded on external markets.*

---

## 1. Vision: Learn by Creating Value

[learn.tg](http://learn.tg) exists to democratise access to transformative
education. SLEARN is the engine of a new economy where every learning act
and every contribution generates digital value, which in turn unlocks more
education. We close the loop between donors and students in an automated
and transparent way.

Learn Through Games operates under a Christian framework that is not
exclusive – everyone is welcome to learn – but it is the compass that
guides the system’s design.

*“Take my yoke upon you and learn from me, for I am gentle and humble in
heart, and you will find rest for your souls.” (Matthew 11:29)*

---

## 2. What is SLEARN?

- **Digital utility token** – A unit of account that represents a future
  learning option inside learn.tg, which can be redeemed for Leones (SLE).
- **Meritocratic** – Earned by learning (completing guides), donating
  (to courses), or investing in yourself (paying for premium courses).
- **Practical use** – Used to pay for premium courses and, in Sierra Leone,
  can be exchanged for Leones (SLE) through our partner
  [stable-sl.pdJ.app](https://stable-sl.pdj.app/). That platform maintains
  a reserve vault that backs SLEARN; its total value can be checked on‑chain
  and verified to be greater than or equal to the amount issued and reported
  on the [learn.tg Transparency Dashboard](https://learn.tg/en/transparency).
- **Technical** – An ERC‑20 token on the Celo network, with 2 decimals and
  restricted transfer functions to guarantee its use as a tool, not a
  speculative asset.

---

## 3. The Economic Model: Automated Impact

The power of SLEARN lies not in its price, but in the automatic value cycle
it enables. Every transaction on the platform follows predefined, immutable
rules that fund education.

### 3.1. Fund Inflow and Distribution

The system is fed by two main sources: directed donations and premium course
payments. The diagram below illustrates the complete value flow, showing
how each dollar multiplies into learning opportunities.

```mermaid
flowchart TB
    A[Capital Inflow] --> B{Transaction Type?}
    
    B -->|Source 1| C[💝 Donation to Course Vault<br>Example: 10 USDT]
    B -->|Source 2| D[🎟️ Premium Course Payment<br>Example: 10 USDT - Dynamic
Pricing]
    
    C --> C1[Donation Distribution]
    D --> D1[Payment Distribution]
    
    subgraph C1 [Donation Distribution: 10 USDT]
        direction LR
        C1_1[70%: 7 USDT to Destination Vault] --> C1_1a
        C1_2[10%: 1 USDT to learn.tg<br>Operations]
        C1_3[10%: 1 USDT → 22 SLEARN<br>Donor Reward]
        C1_4[5%: 0.5 USDT to Missionary Courses]
        C1_5[5%: 0.5 USDT to UBI Fund]
        
        C1_1a[3.5 USDT in Stablecoin] --> C1_1b[Course Destination Vault<br>USDT
+ SLEARN]
        C1_1a2[3.5 USDT → 77 SLEARN] --> C1_1b
    end
    
    subgraph D1 [Premium Payment Distribution: 10 USDT]
        direction LR
        D1_1[60%: 6 USDT to learn.tg<br>Operations & Creators]
        D1_2[20%: 2 USDT to Course Vault]
        D1_3[10%: 1 USDT → 22 SLEARN<br>Student Reward]
        D1_4[10%: 1 USDT to Missionary Courses]
    end
```

#### 3.1.1 Concrete example of a 10 USDT donation (assuming 1 USD = 22 SLE)

1.  7 USDT go to the donated course vault: 3.5 USDT finance 3.5 scholarships
    (1 USDT each) and 3.5 USDT are converted into 77 SLEARN to finance
    77 scholarships (1 SLEARN each).
2.  1 USDT funds learn.tg operations.
3.  0.5 USDT automatically support free missional courses.
4.  0.5 USDT feed the UBI fund in CELO for daily community rewards.
5.  The donor receives 22 SLEARN as credit for their own learning.

#### 3.1.2 Example with a Premium Course Payment

The model also activates when a user pays to access an exclusive course.
The price is dynamic, adjusted according to the student’s country development
index, promoting fairness. A percentage of this payment is converted into
SLEARN for the paying student and is used to finance more scholarships.

##### Distribution of a 10 USDT premium course payment (example from Sierra
Leone)

```mermaid
pie
    title Distribution of a Premium Course Payment (10 USDT)
    "60% : learn.tg & Creators<br/>(6 USDT)" : 60
    "20% : Course Vault<br/>(2 USDT)" : 20
    "10% : Student Reward<br/>(1 USDT → 22 SLEARN)" : 10
    "10% : Missionary Courses<br/>(1 USDT)" : 10
```

Concrete result of this transaction:

1.  6 USDT (60%) go to the general learn.tg fund. This portion covers
    operational costs (infrastructure, development) and fairly compensates
    content creators, encouraging the production of more and better
    educational material.
2.  2 USDT (20%) are added to the vault of the specific course the student
    is paying for. This fund will be used to finance future scholarships
    (in USDT and SLEARN) for that same course, allowing others to access it.
3.  1 USDT (10%) is converted into 22 SLEARN and awarded as a reward to the
    student who made the payment. This not only reduces the net cost of their
    educational investment but also gives them digital credit for future
    learning within the ecosystem.
4.  1 USDT (10%) is automatically sent to the free missional courses fund
    (e.g., “A Relationship with Jesus”), ensuring that the central,
    transformative content of the platform is always financed.

This mechanism ensures that every investment in one’s own education directly
contributes to platform sustainability, personal incentive, scholarship
creation, and the missional fund, creating a powerful virtuous cycle of
growth.

### 3.2. Use, Redemption and Sustainability

- **On‑platform use** – Users **burn** SLEARN to access premium courses.
- **Local redemption (future)** – In Sierra Leone, SLEARN may be exchanged
  for Leones (SLE) through our partner stable-sl.pdJ.app. This feature will
  be introduced **after** the token has established its primary utility as a
  medium of exchange for education. It is not a speculative “cash‑out” but a
  conversion to local currency for legitimate educational or personal needs,
  subject to reasonable limits and identity verification (published on the
  Transparency Dashboard).
- **Sustainability** – The system is circular. SLEARN issued for scholarships
  are burned when used, and the USDT backing is kept in auditable reserves.

### 3.3. The Role of stable-sl.pdJ.app: A Trust Bridge

For SLEARN to fulfil its promise of real‑world utility, it connects with the
economy of Sierra Leone through stable-sl.pdJ.app, a service that converts
digital assets to the national currency (SLE).

#### 3.3.1. Identity Verification, Access and Operation Limits

1.  Unverified users can transact up to 100 SLE per day.
2.  Once we have an Orange Money transaction with a name, if the name matches,
    the limit will be increased to 200 SLE per day. If the name does not
    match, the user will be blocked until they provide an identity document
    and an Orange Money number that matches.
3.  A button will be enabled to verify the name with that of the user holding
    the same wallet on learn.tg, and daily limits will be increased in
    proportion to the Profile Score on learn.tg.
4.  Daily limits will also be increased by the volume of USDT sold and by a
    history of dispute‑free operations.

#### 3.3.2. Cashback in SLEARN

- **Base:** 0.05 SLEARN per USDT sold on stable-sl.pdJ.app.
- **Bonuses per SBT:** +0.01 SLEARN per USDT for each course certificate (SBT)
  obtained on learn.tg.
- **Bonus limit:** The impact of SBTs is limited to the first 5 certificates.
  A user with 5 or more SBTs receives the maximum bonus of 0.10 SLEARN per USDT.

#### 3.3.3. Security and Operating Model

- **Escrow for USDT:** A smart contract acts as a neutral custodian, freezing
  the user’s USDT until the operator confirms receipt of SLE.
- **Execution with prior confirmation:** The user does not transfer funds until
  the operator confirms their availability.
- **Trust network:** The service is operated by a small group of trusted
  collaborators, aligned with the project’s values and mission.
- **Transparency:** Order status is recorded and verifiable. The reserve vault
  backing SLEARN is public and on‑chain.

---

## 4. Security and Custody Architecture

The integrity of community funds is paramount. We operate under a segmented
custody model with defined thresholds to minimise risks.

```mermaid
graph TB
    subgraph PRODUCTION_APPS
        L2[Hot Wallet L2<br/>Operational fund 1-2 months]
        S2[Hot Wallet S2<br/>For receiving/quick exchange]
    end

    subgraph MAIN_VAULTS_ONLINE[Your Personal Computer<br/>Limit: < 1000 USDT
each]
        L1[💰 Vault L1 - learn.tg<br/>Balance: < 1000 USDT]
        S1[💰 Vault S1 - stable-sl<br/>Balance: < 1000 USDT]
    end

    subgraph MASTER_VAULT_AIR_GAPPED[Air-Gapped adJ Machine<br/>Strategic
Reserve]
        SL0[🪙 Master Vault SL0<br/>Reserve in XAUT<br/>Balance: > 1000 USDT
eq.]
    end

    L1 -- Monthly replenishment --> L2
    S1 -- Back exchanges --> S2
    L1 -- Transfer surplus --> SL0
    S1 -- Transfer surplus --> SL0
```

**Key policies:**

- **Segmentation:** Operational funds (L2/S2), main vaults (L1/S1) and the
  master reserve (SL0) are physically and logically separated.
- **Strict thresholds:** Online vaults (L1/S1) never exceed 1,000 USDT.
  Surplus is transferred to the air‑gapped master vault (SL0).
- **Backing in a stable asset:** The strategic reserve is kept in XAUT
  (Tether Gold) to preserve long‑term value.
- **Transparency:** Reserve vault balances are verifiable on‑chain.
- **Daily operations:** The hot wallet (L1/S1) holds only the funds needed
  for daily operations (exchanges, rewards). The bulk of the reserves is
  kept in the air‑gapped master vault SL0, which is not connected to the
  internet. Periodically, funds are transferred from the cold vault to the
  hot wallet through a manual, secure process supervised by the Pasos de
  Jesús team.

---

## 5. Design Pillars and Governance

The design of SLEARN is based on fundamental principles that prioritise its
utility, transparency and alignment with the mission, above any speculative
financial dynamics.

### 5.1. Radical Transparency and On‑Chain Verification

The entire system is built to be audited by anyone. The total issuance of
SLEARN, as well as all transactions, are immutable and public on the Celo
blockchain. Critically, the USDT backing that underpins the redeemable value
of SLEARN is held in an on‑chain reserve vault at
[https://stable-sl.pdJ.app](https://stable-sl.pdj.app/). Any user can,
at any time, independently verify that the value in this vault is always
greater than or equal to the total value of SLEARN in circulation (calculated
at the parity of 1 SLEARN = 1 SLE). This cross‑verification creates an open
and immutable solvency guarantee.

### 5.2. Functional Stability

SLEARN is indexed to the Leone (SLE), the official currency of Sierra Leone,
with a reference parity of 1:1. This decision is not financial but functional:
it provides a stable, predictable and culturally relevant unit of account for
our primary users. The SLE has proven to be one of the most stable fiat
currencies against the US dollar, with an average variation of approximately
1% during 2025. This stability facilitates internal calculations, course
pricing and makes redemption a clear and fair operation.

### 5.3. Primary Utility over Speculation

SLEARN is intrinsically non‑speculative. Its smart contract restricts transfer
functions, allowing them only between authorised system addresses (such as the
wallets of learn.tg and stable-sl.pdJ.app) and for burning by users.
**SLEARN cannot be transferred between users**; they can only be minted by the
system (as a reward for completing guides) and burned when used to pay for
premium courses. This technically prevents the token from being listed or
traded on secondary exchanges, eliminating by design the possibility of it
being treated as an investment asset. Its sole purpose is to serve as a
digital tool to access, reward and finance education.

### 5.4. Organic Issuance without Arbitrary Limit

Unlike most tokens, SLEARN has no predefined maximum supply (hard cap) and
incorporates no artificial deflationary mechanisms. This is a key philosophical
decision:

1.  **Value derives from utility, not scarcity:** The “value” of SLEARN is its
    purchasing power within the ecosystem (1 SLEARN = 1 SLE for redemption),
    backed by assets, not a market price.
2.  **Issuance is tied to real value creation:** New SLEARN enter circulation
    exclusively as a result of actions that add value to the system: learning,
    donating or paying for a premium course. It is a flow economy.
3.  **Balance is achieved through use:** SLEARN are destroyed (burned) when used
    to pay for a course or redeemed for SLE. This cycle of issuance through
    contribution and burning through use ensures that supply dynamically
    adjusts to real activity, without the need for artificial limits.
    A growing and sustainable supply is an indicator of an active and healthy
    community.

### 5.5. Local Impact with a Global Vision

While the technology and economic model of SLEARN have a global vision,
a fixed percentage of all revenue (donations and payments) is automatically
and immutably allocated to fund key missional courses. These courses, available
in English, Spanish and Krio, form the core of our mission and their perpetual
funding is secured by the system’s own design, independent of market trends.

### 5.6. Fair Launch and Migration

There will be no Initial Coin Offering (ICO), private sale or any mechanism
that favours external investors. The first SLEARN will be minted to migrate
the “Learning Score” of our existing verified users on a 1:1 basis,
recognising and respecting their history of prior participation and learning.
From there, supply will only grow organically with the legitimate use of the
platform, ensuring that distribution is meritocratic and aligned with our
purpose.

---

## 6. Roadmap

- **Phase 1 (April–May 2026):** Contract deployment on Celo Sepolia (testing).
  Whitepaper and transparency dashboard publication. Community feedback
  requested on the Celo Forum.
- **Phase 2 (June 1, 2026):** Launch on Celo mainnet. 1:1 conversion of
  Learning Points to SLEARN. Activation of SLEARN as a payment method for
  premium courses (burn mechanism).
- **Phase 3 (Post‑launch, date TBD):** Activation of the SLEARN ↔ SLE swap
  through stable-sl.pdJ.app. This feature will be introduced after SLEARN
  has demonstrated its primary utility as a medium of exchange for education.

---

## 7. Conclusion: More Than a Token

SLEARN is not the goal. It is the tool.

The goal is a self‑sustaining community where learning flows freely, where
every donation multiplies into scholarships and where every student,
regardless of their economic background, has a clear path to grow.

This is the future we are building, one transaction at a time.

---

To learn more, audit the contract or see live impact:

- [Real‑time Transparency Dashboard](https://learn.tg/en/transparency)
- [Reserve Vault (stable-sl.pdJ.app)](https://stable-sl.pdj.app/)
- [Verified SLEARN Contract on CeloScan](https://celoscan.io/address/...) (link
  available after deployment)
- [Fundamental Principles of learn.tg](https://learn.tg/principles)

Contact: vtamara@pasosdeJesus.org

*Last updated: April 17, 2026. This is a living document that may evolve with
the project.*
