import { NextRequest, NextResponse } from 'next/server'
import { newKyselyPostgresql } from '@/.config/kysely-db'
import { authenticateUser } from '@/lib/authenticateUser'
import { sql } from 'kysely'

export async function POST(req: NextRequest, { params }: { params: Record<string, string> }) {
  const p = params.path || ''
  const parts = p.split('/')
  const formId = parseInt(parts[0] || '0')
  const body = await req.json()
  const { walletAddress, token, values } = body

  if (!walletAddress || !token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  try {
    const db = newKyselyPostgresql()
    const auth = await authenticateUser(db, walletAddress, token)
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const exists = await sql`SELECT id FROM mr519_gen_formulario WHERE id = ${formId}`.execute(db)
    if (exists.rows.length === 0) return NextResponse.json({ error: 'Form not found' }, { status: 404 })

    const today = new Date().toISOString().slice(0, 10)
    const resp = await sql`INSERT INTO mr519_gen_respuestafor (formulario_id, fechaini, fechacambio) VALUES (${formId}, ${today}, ${today}) RETURNING id`.execute(db)
    const respuestaId = (resp.rows[0] as any).id

    if (values && typeof values === 'object') {
      for (const [campoId, valor] of Object.entries(values)) {
        const tipoRes = await sql`SELECT tipo FROM mr519_gen_campo WHERE id = ${parseInt(campoId)}`.execute(db)
        if (tipoRes.rows.length === 0) continue
        const isMulti = [8, 9].includes((tipoRes.rows[0] as any).tipo)
        await sql`INSERT INTO mr519_gen_valorcampo (campo_id, respuestafor_id, valor, valorjson) VALUES (${parseInt(campoId)}, ${respuestaId}, ${isMulti ? null : String(valor)}, ${isMulti ? JSON.stringify(valor) : null}::json)`.execute(db)
      }
    }

    await sql`INSERT INTO mr519_gen_encuestausuario (usuario_id, respuestafor_id, fechainicio) VALUES (${auth.usuario.id}, ${respuestaId}, ${today})`.execute(db)
    return NextResponse.json({ id: respuestaId }, { status: 201 })
  } catch (error) {
    console.error('Error submitting form response:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
