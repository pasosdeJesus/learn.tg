import { NextResponse } from 'next/server'
import { sql } from 'kysely'
import { PILOT_COUNTRIES } from '../lib/gd-utils'
import type { GdclusterDeps } from '../index'

// Ranking de clústeres y países para el curso Global Disciples (REQ/35 Fase 3).

export async function rankingClusters(deps: GdclusterDeps) {
  try {
    const db = deps.db()

    const rows = await sql<{
      id: number; name: string; pseudonym: string | null; display_name: string
      code: string; country_id: number; wallet: string
      country_name: string | null; country_code: string | null; church_count: number
    }>`
      SELECT
        c.id, c.name, c.pseudonym,
        COALESCE(NULLIF(c.pseudonym, ''), c.name) AS display_name,
        c.code, c.country_id, ch.cluster_wallet as wallet,
        p.nombre as country_name, p.alfa2 as country_code,
        COUNT(ch.id)::int as church_count
      FROM clustergd c
      LEFT JOIN msip_pais p ON p.id = c.country_id
      LEFT JOIN church ch ON ch.country_id = c.country_id AND ch.deleted_at IS NULL
      LEFT JOIN church_clustergd cc ON cc.church_id = ch.id AND cc.clustergd_id = c.id AND cc.left_at IS NULL
      WHERE c.country_id = ANY(${PILOT_COUNTRIES})
        AND c.status != 'disbanded'
      GROUP BY c.id, c.name, c.pseudonym, c.code, c.country_id, ch.cluster_wallet, p.nombre, p.alfa2
      ORDER BY c.id
    `.execute(db)

    return NextResponse.json({ clusters: rows.rows })
  } catch (error) {
    console.error('Error fetching cluster ranking:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function rankingCountries(deps: GdclusterDeps) {
  try {
    const db = deps.db()

    const rows = await sql<{
      country_id: number; country_name: string | null; country_code: string | null
      cluster_count: number; church_count: number
    }>`
      SELECT
        p.id as country_id,
        p.nombre as country_name,
        p.alfa2 as country_code,
        COUNT(DISTINCT c.id)::int as cluster_count,
        COUNT(DISTINCT ch.id)::int as church_count
      FROM msip_pais p
      LEFT JOIN clustergd c ON c.country_id = p.id
      LEFT JOIN church ch ON ch.country_id = p.id AND ch.deleted_at IS NULL
      WHERE p.id = ANY(${PILOT_COUNTRIES})
      GROUP BY p.id, p.nombre, p.alfa2
      ORDER BY p.nombre
    `.execute(db)

    return NextResponse.json({ countries: rows.rows })
  } catch (error) {
    console.error('Error fetching country ranking:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/gdcluster/ranking/funds
 *
 * Accumulated funds (donations routed to clusters/countries) for the
 * Global Disciples landing page ranking section.
 */
export async function rankingFunds(deps: GdclusterDeps) {
  try {
    const db = deps.db()

    const countries = await sql<{
      country_code: string | null
      country_name: string | null
      usdt_total: number
      slearn_total: number
    }>`
      SELECT
        t.metadata->>'countryCode' AS country_code,
        p.nombre AS country_name,
        COALESCE(SUM(
          CASE WHEN t.crypto = 'usdt' THEN
            CASE WHEN t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
          ELSE 0 END), 0)::float AS usdt_total,
        COALESCE(SUM(
          CASE WHEN t.crypto = 'slearn' THEN
            CASE WHEN t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
          ELSE 0 END), 0)::float AS slearn_total
      FROM transaction t
      LEFT JOIN msip_pais p ON p.alfa2 = t.metadata->>'countryCode'
      WHERE t.subcategoria = 'country' AND t.type = 'donation'
      GROUP BY t.metadata->>'countryCode', p.nombre
    `.execute(db)

    const clusters = await sql<{
      cluster_wallet: string | null
      cluster_name: string | null
      usdt_total: number
      slearn_total: number
    }>`
      SELECT
        t.metadata->>'clusterWallet' AS cluster_wallet,
        cg.name AS cluster_name,
        COALESCE(SUM(
          CASE WHEN t.crypto = 'usdt' THEN
            CASE WHEN t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
          ELSE 0 END), 0)::float AS usdt_total,
        COALESCE(SUM(
          CASE WHEN t.crypto = 'slearn' THEN
            CASE WHEN t.hash LIKE '%-fund' THEN t.amount ELSE t.amount * 0.8 END
          ELSE 0 END), 0)::float AS slearn_total
      FROM transaction t
      LEFT JOIN church ch ON ch.cluster_wallet = t.metadata->>'clusterWallet'
      LEFT JOIN church_clustergd cc ON cc.church_id = ch.id AND cc.left_at IS NULL
      LEFT JOIN clustergd cg ON cg.id = cc.clustergd_id
      WHERE t.subcategoria = 'cluster' AND t.type = 'donation'
      GROUP BY t.metadata->>'clusterWallet', cg.name
    `.execute(db)

    return NextResponse.json({ countries: countries.rows, clusters: clusters.rows })
  } catch (error) {
    console.error('Error fetching ranking funds:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
