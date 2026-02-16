# Testing Strategy - learn.tg Next.js Application

**"Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)**

---

## 🎯 Overview

This document provides a high-level overview of the testing strategy for the learn.tg Next.js application. For detailed implementation and usage instructions, refer to the dedicated documentation in the `test-utils/` directory.

### **Current Status (2026-02-15)**
- ✅ **487 tests passing** – Full test suite green
- ✅ **TypeScript checks passing** – No type errors
- ✅ **Test utilities organized** – Structured mocking system
- ✅ **Migration to reusable utilities completed** – All existing tests use `test-utils`

## 🏗️ Testing Architecture

### **Framework & Tools**
- **Test Runner**: [Vitest](https://vitest.dev/) – Fast, compatible with Vite
- **Testing Library**: [React Testing Library](https://testing-library.com/) – User-centric component testing
- **Type Checking**: TypeScript strict mode with `tsc --noEmit`
- **Coverage**: Vitest built-in coverage reporting

### **Test Categories**
1. **Unit Tests** – Individual functions and utilities
2. **Integration Tests** – API routes with mocked dependencies
3. **Component Tests** – React components with mocked UI libraries
4. **End-to-End Tests** – Critical user flows (separate e2e suite)

## 📁 Test Utilities Structure

The testing system uses a modular mocking approach organized into two categories:

### **1. Generic Mocking Utilities** (`test-utils/common/`)
Reusable mocks for common libraries and frameworks. These utilities are designed to be extracted into the `@pasosdejesus/m` package for use across multiple projects.

**📚 Documentation**: [`test-utils/common/README.md`](test-utils/common/README.md)

**Available Modules:**
- **`fs-mocks.ts`** – Filesystem mocks (`fs/promises`, `node:fs/promises`)
- **`kysely-mocks.ts`** – Database ORM mocks (Kysely, PostgreSQL)
- **`radix-mocks.tsx`** – Radix UI component mocks
- **`rainbowkit-mocks.ts`** – Authentication mocks (RainbowKit, Wagmi, NextAuth, SIWE)
- **`viem-mocks.ts`** – Blockchain client mocks (Viem)

### **2. Learn.tg-Specific Mocks** (`test-utils/app/`)
Application-specific mocks for learn.tg internal modules and functionality.

**📚 Documentation**: [`test-utils/app/README.md`](test-utils/app/README.md)

**Available Modules:**
- **`learn-tg-mocks.ts`** – Mocks for internal libraries (`lib/crypto`, `lib/scores`, `lib/metrics/queries`, etc.)
- **`crossword-mocks.ts`** – Crossword puzzle generation and processing mocks


## 🚀 Usage Guidelines

### **Basic Setup**
```typescript
// Import mocks BEFORE importing modules under test
import '@/test-utils/common/radix-mocks'
import { setupApiMocks } from '@/test-utils/app/learn-tg-mocks'
import { apiDbMocks } from '@/test-utils/common/kysely-mocks'

beforeAll(() => {
  setupApiMocks()
  apiDbMocks.setupMocks()
})
```

### **Import Order Critical**
1. Import mock utilities
2. Setup mocks in `beforeAll`
3. Import modules under test
4. Configure specific mock responses in `beforeEach`

### **Mock Lifecycle**
- `setup*Mocks()` – Call in `beforeAll` to configure `vi.mock` calls
- `reset*Mocks()` – Call in `beforeEach` to reset implementations
- `vi.clearAllMocks()` – General cleanup in `afterEach`

## 📊 Test Coverage Status

### **API Routes** – ✅ **100% coverage**
All API routes have comprehensive tests using the mocking utilities:
- Authentication (`/api/auth/*`)
- Content delivery (`/api/guide`, `/api/guide-status`)
- Reward systems (`/api/check-crossword`, `/api/claim-celo-ubi`)
- Metrics and analytics (`/api/metrics/*`)
- User management (`/api/update-scores`, `/api/self-verify`)

### **Libraries (`lib/`)** – ✅ **100% coverage**
All utility libraries have unit tests:
- `crypto.ts` – Cryptographic functions
- `scores.ts` – Score calculation and updating
- `guide-utils.ts` – Course and guide progress logic
- `metrics-server.ts` – Server-side event recording
- `deeplink.ts` – Deeplink generation

### **UI Components** – ✅ **100% coverage**
All React components have tests:
- **Radix UI Components** – Using `radix-mocks.tsx`
- **Custom Components** – Layout, headers, modals, buttons
- **Page Components** – All page routes tested

### **Pages** – ✅ **100% coverage**
All Next.js pages have integration tests:
- Landing pages (`/`, `/[lang]/`)
- Course pages (`/[lang]/[course]/`)
- Guide pages (`/[lang]/[course]/[guide]/`)
- Profile and settings pages
- Metrics dashboard

## 🔄 Migration to @pasosdejesus/m

The generic mocking utilities (`test-utils/common/`) are planned for migration to the `@pasosdejesus/m` package for reuse across multiple "Pasos de Jesús" projects.

**📋 Migration Plan**: [`TEST-MUEVE.md`](TEST-MUEVE.md)

**Key Objectives:**
1. Create `@pasosdejesus/m-test-utils` package
2. Move modules one by one maintaining compatibility
3. Update imports from `@/test-utils/common` to `@pasosdejesus/m-test-utils`
4. Maintain all tests passing during transition


## 🧪 Running Tests

### **From `apps/nextjs/` directory:**
```bash
# Run all tests
make test

# Type checking only of source code without tests
make type

# Test with coverage report
pnpm coverage

# Type checking only of tests
make type-check-tests

```

### **Test Command Reference**
- `pnpm test` – Run Vitest test suite
- `pnpm test:ui` – Run Vitest UI (interactive)
- `pnpm coverage` – Generate coverage report
- `pnpm typecheck` – TypeScript type checking

## 🔗 Related Documentation

### **Core Documentation**
- [`test-utils/common/README.md`](test-utils/common/README.md) – Generic mocking utilities
- [`test-utils/app/README.md`](test-utils/app/README.md) – Learn.tg-specific mocks
- [`TEST-MUEVE.md`](TEST-MUEVE.md) – Migration plan to `@pasosdejesus/m`

### **External Resources**
- [Vitest Documentation](https://vitest.dev/guide/)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Testing Next.js Applications](https://nextjs.org/docs/app/building-your-application/testing)


*"For God has not given us a spirit of timidity, but of power, love, and self-discipline" (2 Timothy 1:7)*
