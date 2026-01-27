
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getCsrfToken, useSession } from 'next-auth/react'
import { useAccount, useConfig, useWriteContract } from 'wagmi'
import axios from 'axios'
import { Suspense } from 'react';

import Page from '../page'
import { useGuideData, Course, Guide } from '@/lib/hooks/useGuideData'

// Mock dependencies
vi.mock('next-auth/react')
vi.mock('wagmi')
vi.mock('@/lib/hooks/useGuideData')
vi.mock('axios')
vi.mock('next/navigation', () => ({
  useParams: () => ({ 
    lang: 'en',
    pathPrefix: 'course-prefix',
    pathSuffix: 'guide-suffix',
  }),
  useRouter: () => ({ push: vi.fn() }),
}))

const mockParams = Promise.resolve({
  lang: 'en',
  pathPrefix: 'course1',
  pathSuffix: 'guide1',
})

const mockSession = {
  data: {
    address: '0x1234567890123456789012345678901234567890',
    user: { id: '1', name: 'Test User', email: 'test@example.com' },
    expires: new Date(Date.now() + 2 * 86400 * 1000).toISOString(),
  },
  status: 'authenticated',
}

const mockAccount = {
  address: '0x1234567890123456789012345678901234567890',
  isConnecting: false,
  isReconnecting: false,
  isConnected: true,
}

const mockCourse: Course = {
    id: '1',
    titulo: 'Test Course',
    sinBilletera: false,
    conBilletera: true,
    idioma: 'en',
    prefijoRuta: 'test-course',
    creditosMd: '',
    guias: [],
}

const mockMyGuide: Guide = {
    titulo: 'Test Guide',
    sufijoRuta: 'test-guide',
}

const mockGuideData = {
  course: mockCourse,
  myGuide: {
      ...mockMyGuide,
      completed: false,
      receivedScholarship: false,
  },
  guideNumber: 1,
  loading: false,
  error: null,
  coursePath: '/en/course1',
  nextGuidePath: '',
  previousGuidePath: '',
  percentageCompleted: null,
  percentagePaid: null,
  amountScholarship: null,
}

const mockCrosswordData = {
  grid: [
    [
      { letter: 'T', number: 1, isBlocked: false, userInput: '', belongsToWords: [1] },
      { letter: 'E', number: 2, isBlocked: false, userInput: '', belongsToWords: [1] },
    ],
    [
      { letter: 'S', number: 2, isBlocked: false, userInput: '', belongsToWords: [2] },
      { letter: 'T', isBlocked: true, userInput: '', belongsToWords: [] },
    ],
  ],
  placements: [
    { word: 'TE', row: 0, col: 0, direction: 'across', number: 1, clue: 'Clue 1' },
    { word: 'ST', row: 1, col: 0, direction: 'across', number: 2, clue: 'Clue 2' },
  ],
};


// Mock localStorage
const localStorageMock = (() => {
  let store: { [key: string]: string } = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      for (const key in store) {
        delete store[key];
      }
    })
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });


describe('Crossword Page', () => {
  beforeEach(() => {
    // Assign mocks to the mocked functions
    vi.mocked(useSession).mockReturnValue(mockSession as any)
    vi.mocked(getCsrfToken).mockResolvedValue('mock-csrf-token');
    vi.mocked(useAccount).mockReturnValue(mockAccount as any)
    vi.mocked(useGuideData).mockReturnValue(mockGuideData as any)
    vi.mocked(useConfig).mockReturnValue({} as any)
    vi.mocked(useWriteContract).mockReturnValue({ data: null, writeContract: vi.fn() } as any)
    vi.mocked(axios.get).mockResolvedValue({ data: mockCrosswordData })
    vi.mocked(axios.post).mockResolvedValue({ data: {} })
  })

  afterEach(() => {
    localStorageMock.clear();
    vi.clearAllMocks()
  })

  describe('Component Rendering', () => {
    it('should display loading state from useGuideData', async () => {
        vi.mocked(useGuideData).mockReturnValue({ ...mockGuideData, loading: true });
        render(<Suspense fallback={<div>Loading test...</div>}><Page params={mockParams} /></Suspense>);
        await waitFor(() => {
            expect(screen.getByText('Loading test...')).toBeInTheDocument();
        })
    });

    it('should display error state from useGuideData', async () => {
        vi.mocked(useGuideData).mockReturnValue({ ...mockGuideData, loading: false, error: 'Custom Error' });
        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);
        await waitFor(() => {
            expect(screen.getByText('Error: Custom Error')).toBeInTheDocument();
        })
    });
    
    it('should display "Test not found" when course is missing', async () => {
        vi.mocked(useGuideData).mockReturnValue({ ...mockGuideData, course: null });
        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);
        await waitFor(() => {
            expect(screen.getByText('Test not found.')).toBeInTheDocument();
        })
    });
  });

  describe('API Interaction', () => {
    it('should fetch new crossword data if nothing is in localStorage', async () => {
        localStorageMock.getItem.mockReturnValueOnce(null);
        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);
        await waitFor(() => {
          expect(axios.get).toHaveBeenCalled();
          expect(screen.getByText('Clue 1')).toBeInTheDocument();
        });
    });

    it('should fetch new data if localStorage state is for a different puzzle', async () => {
        const oldState = {
          grid: [],
          placements: [],
          courseId: '99', // Different courseId
          guideId: 99,  // Different guideId
        };
        localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(oldState));

        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);

        await waitFor(() => {
          expect(axios.get).toHaveBeenCalled();
          expect(screen.getByText('Clue 1')).toBeInTheDocument();
        });
    });
  });

  describe('User Interaction and State', () => {
    it('should restore crossword state from localStorage if valid', async () => {
        const savedState = {
          grid: [
            [
              { letter: 'T', number: 1, isBlocked: false, userInput: 'A', belongsToWords: [1] },
            ]
          ],
          placements: mockCrosswordData.placements,
          courseId: '1',
          guideId: 1,
        };
        localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedState));

        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);

        await waitFor(() => {
          expect(axios.get).not.toHaveBeenCalled();
          const input = screen.getByDisplayValue('A') as HTMLInputElement;
          expect(input).toBeInTheDocument();
        });
    });

    it('should save progress to localStorage on input change', async () => {
        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);
        
        await waitFor(() => {
            expect(screen.getByText('Clue 1')).toBeInTheDocument();
        })
        
        const firstInput = screen.getAllByRole('textbox')[0];
        fireEvent.change(firstInput, { target: { value: 'X' } });

        await waitFor(() => {
          expect(localStorage.setItem).toHaveBeenCalled();
          const lastCallIndex = localStorageMock.setItem.mock.calls.length - 1;
          const savedData = JSON.parse(localStorageMock.setItem.mock.calls[lastCallIndex][1]);
          expect(savedData.grid[0][0].userInput).toBe('X');
        });
    });

    it('should show success message on correct submission', async () => {
        vi.mocked(axios.post).mockResolvedValue({ 
            data: { 
                message: 'Correct!', 
                scholarshipResult: '0x123abc',
                mistakesInCW: [] 
            } 
        });

        // Simulate a fully completed grid
        const completedGrid = JSON.parse(JSON.stringify(mockCrosswordData.grid));
        completedGrid[0][0].userInput = 'T';
        completedGrid[0][1].userInput = 'E';
        completedGrid[1][0].userInput = 'S';

        const savedState = {
          grid: completedGrid,
          placements: mockCrosswordData.placements,
          courseId: '1',
          guideId: 1,
        };
        localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(savedState));

        render(<Suspense fallback={<div>Loading...</div>}><Page params={mockParams} /></Suspense>);
        
        await waitFor(() => {
          const submitButton = screen.getByRole('button', { name: /submit/i });
          expect(submitButton).not.toBeDisabled();
          fireEvent.click(submitButton);
        });

        await waitFor(() => {
            expect(axios.post).toHaveBeenCalled();
            expect(screen.getByText('Correct!')).toBeInTheDocument();
            expect(screen.getByText('0x123abc')).toBeInTheDocument();
            expect(localStorage.removeItem).toHaveBeenCalled();
        });
    });
  });
});
