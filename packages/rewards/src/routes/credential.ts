import { NextRequest, NextResponse } from 'next/server'
import type { RewardsDeps } from '../index'

/**
 * GET /api/credential/[tokenId] — metadata ERC-1155 (público).
 * DB inyectada vía deps (D2, REQ/35 §11.2).
 */
export async function credentialByTokenId(
  deps: RewardsDeps,
  _request: NextRequest,
  params: Record<string, string>,
): Promise<Response> {
  const tokenIdStr = params.tokenId
  const tokenId = parseInt(tokenIdStr, 10)
  if (isNaN(tokenId) || tokenId < 1) {
    return NextResponse.json({ error: 'Invalid tokenId' }, { status: 400 })
  }

  try {
    const origin = (process.env.NEXT_PUBLIC_AUTH_URL || _request.nextUrl.origin).replace(/\/+$/, '')
    const db = deps.db()

    // Try credential_metadata cache first
    const cached = await db
      .selectFrom('credential_metadata')
      .select(['token_id', 'name', 'type', 'site', 'is_premium', 'is_soulbound', 'image_url', 'course_id'])
      .where('token_id', '=', tokenId)
      .executeTakeFirst()

    let name: string
    let isPremium: boolean
    let isSoulbound: boolean
    let imageUrl: string
    let courseId: number | null = null
    let lang = 'en'

    if (cached) {
      name = cached.name
      isPremium = cached.is_premium ?? false
      isSoulbound = cached.is_soulbound ?? true
      imageUrl = cached.image_url.startsWith('http')
        ? cached.image_url
        : `${origin}/${cached.image_url}`
      courseId = cached.course_id
    } else {
      // Fallback: read from Rails course table for backward compatibility
      const course = await db
        .selectFrom('cor1440_gen_proyectofinanciero')
        .select(['id', 'titulo', 'porPagar', 'idioma'])
        .where('id', '=', tokenId)
        .executeTakeFirst()

      if (!course) {
        return NextResponse.json({ error: 'Token not found' }, { status: 404 })
      }
      courseId = course.id
      name = course.titulo as string
      isPremium = course.porPagar !== null && Number(course.porPagar) > 0
      isSoulbound = true
      imageUrl = `${origin}/img/credential/${tokenId}.png`
      lang = (course.idioma || 'en') as string
    }

    const translations = {
      en: {
        description: (n: string, p: boolean) =>
          `Course credential proving completion of "${n}" on learn.tg. ` +
          (p ? 'Premium course.' : '') +
          ' This credential is non-transferable and serves as proof of learning achievement.',
        traitType: 'Type',
        traitValue: 'Course Completion',
        traitPremium: 'Premium',
        traitSoulbound: 'Soulbound',
      },
      es: {
        description: (n: string, p: boolean) =>
          `Credencial que certifica la finalización de "${n}" en learn.tg. ` +
          (p ? 'Curso premium.' : '') +
          ' Esta credencial es intransferible y sirve como prueba de logro educativo.',
        traitType: 'Tipo',
        traitValue: 'Finalización de curso',
        traitPremium: 'Premium',
        traitSoulbound: 'Soulbound',
      },
    }
    const t = translations[lang as keyof typeof translations] || translations.en

    const metadata = {
      name,
      description: t.description(name, isPremium),
      image: imageUrl,
      external_url: courseId ? `${origin}/${lang}/course/${courseId}` : undefined,
      attributes: [
        { trait_type: t.traitType, value: t.traitValue },
        { trait_type: t.traitPremium, value: isPremium },
        { trait_type: t.traitSoulbound, value: isSoulbound },
        ...(courseId ? [{ trait_type: 'Course ID', value: courseId }] : []),
        { trait_type: 'Platform', value: 'learn.tg' },
      ],
    }

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error fetching credential metadata:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/credential/wallet/[wallet] — perfil público: SBTs, donaciones,
 * premium count, primera actividad. DB inyectada vía deps (D2).
 */
export async function credentialByWallet(
  deps: RewardsDeps,
  _request: NextRequest,
  params: Record<string, string>,
): Promise<Response> {
  const { wallet } = params

  if (!wallet || !wallet.startsWith('0x') || wallet.length !== 42) {
    return NextResponse.json({ error: 'Invalid wallet' }, { status: 400 })
  }

  try {
    const db = deps.db()

    const billetera = await db
      .selectFrom('billetera_usuario')
      .select('usuario_id')
      .where('billetera', 'ilike', wallet)
      .executeTakeFirst()

    if (!billetera) {
      return NextResponse.json({ error: 'No activity' }, { status: 404 })
    }

    // SBTs earned
    const sbts = await db
      .selectFrom('credential_emission as e')
      .innerJoin('cor1440_gen_proyectofinanciero as c', 'c.id', 'e.course_id')
      .select([
        'e.token_id as tokenId',
        'c.titulo as name',
        'e.emitted_at as earnedAt',
      ])
      .where('e.usuario_id', '=', billetera.usuario_id)
      .orderBy('e.emitted_at', 'asc')
      .execute()

    // Donation totals from transaction table
    const donationRow = await db
      .selectFrom('transaction')
      .select([
        db.fn.sum('balance_impact').as('totalDonated'),
        db.fn.countAll().as('donationCount'),
        db.fn.min('date').as('firstDonation'),
      ])
      .where('wallet', '=', wallet)
      .where('type', '=', 'donation')
      .executeTakeFirst()

    // First activity
    const firstSbtDate = sbts.length > 0 ? String(sbts[0].earnedAt) : null
    const firstDonationDate = donationRow?.firstDonation ? String(donationRow.firstDonation) : null
    const firstActivity = firstSbtDate && firstDonationDate
      ? (firstSbtDate < firstDonationDate ? firstSbtDate : firstDonationDate)
      : (firstSbtDate || firstDonationDate)

    // Premium credential count (for stable-sl tier determination)
    const premiumRow = await db
      .selectFrom('credential_emission')
      .select(db.fn.countAll<number>().as('count'))
      .where('usuario_id', '=', billetera.usuario_id)
      .where('is_premium', '=', true)
      .executeTakeFirst()

    if (sbts.length === 0 && !donationRow?.donationCount) {
      return NextResponse.json({ error: 'No activity' }, { status: 404 })
    }

    return NextResponse.json({
      sbts,
      totalDonated: (donationRow?.totalDonated as string) || '0',
      donationCount: Number(donationRow?.donationCount || 0),
      premiumSbtCount: premiumRow?.count || 0,
      firstActivity,
    })
  } catch (error) {
    console.error('Error fetching wallet credentials:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
