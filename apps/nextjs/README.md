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

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration testing. You can run the entire test suite with the following command:

```sh
make test
```

This will execute all test files and display a coverage report in the console.

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

