import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

// `app/globals.css` estiliza los elementos (`a`, `button`, …) **fuera de `@layer base`**.
// Tailwind v4 emite las utilidades en `@layer utilities` y lo no estratificado gana
// siempre, asi que `a { color: var(--color-primary-300) }` pisa `text-white`: un enlace
// con fondo de color (por ejemplo `bg-primary text-white`) muestra el morado del enlace
// sobre el fondo morado y queda **invisible**. Reporte del operador, 2026-10-27
// ("Go to my cluster"): el mismo error ya se habia parcheado en linea en PastorLanding.
//
// Regla: en un `<Link>`/`<a>` con `bg-*` el color del texto va con el modificador
// importante (`text-white!`, sintaxis de Tailwind v4) o en linea. Los `<button>` no se
// ven afectados porque la regla de elemento no fija `color`.
// Detalle y arreglo estructural (mover las reglas a `@layer base`) en
// `apps/web/CONTRIBUTING.md` §Styling.

const APP_DIR = join(__dirname, '..', '..')

// Utilidades de color de texto que el `a { color }` de globals.css pisa.
const FOREGROUND = /\b(text-white|text-primary-foreground|text-secondary-foreground)\b/
const IMPORTANT = /\b(text-white|text-primary-foreground|text-secondary-foreground)!/

function tsxFiles(dir: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) files.push(...tsxFiles(full))
    else if (entry.endsWith('.tsx')) files.push(full)
  }
  return files
}

describe('anchor contrast (globals.css pisa las utilidades en <a>)', () => {
  it('uses text-white! on every <Link>/<a> that has a background color', () => {
    const offenders: string[] = []

    for (const file of [...tsxFiles(join(APP_DIR, 'app')), ...tsxFiles(join(APP_DIR, 'components'))]) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/<(?:Link|a)(?=[\s/>])[^>]*?>/gs)) {
        const tag = match[0]
        if (!/\bbg-[a-z]/.test(tag)) continue
        if (!FOREGROUND.test(tag)) continue
        if (IMPORTANT.test(tag)) continue
        if (/\bstyle=/.test(tag)) continue
        const line = source.slice(0, match.index).split('\n').length
        offenders.push(`${relative(APP_DIR, file)}:${line}`)
      }
    }

    expect(
      offenders,
      `usa text-white! (o un color en linea) en enlaces con fondo: ${offenders.join(', ')}`,
    ).toEqual([])
  })
})
