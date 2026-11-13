import { NextResponse } from 'next/server'
import { sql } from 'kysely'
import type { GdclusterDeps } from '../index.js'

// R-#299: superficie **pública** de los clústeres (página `/{lang}/clusters/[slug]` y
// listado para el ranking). El alias (`slug`) es lo único que se publica del clúster:
// nunca el `name` interno, ni pastores, ni billeteras, ni invitaciones.

interface FundsByWallet {
  cluster_wallet: string | null
  usdt_total: number
  slearn_total: number
}

/**
 * Total recaudado en learn.tg por billetera de clúster: donaciones directas y el 10 %
 * ruteado de compras y becas (`transaction.type = 'cluster_contribution'` se acredita
 * completo al fondo; el resto aporta el 80 %).
 */
export async function clusterFundsByWallet(db: any): Promise<Map<string, FundsByWallet>> {
  const rows = await sql<FundsByWallet>`
    SELECT
      t.metadata->>'clusterWallet' AS cluster_wallet,
      COALESCE(SUM(
        CASE WHEN t.crypto = 'usdt' THEN
          CASE WHEN t.type = 'cluster_contribution' OR t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
        ELSE 0 END), 0)::float AS usdt_total,
      COALESCE(SUM(
        CASE WHEN t.crypto = 'slearn' THEN
          CASE WHEN t.type = 'cluster_contribution' OR t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
        ELSE 0 END), 0)::float AS slearn_total
    FROM transaction t
    WHERE t.subcategoria = 'cluster' AND t.type IN ('donation', 'cluster_contribution')
    GROUP BY t.metadata->>'clusterWallet'
  `.execute(db)

  const totals = new Map<string, FundsByWallet>()
  for (const row of rows.rows as FundsByWallet[]) {
    if (row.cluster_wallet) totals.set(row.cluster_wallet.toLowerCase(), row)
  }
  return totals
}

/**
 * GET /api/clusters — listado público (ranking): slug, estado, país, número de iglesias
 * y total recaudado. No incluye `name`, billeteras ni pastores.
 */
export async function listClusters(deps: GdclusterDeps) {
  try {
    const db = deps.db()

    const rows = await sql<{
      slug: string
      status: string | null
      gd_status: string | null
      fund_released_at: string | null
      fund_released_amount: number | null
      fund_released_slearn: number | null
      country_name: string | null
      country_code: string | null
      cluster_wallet: string | null
      church_count: number
    }>`
      SELECT
        c.slug, c.status, c.gd_status, c.fund_released_at,
        c.fund_released_amount, c.fund_released_slearn,
        p.nombre AS country_name, p.alfa2 AS country_code,
        initiator.cluster_wallet AS cluster_wallet,
        COUNT(member_church.id)::int AS church_count
      FROM clustergd c
      LEFT JOIN msip_pais p ON p.id = c.country_id
      LEFT JOIN church initiator ON initiator.id = c.initiator_church_id
      LEFT JOIN church_clustergd cc ON cc.clustergd_id = c.id AND cc.left_at IS NULL
      LEFT JOIN church member_church ON member_church.id = cc.church_id AND member_church.deleted_at IS NULL
      WHERE p.tipo_region = 1
        AND c.status != 'disbanded'
      GROUP BY c.id, c.slug, c.status, c.gd_status, c.fund_released_at,
               c.fund_released_amount, c.fund_released_slearn,
               p.nombre, p.alfa2, initiator.cluster_wallet
      ORDER BY c.id
    `.execute(db)

    const totals = await clusterFundsByWallet(db)

    const clusters = (rows.rows as any[]).map((row) => {
      const funds = row.cluster_wallet ? totals.get(String(row.cluster_wallet).toLowerCase()) : undefined
      return {
        slug: row.slug,
        status: row.status,
        gd_status: row.gd_status,
        finished: !!row.fund_released_at,
        fund_released_at: row.fund_released_at,
        fund_released_amount: row.fund_released_amount,
        fund_released_slearn: row.fund_released_slearn,
        country_name: row.country_name,
        country_code: row.country_code,
        church_count: Number(row.church_count ?? 0),
        usdt_total: Number(funds?.usdt_total ?? 0),
        slearn_total: Number(funds?.slearn_total ?? 0),
      }
    })

    return NextResponse.json({ clusters })
  } catch (error) {
    console.error('Error fetching public clusters:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/clusters/[slug] — página pública de un clúster: alias, iglesias que lo
 * componen, total recaudado, estado del proceso y la transacción de liberación cuando ya
 * recibió sus fondos.
 */
export async function getPublicCluster(deps: GdclusterDeps, params: Record<string, string>) {
  const slug = String(params?.slug ?? '').trim().toLowerCase()
  if (!slug) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

  try {
    const db = deps.db()

    const cluster = await db
      .selectFrom('clustergd as c')
      .leftJoin('church as initiator', 'initiator.id', 'c.initiator_church_id')
      .select([
        'c.id', 'c.slug', 'c.status', 'c.gd_status', 'c.created_at',
        'c.fund_released_at', 'c.fund_released_amount', 'c.fund_released_slearn',
        'c.country_id', 'initiator.cluster_wallet as cluster_wallet',
      ])
      .where('c.slug', '=', slug)
      .executeTakeFirst()

    if (!cluster || cluster.status === 'disbanded') {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    const churches = await db
      .selectFrom('church_clustergd as cc')
      .innerJoin('church as ch', 'ch.id', 'cc.church_id')
      .select(['ch.name', 'cc.joined_at'])
      .where('cc.clustergd_id', '=', cluster.id)
      .where('cc.left_at', 'is', null)
      .orderBy('cc.joined_at', 'asc')
      .execute()

    const country = cluster.country_id
      ? await db.selectFrom('msip_pais').select(['nombre as name', 'alfa2 as code']).where('id', '=', cluster.country_id).executeTakeFirst()
      : null

    const fundsRow = cluster.cluster_wallet
      ? await sql<FundsByWallet>`
          SELECT
            t.metadata->>'clusterWallet' AS cluster_wallet,
            COALESCE(SUM(
              CASE WHEN t.crypto = 'usdt' THEN
                CASE WHEN t.type = 'cluster_contribution' OR t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
              ELSE 0 END), 0)::float AS usdt_total,
            COALESCE(SUM(
              CASE WHEN t.crypto = 'slearn' THEN
                CASE WHEN t.type = 'cluster_contribution' OR t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
              ELSE 0 END), 0)::float AS slearn_total
          FROM transaction t
          WHERE t.subcategoria = 'cluster'
            AND t.type IN ('donation', 'cluster_contribution')
            AND lower(t.metadata->>'clusterWallet') = lower(${cluster.cluster_wallet})
        `.execute(db)
      : null
    const funds = fundsRow?.rows?.[0]

    // La transacción de liberación quedó en la historia del clúster (`fund_released`).
    const release = await db
      .selectFrom('clustergd_history')
      .select(['new_value', 'created_at'])
      .where('clustergd_id', '=', cluster.id)
      .where('event_type', '=', 'fund_released')
      .orderBy('created_at', 'desc')
      .executeTakeFirst()

    return NextResponse.json({
      slug: cluster.slug,
      status: cluster.status,
      gd_status: cluster.gd_status,
      finished: !!cluster.fund_released_at,
      created_at: cluster.created_at,
      country_name: country?.name ?? null,
      country_code: country?.code ?? null,
      church_count: churches.length,
      churches,
      usdt_total: Number(funds?.usdt_total ?? 0),
      slearn_total: Number(funds?.slearn_total ?? 0),
      release: cluster.fund_released_at
        ? {
            at: cluster.fund_released_at,
            amount: cluster.fund_released_amount,
            slearn: cluster.fund_released_slearn,
            tx: release?.new_value ?? null,
          }
        : null,
    })
  } catch (error) {
    console.error('Error fetching public cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
