# Test Utilities for Learn.tg Application (`test-utils/`)

**"Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)**

This directory contains **Learn.tg-specific mocking utilities** for testing the application. These utilities mock modules and functions that are unique to the Learn.tg platform, complementing the generic mocks available in [`@pasosdejesus/m/test-utils`](../node_modules/@pasosdejesus/m/dist/test-utils/README.md).

## 📁 Structure

```
test-utils/
├── index.ts              # Re-exports all Learn.tg-specific mocks
├── learn-tg-mocks.ts     # Mocks for Learn.tg libraries and modules
├── crossword-mocks.ts    # Mocks for crossword puzzle functionality
└── README.md             # This documentation
```

## 🧪 Available Utilities

### 1. `learn-tg-mocks.ts` – Application-specific Mocks

**Purpose:** Mock Learn.tg's internal libraries and modules used across API routes and components.

#### **Exported Functions:**

| Function | Returns | Purpose |
|----------|---------|---------|
| `mockMetricsQueries()` | `MetricsQueriesMocks` | Mocks `@/lib/metrics/queries` functions (`getAllMetrics`, `getCompletionRate`, etc.) |
| `mockCrypto()` | `CryptoMocks` | Mocks `@/lib/crypto` functions (`callWriteFun`, `waitForReceiptWithRetry`) |
| `mockScores()` | `ScoresMocks` | Mocks `@/lib/scores` function (`updateUserAndCoursePoints`) |
| `mockMetricsServer()` | `MetricsServerMocks` | Mocks `@/lib/metrics-server` function (`recordEvent`) |
| `mockLibConfig()` | `LibConfigMocks` | Mocks `@/lib/config` constants (`IS_PRODUCTION`) |
| `setupApiMocks()` | `void` | **One-call setup:** Configures `vi.mock` for all Learn.tg modules |

#### **Internal Mocks (not exported):**
- `guideUtilsMocks`: Mocks for `@/lib/guide-utils` (used internally by `setupApiMocks`)
- `viemMocks` and `viemChainsMocks`: Imported from `@pasosdejesus/m/test-utils/viem-mocks`

#### **Usage Example:**
```typescript
import { setupApiMocks, mockCrypto, mockScores } from '@/test-utils/learn-tg-mocks'

beforeAll(() => {
  setupApiMocks() // Setup all module mocks at once
})

beforeEach(() => {
  const cryptoMocks = mockCrypto()
  const scoresMocks = mockScores()

  // Configure specific mock responses
  cryptoMocks.callWriteFun.mockResolvedValue('0xtxhash')
  scoresMocks.updateUserAndCoursePoints.mockResolvedValue(undefined)
})
```

### 2. `crossword-mocks.ts` – Crossword Puzzle Mocks

**Purpose:** Mock crossword puzzle generation and processing modules.

#### **Exported Utilities:**

| Function/Constant | Type | Purpose |
|------------------|------|---------|
| `crosswordMocks` | `object` | Pre-configured mocks: `fs`, `remarkFillInTheBlank`, `crosswordLayout` |
| `setupCrosswordMocks()` | `function` | Setup all crossword-related mocks |
| `resetCrosswordMocks()` | `function` | Reset all crossword mock implementations |

#### **Internal Functions (not exported):**
- `createRemarkFillInTheBlankMock()`: Creates mock for `@/lib/remarkFillInTheBlank.mjs`
- `createCrosswordLayoutMock()`: Creates mock for `crossword-layout-generator-with-isolated`

#### **Usage Example:**
```typescript
import { crosswordMocks, setupCrosswordMocks, resetCrosswordMocks } from '@/test-utils/crossword-mocks'

beforeAll(() => {
  setupCrosswordMocks()
})

beforeEach(() => {
  resetCrosswordMocks()
  // Configure fs mock responses
  crosswordMocks.fs.mockReadFile.mockResolvedValue('# Guide content')
})
```

## 🚀 Usage Guidelines

### **Import Order**
Always import and setup mocks **before** importing the modules under test:

```typescript
// 1. Import test utilities
import { setupApiMocks } from '@/test-utils/learn-tg-mocks'
import { setupCrosswordMocks } from '@/test-utils/crossword-mocks'

// 2. Setup mocks in beforeAll
beforeAll(() => {
  setupApiMocks()
  setupCrosswordMocks()
})

// 3. Import route/module AFTER mocks are configured
let GET: any
beforeAll(async () => {
  const mod = await import('../route')
  GET = mod.GET
})
```

### **Mock Lifecycle**
- `setup*Mocks()`: Call in `beforeAll` to configure `vi.mock` calls
- `reset*Mocks()`: Call in `beforeEach` to reset mock implementations
- Use `vi.clearAllMocks()` for general cleanup

### **Combining with Generic Mocks**
Use together with generic mocks from `@pasosdejesus/m/test-utils`:

```typescript
import { apiDbMocks } from '@pasosdejesus/m/test-utils/kysely-mocks'
import { createAuthMocks } from '@pasosdejesus/m/test-utils/rainbowkit-mocks'
import { setupApiMocks } from '@/test-utils/learn-tg-mocks'

beforeAll(() => {
  apiDbMocks.setupMocks()
  createAuthMocks().setupMocks()
  setupApiMocks()
})
```

## 🔗 Related Documentation

- **[`@pasosdejesus/m/test-utils`](../node_modules/@pasosdejesus/m/src/test-utils/README.md)** – Generic mocking utilities (Kysely, authentication, Radix UI, etc.)

## 📝 Recent Changes (2026-02-15)

**Simplification completed:**
- ❌ Removed `resetApiMocks()` (used only once; replaced with `vi.clearAllMocks()`)
- 🔄 Made `createRemarkFillInTheBlankMock()` and `createCrosswordLayoutMock()` internal (not exported)
- ✅ Maintained all widely-used functions (2-9 usages each)

**Result:** Cleaner API with only necessary exports.

---

*"For God has not given us a spirit of timidity, but of power, love, and self-discipline" (2 Timothy 1:7)*