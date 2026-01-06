# Learn.tg - Project Architecture

## Overview

Learn.tg is a live, production gamified educational platform making learning engaging and rewarding. Students complete quality content through interactive guides and games, earning USDT cryptocurrency rewards for correct answers. The platform is currently operational at https://learn.tg with multiple courses across different subjects.

---

## System Architecture Diagram

This diagram illustrates the flow of information and actions between the user, the different parts of the application, and the blockchain.

```mermaid
graph TD
    subgraph User
        A[User's Wallet]
        B[Browser]
    end

    subgraph Platform
        C[Frontend - Next.js/React]
        D[Backend - Rails]
        E[Smart Contract - Solidity/Celo]
        F[Backend - Next.js API]
    end

    subgraph Blockchain
        G[Celo Network]
    end

    A -- 1. Connects & Signs (SIWE) --> C
    B -- 2. Interacts with Content --> C
    C -- 3. Fetches Guides/Data (JWT Auth) --> D
    D -- 4. Returns Content --> C
    C -- 5. Submits Answers --> F
    F -- 6. Validates Answers --> F
    F -- 7. Triggers Reward --> E
    E -- 8. Executes Transaction --> G
    G -- 9. Sends USDT Reward --> A

    style E fill:#f9f,stroke:#333,stroke-width:2px
    style D fill:#bbf,stroke:#333,stroke-width:2px
    style C fill:#9f9,stroke:#333,stroke-width:2px
    style F fill:#9f9,stroke:#333,stroke-width:2px
```

## Architecture Stack

### 1. **Major Backend: Rails (servidor/)**
- **Framework:** Ruby on Rails (v8.0)
- **Database:** PostgreSQL (>= 16.2) with unaccent extension
- **Purpose:** Course management, guide organization, user data persistence, teacher administration.
- **Based on:** MSIP and cor1440_gen frameworks
- **Authentication:** Token-based (receives and validates JWT tokens from the Next.js frontend).

### 2. **Frontend and minor backend: Next.js (apps/nextjs/)**
- **Framework:** Next.js (v15.3.6) with React (v19.2.3) + TypeScript
- **UI Components:** Utilizes **Radix UI** for building a flexible and accessible component library.
- **Purpose:** User interface, content delivery, and user authentication.
- **Authentication:** Implements Sign-In With Ethereum (SIWE). The user connects with a Web3 wallet, and the frontend generates a JWT token for authenticating with the Rails backend.

### 3. **Smart Contracts: Hardhat (apps/hardhat/)**
- **Language:** Solidity (^0.8.24)
- **Network:** Celo (mainnet) & Celo Sepolia (testnet)
- **Main Contract:** `LearnTGVaults.sol`
  - Manages USDT reward distribution per course.
  - Implements a 24-hour cooldown between submissions for a user.
  - Splits deposits: 80% to the student reward vault, 20% to platform
    operations.

---

## Authentication & Communication Flow

1.  **Frontend (Next.js):** A user connects their wallet and signs a message
   (SIWE).
2.  **Next.js API:** Validates the signature and generates a JWT token.
  This token is stored and used for subsequent authent icated actions.
3.  **Backend Communication:**
    - For fetching course data and content, the frontend sends the
  JWT in the `Authorization` header to the **Rails backend**.
    - For submitting answers and triggering rewards, the frontend sends
  the answers along with the JWT to a specific **Next.js API route**
  (`/api/check-crossword`).

**Key Point:** The platform uses a hybrid backend approach. The Rails server
acts as the primary administrative and content backend, while the Next.js
server handles real-time, user-specific actions like answer validation
and blockchain interactions.

---

## Reward System

**Trigger:** A student submits a crossword answer.

**Process:**
1. The frontend sends the crossword solution to the
   `POST / api/check-crossword` endpoint in the **Next.js backend**.
2. The Next.js backend validates the answer. If it's correct, it may award
   points to the user in the database.
3. The backend then calls the `submitGuideResult()` function on the
   `LearnTGVaults` smart contract. It passes the student's wallet address,
   a `profileScore` (a metric of user engagement), and a boolean indicating
   if the answer was perfect.
4.  The contract verifies on-chain:
   - The student has not already received a reward for this guide.
   - At least 24 hours have passed since the student's last submission for
     that course.
   - The course vault has a sufficient USDT balance.
   - The user's `profileScore` is at least 50.
5. If all checks pass, the contract calculates the final reward amount
   by multiplying the guide's base reward (`amountPerGuide`) by the
   `profileScore`.
6. The contract then transfers the calculated USDT amount to the student's
    wallet address.


---

## Progress and Scoring System

The platform tracks user progress and scores through two main database tables:

### `guide_usuario` (per-guide progress)
- `points`: 1 if the guide was answered correctly, 0 otherwise
- `amountpaid`: USDT amount rewarded for this guide (0 if not yet paid)
- `profilescore`: User's profile score at the time of submission

### `course_usuario` (per-course progress)
- `guidespoints`: Sum of `points` for all guides in the course
- `amountscholarship`: Total USDT received for the course
- `percentagecompleted`: Percentage of guides completed (with points > 0)

### Global user scores (in `usuario` table)
- `learningscore`: Total points across all guides and courses
- `profilescore`: Metric of user engagement (≥50 required for rewards)

### Progress calculation
When a user answers a guide correctly:
1. `guide_usuario.points` is set to 1
2. `updateUserAndCoursePoints()` recalculates all course metrics
3. `learningscore` is updated as the sum of all guide and course points
4. Progress percentages are recomputed based on completed vs total guides

The frontend displays progress using a three-color arc showing completion and payment percentages.

---

## Database Schema

The PostgreSQL database is shared between the Rails backend and Next.js backend. Rails manages the core schema through ActiveRecord migrations, while Next.js accesses the same tables directly via the Kysely ORM for performance-critical operations like answer validation and progress tracking.

### Core Rails Tables (PostgreSQL)

#### `cor1440_gen_proyectofinanciero` (courses)
- `id`: Primary key, referenced as `courseId` throughout the platform
- `titulo`: Course title displayed to users
- `subtitulo`: Optional subtitle
- `prefijoRuta`: URL path prefix (e.g., "gooddollar")
- `idioma`: Language ("en" or "es")
- Additional administrative fields for project management

#### `cor1440_gen_actividadpf` (guides)
- `id`: Primary key, referenced as `actividadpf_id` in related tables
- `proyectofinanciero_id`: Foreign key to `cor1440_gen_proyectofinanciero`
- `titulo`: Guide title
- `nombrecorto`: Short name used for ordering
- `sufijoRuta`: URL path suffix (e.g., "guide1") - must be non-empty for published guides
- `descripcion`: Optional description

#### Guide Ordering and Mapping
- Guides are filtered by `proyectofinanciero_id = {courseId}` and `sufijoRuta IS NOT NULL AND sufijoRuta <> ''`
- In the crossword validation API (`/api/check-crossword`), guides are ordered by `nombrecorto`
- Guide numbers (1-indexed) correspond to the position in this ordered list
- The frontend uses `sufijoRuta` to construct URLs: `/{lang}/{prefijoRuta}/{sufijoRuta}`
- **Note**: While the validation API orders by `nombrecorto`, other parts of the system (like the Rails backend API) may use different ordering. The 1-indexed `guideId` passed to the smart contract must match the ordering used in `check-crossword`.

#### User Management Tables

##### `usuario` (users)
- `id`: Primary key
- `profilescore`: Engagement metric (≥50 required for blockchain rewards)
- `learningscore`: Total points across all guides and courses
- `updated_at`: Last update timestamp

##### `billetera_usuario` (wallet linking)
- `billetera`: Wallet address (case-insensitive)
- `usuario_id`: Foreign key to `usuario`
- `token`: JWT token for API authentication
- `answer_fib`: Stores correct crossword answers (pipe-separated ` | `) provided by the Rails backend after guide viewing

##### `guide_usuario` (per-guide progress)
- `usuario_id`, `actividadpf_id`: Composite primary key
- `points`: 1 if guide was answered correctly, 0 otherwise
- `amountpaid`: USDT amount rewarded for this guide (0 if not paid)
- `profilescore`: Snapshot of user's `profilescore` at submission time

##### `course_usuario` (per-course progress)
- `usuario_id`, `proyectofinanciero_id`: Composite primary key
- `guidespoints`: Sum of `points` for all guides in the course
- `amountscholarship`: Total USDT received for the course
- `percentagecompleted`: Percentage of guides completed (points > 0)

### Data Flow Notes
1. User wallet connection creates/updates `billetera_usuario` with a signed token
2. Course and guide data is fetched from Rails APIs (which query the above tables)
3. Crossword answers are validated against `billetera_usuario.answer_fib`
4. Progress is tracked in `guide_usuario` and aggregated in `course_usuario`
5. Blockchain rewards update `guide_usuario.amountpaid` and `course_usuario.amountscholarship`

---

## Key Technologies

| Component | Tech | Purpose |
|-----------|------|----------||
| Major Backend | Rails + PostgreSQL | Course/user management, admin interface |
| Smart Contracts | Solidity + Hardhat | USDT reward distribution, vault management |
| Frontend & API | Next.js + React + TypeScript | UI, content delivery, SIWE auth, answer validation |
| Blockchain | Celo | USDT transfers, decentralized rewards |
| Content | Markdown | Guide storage, version control |
| Wallet | OKX/Metamask/etc | User authentication and reward receipt |

---

## Development & Deployment

- **Start order:** Rails backend first, then Next.js frontend
- **Environment:** adJ 7.6 recommended (includes all dependencies)
- **Testing:** Hound CI, CodeClimate integration
- **Code Quality:** Automated linting and security checks
- **Live Deployment:** Running at https://learn.tg

