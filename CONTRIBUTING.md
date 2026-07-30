# Contributing to learn.tg

Thank you for your interest in contributing to learn.tg! 🎯

## Our Collaborative Spirit

While this project has a specific Christian mission, we welcome all contributors who act with respect, humility, and diligence. Our goal is to create a positive and excellent development environment. As our guiding verse says:

> *"Whatever you do, work at it with all your heart, as working for the Lord, not for human masters." (Colossians 3:23)*

---

## 📋 Code of Conduct
By participating in this project, you agree to maintain a respectful and collaborative environment.

## 🚀 Development Setup

### Frontend Only (quickest — no backend required)

See [apps/nextjs/README.md](apps/nextjs/README.md) for the quick start.
Requires only Node.js, pnpm, and a web3 wallet. No database or Rails setup.

### Backend (Rails Server)
See instructions in [servidor/README.md](servidor/README.md)

### Frontend (Next.js App)
See instructions in [apps/nextjs/README.md](apps/nextjs/README.md)

### Documentation & Testing Policies
For detailed documentation and testing policies for the Next.js app, see [apps/nextjs/CONTRIBUTING.md](apps/nextjs/CONTRIBUTING.md).

## 🔄 Contributing Process

1. **Fork** the repository
2. **Create a branch** from `main`: `git checkout -b feature/my-feature`
3. **Make your changes** following the style guides
4. **Run tests in directory `apps/nextjs`**: `make type` and `make test`
   - `make test` runs 6 sub-targets in sequence (parallel-safe, sin coverage)
   - `make coverage` runs all tests with coverage (lento, usa más memoria)
   - Individual targets: `make test-lib`, `make test-api`, `make test-pages`, etc.
   - E2E tests: `make test-smoke` (HTTP) or `bin/m test:e2e` (Puppeteer). See [doc/e2e-testing.md](doc/e2e-testing.md)
   - See [apps/nextjs/CONTRIBUTING.md](apps/nextjs/CONTRIBUTING.md) for details
5. **Commit** with clear messages: `git commit -m "feat: add feature X"`
6. **Push** and create a **Pull Request**

## 📝 Code Standards

- **TypeScript**: 
  - Use explicit types, avoid `any` when possible
  - Don´t use ; at the end of the lines
- **SQL**:
  - Use singular for table names
  - Reserve _ in table name for join tables
- **Migrations**: 
  - Never modify a migration that has already been applied to any environment (dev, staging, production)
  - Schema changes always go in new migrations
  - The only exception is before the first deploy to production, and only with explicit authorization
- **Tests**: Try to include tests for new functionality
- **Commits**: Use [Conventional Commits](https://conventionalcommits.org/): `feat:`, `fix:`, `docs:`
- **Type checking**: Code at `apps/nextjs` must pass `make type` without errors

## 🔗 Smart Contracts

The active scholarship contract is **LearnTGVaultsV4** (`apps/hardhat/contracts/LearnTGVaultsV4.sol`) — deployed on Celo. V3 and V2 are legacy. The scholarship formula in all versions is `(amountPerGuide × profileScore) / 100`, requiring profile score ≥ 50. USDT and SLEARN are paid independently (partial payments supported in V4). CELO UBI is handled by `CeloUbi.sol` with `MAX_REWARD = 0.2 CELO` and formula `(0.2 × profileScore) / 100`.

See [apps/hardhat/README.md](apps/hardhat/README.md) for deploy, verify, and smoke-test commands.

## 📚 Documentation Sync Policy

When source code changes affect user-facing behavior, three layers of
documentation must stay consistent:

| Layer | File | Audience | What to update |
|---|---|---|---|
| **User guides** | `resources/{en,es}/{course}/guide*.md` | Students | Reward formulas, limits, flows, rules |
| **Architecture** | `ARCHITECTURE.md` | Developers | Contracts, APIs, DB schema, parsing |
| **Contributing** | `CONTRIBUTING.md`, `apps/*/README.md` | Contributors | Commands, setup, standards |

**Invariant:** Any change to a contract's `MAX_REWARD`, scholarship formula,
profile score calculation, or cooldown period MUST be reflected in both the
user guides AND ARCHITECTURE.md. Code changes without doc updates are
incomplete.

Guide writing conventions are in [doc/guide-writing.md](doc/guide-writing.md).

## 📋 Requirements (REQ/)

Requirements that correspond to GitHub/GitLab issues must be written in **English**. Use:

```bash
./bin/m req:create "Title in English"
```

## 🐛 Reporting Bugs

1. Check that no similar issue exists
2. Include steps to reproduce the problem
3. Specify browser/Node.js versions
4. Attach logs or screenshots if relevant

## 💡 Suggesting Features

1. Open an issue describing the feature
2. Explain the use case and benefits
3. Discuss implementation before starting to code

## ❓ Getting Help

- **Issues**: For bugs and suggestions
- **Discussions**: For general questions
- **Documentation**: Check README files for each component

