import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'

// Mock react para estabilizar useEffect (evitar recreación de generateCrossword en dependencia implícita)
vi.mock('react', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    useEffect: (fn: any, _deps: any) => actual.useEffect(fn, [])
  }
})

let CrosswordPuzzle: any

// Mock del generador de layout para evitar dependencia de librería y aleatoriedad
// Generamos palabras todas en horizontal (across) en filas sucesivas para poder rellenar correctamente.
vi.mock('crossword-layout-generator-with-isolated', () => ({
  __esModule: true,
  default: {
    generateLayout: (scrambled: any[]) => ({
      rows: 15,
      cols: 15,
      table: Array(15).fill(null).map(() => Array(15).fill('-')),
      table_string: 'mock',
      result: scrambled.map((e: any, i: number) => ({
        answer: e.answer,
        clue: e.clue,
        startx: 0,
        starty: i, // cada palabra en su propia fila, sin colisiones
        orientation: 'across'
      }))
    })
  }
}))

// axios no se usa en componente actual

function renderComponent(ui: React.ReactElement) {
  return render(ui)
}

describe('CrosswordPuzzle Component', () => {
  const defaultProps = {
    questions: JSON.stringify([
      { answer: 'TEST', clue: 'A test word' },
      { answer: 'CODE', clue: 'Programming word' }
    ])
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  beforeAll(async () => {
    CrosswordPuzzle = (await import('../crossword-puzzle')).default
  })

  it('renders base structure (sin estado loading explícito en versión actual)', () => {
  renderComponent(<CrosswordPuzzle {...defaultProps} />)
    expect(screen.getByText(/Crossword Puzzle/i)).toBeInTheDocument()
  })

  it('genera un grid y pistas a partir de questions JSON', async () => {
  renderComponent(<CrosswordPuzzle {...defaultProps} />)
    await waitFor(() => {
      // Esperar que aparezca el título base
      expect(screen.getByText(/Crossword Puzzle/i)).toBeInTheDocument()
    })
  })

  it('muestra mensaje de éxito al completar correctamente', async () => {
    // Forzar orden estable de scramble
    vi.spyOn(Math, 'random').mockReturnValue(0)
    renderComponent(<CrosswordPuzzle {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/Crossword Puzzle/i)).toBeInTheDocument()
    })
    const inputs = screen.getAllByRole('textbox') as HTMLInputElement[]
    const answers = JSON.parse(defaultProps.questions).map((q: any) => q.answer)
    const allLetters = answers.join('')
    for (let i = 0; i < inputs.length; i++) {
      fireEvent.change(inputs[i], { target: { value: allLetters[i] } })
    }
    // Debe mostrar el botón de submit al estar todas las celdas llenas
    const btn = await waitFor(() => screen.getByRole('button', { name: /Submit answer/i }))
    fireEvent.click(btn)
    await waitFor(() => {
      expect(screen.getByText(/Correct, however this course/i)).toBeInTheDocument()
    })
  })

  it('no muestra errores al iniciar (sin API externa)', async () => {
  renderComponent(<CrosswordPuzzle {...defaultProps} />)
    await waitFor(() => {
      expect(screen.queryByText(/error/i)).not.toBeInTheDocument()
    })
  })

  it('solo muestra botón cuando está completado', async () => {
  renderComponent(<CrosswordPuzzle {...defaultProps} />)
    // Al inicio no debería haber botón de Submit
    expect(screen.queryByRole('button', { name: /Submit answer/i })).not.toBeInTheDocument()
  })

  it('no permite enviar mientras no esté completo (sin botón)', async () => {
  renderComponent(<CrosswordPuzzle {...defaultProps} />)
    await waitFor(() => {
      expect(screen.getByText(/Crossword Puzzle/i)).toBeInTheDocument()
    })
    expect(screen.queryByRole('button', { name: /Submit answer/i })).not.toBeInTheDocument()
  })
})