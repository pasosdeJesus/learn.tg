# Learn.tg - Frontend

This directory contains the Next.js frontend for the Learn.tg platform. 
It is the primary user-facing application, responsible for content 
delivery, user interaction, and authentication via crypto wallets.

## Overview

The frontend is built with [Next.js](https://nextjs.org/) 
and uses [Sign-In with Ethereum (SIWE)](https://login.xyz/) for 
passwordless authentication, allowing users to connect with their 
Ethereum-based wallets. It interacts with the Rails backend to 
fetch course content and user data.

## Prerequisites

- [Node.js](https://nodejs.org/) (>= 18)
- [Yarn](https://yarnpkg.com/)

## Environment Variables

Before running the application, you need to set up your environment 
variables. Copy the template file:

```sh
cp .env.template .env
```

Then, review and update the `.env` file with the following:

- `NEXT_PUBLIC_URL`: The public URL of the application (e.g., 
  `http://localhost:3000` for development).
- `NEXT_PUBLIC_API_URL`: The URL of the Ruby on Rails backend server (e.g.,
  `https://127.0.0.1:3000`).
- `PORT`: The port on which to run the Next.js server (e.g., `3000`).
- `NEXTAUTH_URL`: The full URL of the Next.js app, required by NextAuth.
- `NEXTAUTH_SECRET`: A secret string used to sign session cookies. 
  You can generate one with `openssl rand -hex 32`.

## Local Development

1.  **Install Dependencies:**

    ```sh
    pnpm install
    ```

2.  **Run the Development Server:**

    The provided script will start the Next.js development server.

    ```sh
    bin/dev
    ```

    The application will be available at 
    [http://localhost:3000](http://localhost:3000) (or the port 
    you specified).

## Testing

The project uses [Vitest](https://vitest.dev/) for unit and integration 
testing. You can run the entire test suite with the following command:

```sh
pnpm test
```

This will execute all test files and display a coverage report in the 
console.

## Production

1.  **Build the Application:**

    ```sh
    pnpm build
    ```

2.  **Run in Production Mode:**

    The `bin/prod.sh` script is configured to build and start the 
    application in production mode.

    ```sh
    ./bin/prod.sh
    ```

    It is recommended to run this behind a reverse proxy like Nginx for 
    handling SSL and routing traffic correctly.
