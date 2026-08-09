import { NextRequest, NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { sql } from 'kysely'

export async function GET(_req: NextRequest, { params }: { params: Record<string, string> }) {
  const id = params.path?.split('/').pop() || ''
  const db = newKyselyPostgresql()

  const forms = await sql<{ id: number; nombre: string; nombreinterno: string }>`
    SELECT id, nombre, nombreinterno FROM mr519_gen_formulario WHERE id = ${parseInt(id)}
  `.execute(db)
  if (forms.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const form = forms.rows[0]

  const fields = await sql<{ id: number; nombre: string; nombreinterno: string; tipo: number; obligatorio: boolean; ayudauso: string | null; ancho: number | null; columna: number | null; fila: number | null }>`
    SELECT id, nombre, nombreinterno, tipo, obligatorio, ayudauso, ancho, columna, fila
    FROM mr519_gen_campo WHERE formulario_id = ${parseInt(id)} ORDER BY fila, columna
  `.execute(db)

  const selectFieldIds = fields.rows.filter((f: any) => [7,8,9,10].includes(f.tipo)).map((f: any) => f.id)
  let options: any[] = []
  if (selectFieldIds.length > 0) {
    const result = await sql`SELECT id, campo_id, nombre, valor FROM mr519_gen_opcioncs WHERE campo_id = ANY(${selectFieldIds}) ORDER BY id`.execute(db)
    options = result.rows
  }
  const optsByField: Record<number, any[]> = {}
  for (const o of options as any[]) { if (!optsByField[o.campo_id]) optsByField[o.campo_id] = []; optsByField[o.campo_id].push(o) }

  return NextResponse.json({ ...form, fields: fields.rows.map((f: any) => ({ ...f, options: optsByField[f.id] || [] })) })
}
