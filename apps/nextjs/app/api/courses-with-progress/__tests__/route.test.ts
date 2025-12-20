import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';
import { newKyselyPostgresql } from '@/.config/kysely.config';

vi.mock('@/.config/kysely.config', () => ({
  newKyselyPostgresql: vi.fn(),
}));

describe('GET /api/courses-with-progress', () => {
  let mockUserQueryChain: any;
  let mockCourseQueryChain: any;
  let mockDb: any;

  beforeEach(() => {
    vi.resetAllMocks();

    mockUserQueryChain = {
      executeTakeFirst: vi.fn(),
    };

    mockCourseQueryChain = {
      execute: vi.fn(),
    };

    mockDb = {
      selectFrom: vi.fn().mockImplementation((table: string) => {
        if (table === 'billetera_usuario') {
          return {
            innerJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue(mockUserQueryChain),
          };
        }
        if (table.startsWith('cor1440_gen_proyectofinanciero')) {
          return {
            leftJoin: vi.fn().mockReturnThis(),
            where: vi.fn().mockReturnThis(),
            groupBy: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnValue(mockCourseQueryChain),
          };
        }
        return {};
      }),
    };

    (newKyselyPostgresql as vi.Mock).mockReturnValue(mockDb);
  });

  it('should return courses with correct progress when user exists', async () => {
    const mockUser = { userId: 1 };
    mockUserQueryChain.executeTakeFirst.mockResolvedValue(mockUser);

    const mockCoursesWithProgress = [
      {
        id: 101,
        titulo: 'Test Course',
        subtitulo: 'A course for testing',
        idioma: 'en',
        prefijoRuta: '/test-course',
        imagen: null,
        resumenMd: 'Summary',
        creditosMd: 'Credits',
        percentageCompleted: 100.0,
        percentagePaid: 0,
      },
    ];
    mockCourseQueryChain.execute.mockResolvedValue(mockCoursesWithProgress);

    const request = new Request('http://localhost/api/courses-with-progress?lang=en&walletAddress=0x123');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockCoursesWithProgress);
    expect(mockDb.selectFrom).toHaveBeenCalledWith('billetera_usuario');
    expect(mockDb.selectFrom).toHaveBeenCalledWith('cor1440_gen_proyectofinanciero as p');
    expect(mockUserQueryChain.executeTakeFirst).toHaveBeenCalled();
    expect(mockCourseQueryChain.execute).toHaveBeenCalled();
  });

  it('should return courses with zero progress when user does not exist', async () => {
    mockUserQueryChain.executeTakeFirst.mockResolvedValue(null);

    const mockCourses = [
        {
            id: 101,
            titulo: 'Test Course',
            // ... other properties from cor1440_gen_proyectofinanciero
        }
    ];
    // This uses a different query path
    const zeroProgressQueryChain = { execute: vi.fn().mockResolvedValue(mockCourses) };
    mockDb.selectFrom.mockImplementation((table: string) => {
        if (table === 'billetera_usuario') {
            return {
                innerJoin: vi.fn().mockReturnThis(),
                where: vi.fn().mockReturnThis(),
                select: vi.fn().mockReturnValue(mockUserQueryChain),
            };
        }
        if (table === 'cor1440_gen_proyectofinanciero') {
            return {
                where: vi.fn().mockReturnThis(),
                selectAll: vi.fn().mockReturnValue(zeroProgressQueryChain)
            }
        }
        return {};
    });

    const request = new Request('http://localhost/api/courses-with-progress?lang=en&walletAddress=0x456');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.length).toBe(1);
    expect(data[0].percentageCompleted).toBe(0);
    expect(data[0].percentagePaid).toBe(0);
    expect(zeroProgressQueryChain.execute).toHaveBeenCalled();
  });
});
