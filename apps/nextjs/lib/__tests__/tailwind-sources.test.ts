import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Tailwind v4 NO escanea `node_modules` por su cuenta (https://github.com/pasosdeJesus/learn.tg/issues/259):
// las clases que solo existen dentro de `@pasosdejesus/m` (el `Switch` de shadcn, las
// animaciones de `Dialog`, las variantes del `Toast`) no se generaban. El interruptor de
// privacidad cambiaba de estado y se guardaba, pero se veia inerte porque su pulgar nunca
// recibia `translate-x-5` ni su pista `bg-primary`/`bg-input`.
// `@source` incluye el paquete al escanear; sin el, la regresion vuelve en silencio.

const APP_DIR = join(__dirname, '..', '..')
const GLOBALS_CSS = join(APP_DIR, 'app', 'globals.css')

// Solo directivas activas: al principio de una linea (una `@source` comentada no escanea
// y dejaria el test pasando en falso).
function sourceDirectives(css: string): string[] {
  return [...css.matchAll(/^@source\s+['"]([^'"]+)['"]/gm)].map((match) => match[1])
}

describe('tailwind-sources (R-#259)', () => {
  it('scans the shadcn components of @pasosdejesus/m', () => {
    const css = readFileSync(GLOBALS_CSS, 'utf8')
    const sources = sourceDirectives(css)

    expect(sources.length).toBeGreaterThan(0)
    expect(sources.some((source) => source.includes('@pasosdejesus/m'))).toBe(true)
  })

  it('resolves every @source to a directory that exists', () => {
    const css = readFileSync(GLOBALS_CSS, 'utf8')

    for (const source of sourceDirectives(css)) {
      const resolved = join(APP_DIR, 'app', source)
      expect(existsSync(resolved), `@source ${source} no existe`).toBe(true)
      expect(statSync(resolved).isDirectory()).toBe(true)
    }
  })

  it('covers the components whose classes live in the package', () => {
    const css = readFileSync(GLOBALS_CSS, 'utf8')
    const source = sourceDirectives(css).find((candidate) =>
      candidate.includes('@pasosdejesus/m'),
    )

    expect(source).toBeDefined()
    const shadcnDir = join(APP_DIR, 'app', source as string)

    for (const component of ['switch', 'dialog', 'toast']) {
      expect(existsSync(join(shadcnDir, 'ui', `${component}.js`)), `${component}.js`).toBe(true)
    }

    // El pulgar del interruptor: si esta clase no se genera, el control se ve inerte.
    const switchSource = readFileSync(join(shadcnDir, 'ui', 'switch.js'), 'utf8')
    expect(switchSource).toContain('data-[state=checked]:translate-x-5')
    expect(switchSource).toContain('data-[state=checked]:bg-primary')
  })

  // La verificacion real: compilar `globals.css` con el mismo plugin que usa Next
  // (`@tailwindcss/postcss`) y comprobar que la clase del pulgar aparece en la salida.
  it('generates the switch classes when the CSS is compiled', async () => {
    const postcss = (await import('postcss')).default
    const tailwind = (await import('@tailwindcss/postcss')).default

    const compiled = await postcss([tailwind()]).process(readFileSync(GLOBALS_CSS, 'utf8'), {
      from: GLOBALS_CSS,
    })

    expect(compiled.css).toContain('.data-\\[state\\=checked\\]\\:translate-x-5')
    expect(compiled.css).toContain('.data-\\[state\\=checked\\]\\:bg-primary')
    expect(compiled.css).toContain('.data-\\[state\\=unchecked\\]\\:bg-input')
  }, 60000)
})
