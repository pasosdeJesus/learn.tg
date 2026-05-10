/**
 * Test-only: Mock Kysely instance for tests.
 * This module is NOT imported by any production code.
 */
import { createMockKysely } from '@pasosdejesus/m/test-utils/kysely-mocks'

const { MockKysely } = createMockKysely()
export const testDb = new MockKysely() as any
