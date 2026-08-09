import { NextRequest, NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { sql } from 'kysely'

export async function GET() {
  const db = newKyselyPostgresql()
  const forms = await sql<{ id: number; nombre: string; nombreinterno: string; created_at: string }>`
    SELECT id, nombre, nombreinterno, created_at FROM mr519_gen_formulario ORDER BY nombre
  `.execute(db)
  return NextResponse.json({ forms: forms.rows })
}
