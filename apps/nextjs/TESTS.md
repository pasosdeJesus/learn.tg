# Testing Plan - test-utils and coverage

**"Y todo lo que hagáis, hacedlo de corazón, como para el Señor y no para los hombres" (Colosenses 3:23)** *(Whatever you do, work at it with all your heart, as working for the Lord, not for human masters)*

---

## 🛠️ Available Utilities (`/test-utils/`)

### **`api-mocks.ts`** - Mocks for specific modules:
- `mockMetricsQueries()` - lib/metrics/queries
- `mockCrypto()` - lib/crypto
- `mockScores()` - lib/scores
- `mockGuideUtils()` - lib/guide-utils
- `mockViem()` - viem module (blockchain interactions) - includes `privateKeyToAccount`, `formatUnits`, `viem/chains`
- `mockMetricsServer()` - lib/metrics-server
- `mockLibConfig()` - lib/config
- `createMockNextRequest()` - NextRequest constructor
- `setupApiMocks()` - Setup all module mocks
- `setupCommonRouteMocks()` - Unified configuration for APIs
- `resetApiMocks()` - Reset mock implementations

### **`db-mocks.ts`** - Kysely and PostgreSQL mocks:
- `createMockKysely()` - Configurable mock instance
- `apiDbMocks` / `libDbMocks` - Pre-configured

### **`auth-mocks.ts`** - Authentication mocks:
- `createAuthMocks()` - Configurable mocks for **SIWE (SiweMessage)**, NextAuth, Wagmi
- `apiAuthMocks` / `hookAuthMocks` - Pre-configured
- **Covers**: `mockSiweMessage`, `mockGetCsrfToken`, `mockUseSession`, `mockUseAccount`

### **`auth-db-mocks.ts`** - Combined authentication and database mocks:
- `createAuthDbMocks()` - Configurable mocks for **auth-options tests** (SIWE + Kysely + PostgreSQL)
- `authOptionsMocks` - Pre-configured combined mocks
- **Covers**: `mockSiweMessage`, `mockGetCsrfToken`, `mockExecuteTakeFirst`, `mockExecute`, `mockSqlExecute`, `mockSql`, `mockSelectFrom`, `mockInsertInto`, `mockUpdateTable`

### **`render-utils.tsx`** - Utilities for React components:
- `renderWithProviders()` - Render with all necessary providers
- `mockUseRouter()` - Mock of next/navigation
- `mockUseSession()` - Mock of next-auth/react

### **`crossword-mocks.ts`** - Mocks for crossword tests:
- `createFsMocks()` - Mocks for fs/promises and node:fs/promises
- `createRemarkFillInTheBlankMock()` - Mock for remarkFillInTheBlank
- `createCrosswordLayoutMock()` - Mock for crossword-layout-generator
- `crosswordMocks` - Pre-configured
- `setupCrosswordMocks()` / `resetCrosswordMocks()` - Unified configuration

### **`index.ts`** - Unified export

**Note:** Mocks will be used, not real database in tests.

---

## 📋 Checklist: Existing tests to migrate to test-utils

*Migrate all existing tests to reuse test-utils utilities*

### **API Routes**
- [✅] `app/api/metrics/route.ts` - *Migrated using test-utils*
- [✅] `app/api/check-crossword/route.ts` - *Migrated to test-utils*
- [✅] `app/api/claim-celo-ubi/route.ts` - *Migrated using test-utils*
- [✅] `app/api/crossword/route.ts` - *Migrated using test-utils*
- [✅] `app/api/guide-status/route.ts`
- [✅] `app/api/guide/route.ts` - *Migrated using test-utils*
- [✅] `app/api/scholarship/route.ts`
- [✅] `app/api/ubi-report/route.ts`
- [✅] `app/api/ubi-report-wallet/route.ts`
- [✅] `app/api/auth/auth-options.ts` - *Migrated to use `auth-db-mocks.ts` (all tests passing)*

### **Libraries (lib/)**
- [✅] `lib/guide-utils.test.ts` - *Migration completed (MockKysely working)*
- [✅] `lib/scores.test.ts` - *Migration completed (MockKysely configured, tests passing)*
- [✅] `lib/deeplink.test.ts` - *Tests passing*
- [✅] `lib/metrics-server.test.ts` - *Migrated to test-utils*
- [✅] `lib/mobile-detection.test.ts` - *Tests passing, does not require test-utils*
- [✅] `lib/remarkFillInTheBlank.test.ts` - *Tests passing, does not require test-utils*
- [✅] `lib/crypto.test.ts` - *Already uses test-utils mocks (verified)*
- [✅] `lib/utils.test.ts` - *Tests passing, does not require test-utils*

### **Hooks**
- [✅] `lib/hooks/useGuideData.test.ts` - *Migrated to use auth-mocks.ts*

### **Components**
- [✅] `components/Layout.test.tsx` - *Tests passing, already uses custom render*
- [✅] `components/Header.test.tsx` - *Tests passing, simple render*
- [✅] `components/Footer.test.tsx` - *Tests passing, simple render*
- [✅] `components/DonateModal.test.tsx`
- [✅] `components/DonateModal.light.test.tsx`
- [✅] `components/CeloUbiButton.test.tsx`
- [✅] `components/GoodDollarClaimButton.test.tsx`

### **UI Components (shadcn/ui)**
- [✅] `components/ui/button.test.tsx` - *Tests passing*
- [✅] `components/ui/checkbox.test.tsx` - *Tests passing*
- [✅] `components/ui/input.test.tsx` - *Tests passing*
- [✅] `components/ui/label.test.tsx` - *Tests passing*
- [✅] `components/ui/radio-group.test.tsx` - *Tests passing*
- [✅] `components/ui/select.test.tsx` - *Tests passing*
- [✅] `components/ui/slider.test.tsx` - *Tests passing*
- [✅] `components/ui/switch.test.tsx` - *Tests passing*
- [✅] `components/ui/textarea.test.tsx` - *Tests passing*
- [✅] `components/ui/completed-progress.test.tsx` - *Tests passing*
- [✅] `components/ui/qr-code-dialog.test.tsx` - *Tests passing*

### **Pages**
- [✅] `app/[lang]/page.test.tsx` - *Tests passing*
- [✅] `app/[lang]/[pathPrefix]/page.test.tsx` - *Tests passing*
- [✅] `app/[lang]/[pathPrefix]/page.integration.spec.tsx` - *Tests passing*
- [✅] `app/[lang]/[pathPrefix]/[pathSuffix]/page.test.tsx` - *Tests passing*
- [✅] `app/[lang]/[pathPrefix]/[pathSuffix]/test/page.test.tsx` - *Tests passing*

---

## 🎯 After finishing migration to test-utils

*Once all existing tests reuse test-utils, create tests for files without coverage*

### **Critical API Routes (0%)**
1. ✅ `app/api/update-scores/route.ts` - *Tests created*
2. ✅ `app/api/sign-refgd-claim/route.ts` - *Tests created*
3. `app/api/self-verify/route.ts` - Self-verification *No implementado - complejo por dependencia de @selfxyz/core*
4. `app/api/metrics/health/route.ts` - Health check *No implementado*

### **Main Pages (0%)**
1. `app/layout.tsx` - Root layout
2. `app/page.tsx` - Home page
3. `app/[lang]/profile/page.tsx` - User profile
4. `app/[lang]/privacy-policy/page.tsx` - Privacy policy
5. `app/metrics/page.tsx` - Metrics dashboard

### **UI Components (shadcn/ui) without tests**
- `accordion.tsx`, `alert-dialog.tsx`, `alert.tsx`, `avatar.tsx`, `badge.tsx`
- `dropdown-menu.tsx`, `form.tsx`, `menubar.tsx`, `popover.tsx`
- `progress.tsx`, `scroll-area.tsx`, `separator.tsx`, `sheet.tsx`
- `skeleton.tsx`, `table.tsx`, `tabs.tsx`, `toast.tsx`, `tooltip.tsx`

### **System and Utilities (0%)**
1. `db/database.ts` - Kysely configuration
2. `lib/metrics/queries.ts` - Metrics queries (401 lines)
3. `providers/AppProvider.tsx` - Global provider
4. `db/migrations/` - Migrations (12 files, low priority)
5. Utility scripts (low priority)

---

## 📝 Work order

### **Phase 1: Fix test-utils architecture** ✅ **COMPLETED**
- ✅ Solve hoisting issues in `api-mocks.ts`
- ✅ Validate that utilities work correctly
- ✅ Completely migrate `app/api/metrics/route.ts` as pilot test

### **Phase 2: Migrate all existing tests to test-utils** ✅ **COMPLETED**
- ✅ Migration completed for APIs: `check-crossword`, `scholarship`, `ubi-report-wallet`
- ✅ viem mocks updated with `privateKeyToAccount`, `formatUnits`, `viem/chains`
- ✅ `auth-options.ts` migrated to use `auth-db-mocks.ts` (all tests passing)
- ✅ Libraries: `guide-utils.test.ts`, `scores.test.ts`, `deeplink.test.ts`, `metrics-server.test.ts` migrated to test-utils; `crypto.test.ts` already uses test-utils
- ✅ `useGuideData.test.ts` migrated
- ✅ All UI component tests verified and passing
- ✅ All page tests verified and passing

### **Phase 3: Create tests for files without coverage** ⏳ **IN PROGRESS**
- ✅ `app/api/update-scores/route.ts` - Tests created (5 tests passing)
- ✅ `app/api/sign-refgd-claim/route.ts` - Tests created (4 tests passing)
- ❌ `app/api/self-verify/route.ts` - Pending (complex due to @selfxyz/core dependency)
- ❌ `app/api/metrics/health/route.ts` - Pending
- ❌ Main pages (`app/layout.tsx`, `app/page.tsx`, etc.) - Pending
- ❌ UI components without tests - Pending
- ❌ System and utilities - Pending
- Use test-utils and mocks (no real database)
- Focus on critical functionality first

---

> *"For God has not given us a spirit of timidity, but of power, love, and self-discipline" (2 Timothy 1:7)*

**Goal:** Have a robust, maintainable test suite with good coverage using reusable utilities, operating under the Christian hermeneutical framework according to Bayesian analysis.