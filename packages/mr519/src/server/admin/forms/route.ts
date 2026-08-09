import { NextRequest, NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { authenticateAdmin } from '@/lib/admin-auth'
import { sql } from 'kysely'

export async function POST(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get('wallet') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  try {
    const db = newKyselyPostgresql()
    const admin = await authenticateAdmin(db, wallet, token)
    if (!admin) return NextResponse.json({ error: 'Access denied' }, { status: 403 })

    const body = await req.json()
    const { nombre, nombreinterno, fields } = body
    if (!nombre || !nombreinterno) return NextResponse.json({ error: 'nombre and nombreinterno required' }, { status: 400 })
    if (!/^[a-z0-9_]+$/.test(nombreinterno)) return NextResponse.json({ error: 'nombreinterno: lowercase alphanumeric + _' }, { status: 400 })

    const form = await sql<{ id: number }>`INSERT INTO mr519_gen_formulario (nombre, nombreinterno) VALUES (${nombre}, ${nombreinterno}) RETURNING id`.execute(db)
    const formId = form.rows[0].id

    if (fields && Array.isArray(fields)) {
      for (const f of fields) {
        const c = await sql<{ id: number }>`
          INSERT INTO mr519_gen_campo (formulario_id, nombre, nombreinterno, tipo, obligatorio, ayudauso, fila, columna)
          VALUES (${formId}, ${f.nombre}, ${f.nombreinterno || f.nombre.toLowerCase().replace(/[^a-z0-9_]/g, '_')}, ${f.tipo || 3}, ${f.obligatorio || false}, ${f.ayudauso || null}, ${f.fila || 1}, ${f.columna || 6})
          RETURNING id`.execute(db)
        if (f.options && Array.isArray(f.options)) {
          for (const o of f.options) {
            await sql`INSERT INTO mr519_gen_opcioncs (campo_id, nombre, valor) VALUES (${c.rows[0].id}, ${o.nombre || o}, ${o.valor || String(o)})`.execute(db)
          }
        }
      }
    }
    return NextResponse.json({ id: formId }, { status: 201 })
  } catch (error) {
    console.error('Error creating form:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
