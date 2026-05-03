  # Learn.tg - Aprender Mediante Juegos / Learn Through Games

**"Whatever you do, work at it with all your heart, as working for the 
  Lord, not for human masters." (Colossians 3:23)**

[![Pipeline Status](https://gitlab.com/pasosdeJesus/learn.tg/badges/main/pipeline.svg)](https://gitlab.com/pasosdeJesus/learn.tg/-/pipelines?page=1&scope=all&ref=main) [![Code Climate](https://codeclimate.com/github/pasosdeJesus/learn.tg/badges/gpa.svg)](https://codeclimate.com/github/pasosdeJesus/learn.tg)

**Learn.tg** is a gamified educational platform that makes learning
engaging through crossword puzzles, with a core mission rooted in Christian 
principles. Our platform at [learn.tg](https://learn.tg) allows 
students to earn cryptocurrency rewards for mastering educational content.

## 📜 Foundational Document

*   **[Foundational Principles (PRINCIPLES.md)](PRINCIPLES.md)**: The 
  theological, ethical, and missional principles that guide our work.

## 🎯 Our Mission in Action

We believe technology should serve a higher purpose. By combining quality 
content with gamification and transparent cryptocurrency incentives, 
Learn.tg puts this mission into action:

*   **Making Learning Joyful:** We transform education from a chore into 
  an engaging and interactive experience.
*   **Rewarding Diligence:** We provide tangible rewards for achievement, 
  honoring the effort students put in.
*   **Building Trust:** We use blockchain for a transparent and trustless
  reward system.
*   **Global Reach:** We empower teachers to create and manage courses 
  for a global audience, spreading knowledge and opportunity.


## 🚀 Technical Architecture

The platform consists of three main components working in unison:

1.  **Backend ([servidor/](servidor/))**: A **Ruby on Rails** application 
  that serves as the administrative hub for managing courses, users, and 
  content.
2.  **Frontend ([apps/nextjs/](apps/nextjs/))**: A **Next.js** application 
  that provides the user interface, handles user authentication via crypto 
  wallets (SIWE), and delivers educational content.
3.  **Smart Contracts ([apps/hardhat/](apps/hardhat/))**: **Solidity** 
  contracts deployed on the Celo network to manage and distribute USDT 
  rewards transparently and securely.

For a detailed technical overview, please see 
**[ARCHITECTURE.md](ARCHITECTURE.md)**.

## 🏃 Getting Started

### Quick frontend-only development (no backend setup)

```sh
git clone <repo-url>
cd apps/nextjs
cp .env.template .env
# Edit .env:
#   NEXT_PUBLIC_API_URL=https://learn.tg:9001/api
#   NEXT_PUBLIC_API_BASE=https://learn.tg:3500/learntg-admin
#   NEXTAUTH_SECRET=<any-random-string>
pnpm install
bin/dev
```

Open [http://localhost:4000](http://localhost:4000). No database or Rails setup needed.
All API requests are proxied to the live server.

### Full development

To set up the Rails backend and smart contracts as well, see:
- [CONTRIBUTING.md](CONTRIBUTING.md)
- [servidor/README.md](servidor/README.md)
- [apps/hardhat/README.md](apps/hardhat/README.md)

## 🤖 For AI Agents

As an AI agent, your starting point is the `AGENTS.md` file. Please read 
it.
*   **[AI Agent Instructions (AGENTS.md)](AGENTS.md)**

