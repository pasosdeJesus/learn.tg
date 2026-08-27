import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'kysely'
import type { Mr519Deps } from '../deps'

export function makeGetForms(deps: Mr519Deps) {
  return async function GET() {
    const db = deps.db()
    const forms = await sql<{ id: number; nombre: string; nombreinterno: string; created_at: string }>`
      SELECT id, nombre, nombreinterno, created_at FROM mr519_gen_formulario ORDER BY nombre
    `.execute(db)
    return NextResponse.json({ forms: forms.rows })
  }
}
