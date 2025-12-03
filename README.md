# Learn.tg - Aprender Mediante Juegos / Learn Through Games

**"Whatever you do, work at it with all your heart, as working for the 
  Lord, not for human masters." (Colossians 3:23)**

[![Pipeline Status](https://gitlab.com/pasosdeJesus/learn.tg/badges/main/pipeline.svg)](https://gitlab.com/pasosdeJesus/learn.tg/-/pipelines?page=1&scope=all&ref=main) [![Code Climate](https://codeclimate.com/github/pasosdeJesus/learn.tg/badges/gpa.svg)](https://codeclimate.com/github/pasosdeJesus/learn.tg)

**Learn.tg** is a gamified educational platform designed to make learning 
engaging and rewarding, with a core mission rooted in Christian 
principles. Our live prototype at [learn.tg](https://learn.tg) allows 
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

To start developing, please review our **[Contributing Guide 
(CONTRIBUTING.md)](CONTRIBUTING.md)**.

## 🤖 For AI Agents

As an AI agent, your starting point is the `AGENTS.md` file. Please read 
it.
*   **[AI Agent Instructions (AGENTS.md)](AGENTS.md)**

