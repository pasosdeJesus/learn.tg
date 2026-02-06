# Learn.tg - Frontend

This directory contains the Next.js frontend for the Learn.tg platform. It is the primary user-facing application, responsible for content delivery, user interaction, and authentication via crypto wallets.

## Overview

The frontend is built with [Next.js](https://nextjs.org/) and uses [Sign-In with Ethereum (SIWE)](https://login.xyz/) for passwordless authentication, allowing users to connect with their Ethereum-based wallets. It interacts with the Rails backend to fetch course content and user data.

## Features

- **Decentralized Authentication**: Securely sign in using your Ethereum wallet (e.g., MetaMask, Rainbow).
- **Interactive Learning**: Engage with course content through interactive guides and gamified experiences.
- **Crypto Rewards**: Earn USDT rewards for completing guides and demonstrating your knowledge.
- **Responsive Design**: Access the platform on any device with a clean and intuitive user interface.
- **Internationalization**: Available in multiple languages to serve a global audience.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (v15) with React (v19)
- **Language**: [TypeScript](https://www.typescriptlang.org/) (v5)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v4) with PostCSS
- **UI Components**: [Radix UI](https://www.radix-ui.com/) and [shadcn/ui](https://ui.shadcn.com/)
- **Authentication**: [NextAuth.js](https://next-auth.js.org/) (v4) with [SIWE](https://login.xyz/)
- **Wallet Integration**: [RainbowKit](https://www.rainbowkit.com/) and [Wagmi](https://wagmi.sh/)
- **State Management**: [React Query](https://tanstack.com/query) for server state and React Context for global UI state
- **Testing**: [Vitest](https://vitest.dev/) for unit and integration testing, with [React Testing Library](https://testing-library.com/)
- **Linting & Formatting**: [ESLint](https://eslint.org/) and [Prettier](https://prettier.io/)

## In-Depth Architecture

This section provides a deeper look into the technical implementation of the Next.js application. For a system-wide overview, please see the main `ARCHITECTURE.md` file in the root directory.

### Business Logic and Utilities (lib/)
This directory contains crucial application logic, decoupled from the UI and API routes, ensuring reusability and testability.
- **`lib/guide-utils.ts`**: Manages logic related to course and guide progress.
- **`lib/scores.ts`**: Handles the calculation and updating of user scores (`learningscore`, `profilescore`).
- **`lib/crypto.ts`**: Contains cryptographic functions for authentication and data integrity.
- **`lib/metrics-server.ts`**: Provides server-side functions for recording user events.

### UI Components (components/ui)
The application uses **Radix UI** as a foundation for its UI components. Our library of reusable and custom components is located in `apps/nextjs/components/ui`, providing a consistent look and feel across the platform.

### Database Interaction (db/)
While the main schema is managed by the Rails backend, the Next.js app interacts directly with the database for performance-critical operations using the Kysely query builder.
- **Connection**: The database connection is configured in `apps/nextjs/db/database.ts`.
- **Migrations**: Schema changes and triggers specific to the Next.js application's needs (e.g., for analytics or specific caching logic) are managed via migrations in `apps/nextjs/db/migrations`.

### Testing Strategy
The project emphasizes code quality and reliability through a comprehensive testing strategy.
- **Framework**: **Vitest** is used to run unit, integration, and component tests.
- **Location**: Test files are co-located with the source code in `__tests__` directories (e.g., `apps/nextjs/components/__tests__/`).
- **Execution**: Tests can be run with the `make test` command from this directory.

### Server-Side Analytics and Metrics

In line with our principle of **transparency**, our metrics system is a robust, server-side-only process to ensure data integrity and provide a single source of truth.

-   **Philosophy**: The backend is the source of truth. The client-side application no longer tracks events. Instead, events are recorded as a direct side-effect of an API call being processed on the server.
-   **Data Flow**:
    1.  A user's action triggers a standard API request to the Next.js backend (e.g., `GET /api/guide`).
    2.  After the API endpoint executes its primary logic, it calls the `recordEvent()` function from `lib/metrics-server.ts`.
    3.  This function inserts a new entry into the `userevent` table.
-   **Result**: This approach makes the system more secure and reliable. The existing **Metrics Dashboard** (`/metrics`) and its API (`/api/metrics`) draw from this accurate dataset.

## Prerequisites

- [Node.js](https://nodejs.org/) (>= 18)
- [pnpm](https://pnpm.io/) (v10)

## Environment Variables

Before running the application, you need to set up your environment variables. Copy the template file:

```sh
cp .env.template .env
```

Then, review and update the `.env` file with the following:

- `NEXT_PUBLIC_URL`: The public URL of the application (e.g., `http://localhost:4300` for development).
- `NEXT_PUBLIC_API_URL`: The URL of the Ruby on Rails backend server (e.g., `http://127.0.0.1:3000`).
- `PORT`: The port on which to run the Next.js server (e.g., `4300`).
- `NEXTAUTH_URL`: The full URL of the Next.js app, required by NextAuth.
- `NEXTAUTH_SECRET`: A secret string used to sign session cookies. You can generate one with `openssl rand -hex 32`.

## Local Development

1.  **Install Dependencies:**

    ```sh
    pnpm install
    ```

2. **Check syntax and typing errors:**

    ```sh
    make type
    ```

3.  **Run the Development Server:**

    The provided script will start the Next.js development server.

    ```sh
    bin/dev
    ```

    The application will be available at [https://localhost:4300](https://localhost:4300) (or the port you specified).

## Available Scripts

- `pnpm dev`: Starts the development server with HTTPS.
- `pnpm build`: Builds the application for production.
- `pnpm start`: Starts a production server.
- `pnpm lint`: Lints the codebase for errors.
- `pnpm test`: Runs the test suite with Vitest.
- `pnpm coverage`: Generates a test coverage report.
- `pnpm typecheck`: Checks the project for TypeScript errors.
- `pnpm format`: Formats the code with Prettier.

## Available Pages and Routing

The application uses Next.js's App Router. Here are the main user-facing pages:

- **`app/layout.tsx`**: The root layout of the application. It defines the basic HTML structure, including the `<html>` and `<body>` tags, and wraps the entire application with the `AppProvider` for global state management.

- **`app/page.tsx`**: The main landing page of the platform. It presents a general welcome message and prompts the user to select their preferred language (English or Spanish) to continue.

- **`app/[lang]/page.tsx`**: The home page for a specific language. It displays a grid of available courses for the selected language, showing the course title, image, and scholarship information.

- **`app/[lang]/profile/page.tsx`**: The user's profile page. It allows users to view and edit their profile information, check their learning and profile scores, and manage their verification status through "Sign-In With Ethereum" (SIWE) and GoodDollar.

- **`app/[lang]/privacy-policy/page.tsx`**: A simple page that displays the platform's privacy policy.

- **`app/[lang]/[pathPrefix]/page.tsx`**: The main page for a specific course. It shows the course summary, the list of guides within the course, and the user's progress.

- **`app/[lang]/[pathPrefix]/[pathSuffix]/page.tsx`**: This page displays the content of a specific guide. It renders the guide's markdown content, including any interactive elements, and provides navigation to the previous and next guides.

- **`app/[lang]/[pathPrefix]/[pathSuffix]/test/page.tsx`**: This is the testing page for a guide, which is where interactive games like the crossword puzzle are implemented. It fetches the game data, handles user input, and communicates with the backend to check the answers and distribute rewards.

- **`app/metrics/page.tsx`**: An internal dashboard for platform administrators to visualize key metrics, such as user engagement, course completion rates, and user growth. It dynamically loads several chart components to display the data.

- **`app/[lang]/invitegd/[inviter]/page.tsx`**: This page is part of the GoodDollar invitation and rewards system. It allows users to claim rewards for inviting new users to the platform and to get their own invite link.

## Production

1.  **Build the Application:**

    ```sh
    pnpm build
    ```

2.  **Run in Production Mode:**

    The `bin/prod.sh` script is configured to build and start the application in production mode.

    ```sh
    ./bin/prod.sh
    ```

    It is recommended to run this behind a reverse proxy like Nginx for handling SSL and routing traffic correctly.
