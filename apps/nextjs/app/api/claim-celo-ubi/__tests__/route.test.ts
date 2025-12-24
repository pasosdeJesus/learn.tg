
import { NextRequest } from 'next/server';
import { vi, describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';

// --- Kysely & DB Mocking (from check-crossword) ---
const mockExecuteTakeFirst = vi.fn();

class MockKysely {
  selectFrom() { return this; }
  where() { return this; }
  selectAll() { return this; }
  executeTakeFirst() { return mockExecuteTakeFirst(); }
}

vi.mock('@/.config/kysely.config.ts', () => ({
  newKyselyPostgresql: () => new MockKysely(),
}));

// --- Viem & Contract Mocking ---
const mockReadContract = vi.fn();
const mockWriteContract = vi.fn();
const mockWaitForTransactionReceipt = vi.fn();

vi.mock('viem', async () => {
    const actual = await vi.importActual('viem');
    return {
        ...actual,
        createPublicClient: vi.fn(() => ({
            readContract: mockReadContract,
            waitForTransactionReceipt: mockWaitForTransactionReceipt,
        })),
        createWalletClient: vi.fn(() => ({ 
            writeContract: mockWriteContract,
        })),
        http: vi.fn(),
    };
});

vi.mock('viem/accounts', async () => {
    const actual = await vi.importActual('viem/accounts');
    return {
        ...actual,
        privateKeyToAccount: vi.fn(() => '0xMockAccount'),
    };
});


// --- NextAuth Mocking ---
vi.mock('next-auth/next', () => ({
  getServerSession: vi.fn(),
}));

// --- Main Test Suite ---
let POST: (req: NextRequest) => Promise<Response>;

describe('POST /api/claim-celo-ubi', () => {
  let getServerSession: any;

  beforeAll(async () => {
    const route = await import('../route');
    POST = route.POST;
  });

  beforeEach(() => {
    vi.clearAllMocks();

    const nextAuth = require('next-auth/next');
    getServerSession = vi.mocked(nextAuth.getServerSession);

    vi.stubEnv('CELO_RPC_URL', 'http://localhost:8545');
    vi.stubEnv('CELO_UBI_CONTRACT_ADDRESS', '0xMockAddress');
    vi.stubEnv('BACKEND_WALLET_PRIVATE_KEY', '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  const mockRequest = new NextRequest('http://localhost', { method: 'POST' });

  it('should return 401 if user is not logged in', async () => {
    getServerSession.mockResolvedValue(null);
    const response = await POST(mockRequest);
    expect(response.status).toBe(401);
  });

  it('should return 404 if user is not found', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    mockExecuteTakeFirst.mockResolvedValue(null);
    const response = await POST(mockRequest);
    expect(response.status).toBe(404);
  });

  it('should return 403 if profile score is less than 50', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    const mockUser = { id: 1, profilescore: 49 };
    mockExecuteTakeFirst.mockResolvedValue(mockUser);
    const response = await POST(mockRequest);
    expect(response.status).toBe(403);
  });

  it('should return 400 if user has no wallet', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    const mockUser = { id: 1, profilescore: 75 };
    mockExecuteTakeFirst.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null);
    const response = await POST(mockRequest);
    expect(response.status).toBe(400);
  });

  it('should return 429 if cooldown period is not over', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    const mockUser = { id: 1, profilescore: 75 };
    const mockWallet = { billetera: '0x123' };
    mockExecuteTakeFirst.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockWallet);
    mockReadContract.mockResolvedValue(BigInt(Math.floor(Date.now() / 1000)));

    const response = await POST(mockRequest);
    expect(response.status).toBe(429);
  });

  it('should return 400 if contract call reverts', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    const mockUser = { id: 1, profilescore: 75 };
    const mockWallet = { billetera: '0x123' };
    mockExecuteTakeFirst.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockWallet);
    mockReadContract.mockResolvedValue(BigInt(0)); 
    mockWriteContract.mockRejectedValue(new Error('Transaction reverted'));

    const response = await POST(mockRequest);
    expect(response.status).toBe(500);
  });

  it('should return 200 on successful claim', async () => {
    getServerSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    const mockUser = { id: 1, profilescore: 80 };
    const mockWallet = { billetera: '0x123' };
    mockExecuteTakeFirst.mockResolvedValueOnce(mockUser).mockResolvedValueOnce(mockWallet);

    mockReadContract.mockResolvedValue(BigInt(0));
    mockWriteContract.mockResolvedValue({ hash: '0xabc123' });
    mockWaitForTransactionReceipt.mockResolvedValue({ status: 'success' });

    const response = await POST(mockRequest);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.transactionHash).toBe('0xabc123');
  });
});
