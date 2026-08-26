import { NextRequest, NextResponse } from 'next/server'
import type { GdclusterDeps } from '../index'

export async function searchChurches(deps: GdclusterDeps, req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q')
  const countryId = searchParams.get('country')
  const municipalityId = searchParams.get('municipality')
  const cityId = searchParams.get('cityId')
  const wallet = searchParams.get('walletAddress') || ''
  const token = searchParams.get('token') || ''
  console.log(`[churches/search] wallet: ${wallet.slice(0, 10)}... token: ${token.slice(0, 8)}... (len=${token.length})`)

  const db = deps.db()
  const auth = await deps.authenticateUser(db, wallet, token)
  if (!auth) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  if (!q && !countryId) {
    return NextResponse.json({ churches: [] })
  }

  try {
    let query = db
      .selectFrom('church')
      .select(['id', 'name', 'city_name'])
      .limit(20)

    if (q && q.length >= 2) {
      query = query.where('name', 'ilike', `%${q}%`)
    }

    if (countryId) {
      query = query.where('country_id', '=', parseInt(countryId, 10))
    }

    if (municipalityId) {
      query = query.where('municipality_id', '=', parseInt(municipalityId, 10))
    }
    if (cityId) {
      query = query.where('city_id', '=', parseInt(cityId, 10))
    }

    const churches = await query.orderBy('name').execute()

    return NextResponse.json({ churches })
  } catch (error) {
    console.error('Church search error:', error)
    return NextResponse.json({ churches: [] }, { status: 500 })
  }
}
