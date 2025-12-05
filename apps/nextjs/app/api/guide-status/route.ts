
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'

import { authOptions } from '@/app/api/auth/auth-options'
import { newKyselyPostgresql } from '@/.config/kysely.config.ts'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const walletAddress = searchParams.get('walletAddress')
  const courseId = searchParams.get('courseId')
  const guideNumberStr = searchParams.get('guideNumber')
  const db = newKyselyPostgresql()

  // 1. Validar parámetros
  if (!walletAddress || !courseId || !guideNumberStr) {
    return NextResponse.json(
      { error: 'Parámetros requeridos ausentes' },
      { status: 400 },
    )
  }

  const guideNumber = parseInt(guideNumberStr, 10)
  if (isNaN(guideNumber) || guideNumber <= 0) {
    return NextResponse.json({ error: 'guideNumber inválido' }, { status: 400 })
  }

  // 2. Validar sesión
  const session = await getServerSession(authOptions)
  if (!session || session.address !== walletAddress) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    // 3. Obtener usuario_id desde walletAddress
    const userRecord = await db
      .selectFrom('billetera_usuario')
      .select('usuario_id')
      .where('billetera', '=', walletAddress)
      .executeTakeFirst()

    if (!userRecord) {
      // Si el usuario no existe, no puede haber completado nada.
      return NextResponse.json({
        completed: false,
        receivedScholarship: false,
      })
    }
    const userId = userRecord.usuario_id

    // 4. Obtener actividadpf_id
    const activities = await db
      .selectFrom('cor1440_gen_actividadpf')
      .select('id')
      .where('proyectofinanciero_id', '=', Number(courseId))
      .orderBy('nombrecorto', 'asc')
      .execute()

    if (activities.length < guideNumber) {
      return NextResponse.json(
        { error: 'Guía no encontrada para este curso' },
        { status: 404 },
      )
    }
    const actividadpfId = activities[guideNumber - 1].id

    // 5. Consultar la tabla guide_usuario
    const guideStatus = await db
      .selectFrom('guide_usuario')
      .select(['points', 'amountpaid'])
      .where('usuario_id', '=', userId)
      .where('actividadpf_id', '=', Number(actividadpfId))
      .executeTakeFirst()

    let completed = false
    let receivedScholarship = false

    if (guideStatus) {
      completed = guideStatus.points > 0
      receivedScholarship = Number(guideStatus.amountpaid) > 0
    }

    // 6. Devolver el resultado
    return NextResponse.json({ completed, receivedScholarship })
  } catch (error) {
    console.error('Error en API guide-status:', error)
    return NextResponse.json(
      { error: 'Error Interno del Servidor' },
      { status: 500 },
    )
  }
}

