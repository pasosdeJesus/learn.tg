import { NextRequest, NextResponse } from 'next/server'
import {
  getPastorChurch,
  getChurchCluster,
  getClusterMembers,
  getClusterHistory,
  addClusterHistory,
  generateUniqueClusterCode,
  PILOT_COUNTRIES,
} from '../lib/gd-utils'
import type { GdclusterDeps } from '../index'

// Rutas de clústeres del curso Global Disciples (REQ/35 Fase 3).

export async function createCluster(deps: GdclusterDeps, req: NextRequest) {
  try {
    const { walletAddress, token, name } = await req.json()

    if (!name || name.length < 3 || name.length > 50) {
      return NextResponse.json(
        { error: 'Cluster name must be between 3 and 50 characters' },
        { status: 400 }
      )
    }

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const user = auth.usuario
    if (user.church_relationship !== 'pastor') {
      return NextResponse.json(
        { error: 'Only pastors can create clusters' },
        { status: 403 }
      )
    }

    const church = await getPastorChurch(db, user.id)
    if (!church) {
      return NextResponse.json(
        { error: 'You must declare a church before creating a cluster' },
        { status: 400 }
      )
    }

    // Pilot: only Colombia and Sierra Leona
    if (!PILOT_COUNTRIES.includes(church.country_id)) {
      return NextResponse.json(
        { error: 'Clusters are only available in Colombia and Sierra Leona during the pilot phase' },
        { status: 403 }
      )
    }

    // The pastor must have taken (purchased) the Global Disciples course.
    const hasTakenCourse = await db
      .selectFrom('premium_course_usuario')
      .select('id')
      .where('usuario_id', '=', user.id)
      .where('course_id', 'in', [10, 11])
      .executeTakeFirst()
    if (!hasTakenCourse) {
      return NextResponse.json(
        { error: 'You must take the Global Disciples course before creating a cluster' },
        { status: 403 }
      )
    }

    const existingMembership = await getChurchCluster(db, church.id)
    if (existingMembership) {
      return NextResponse.json(
        { error: 'Your church already belongs to a cluster. Leave it first.' },
        { status: 409 }
      )
    }

    const existingName = await db
      .selectFrom('clustergd')
      .select('id')
      .where('name', '=', name)
      .where('country_id', '=', church.country_id)
      .executeTakeFirst()
    if (existingName) {
      return NextResponse.json(
        { error: 'A cluster with this name already exists in your country' },
        { status: 409 }
      )
    }

    const code = await generateUniqueClusterCode(db)

    const cluster = await db
      .insertInto('clustergd')
      .values({
        name,
        code,
        country_id: church.country_id,
      })
      .returningAll()
      .executeTakeFirstOrThrow()

    await db
      .insertInto('church_clustergd')
      .values({
        church_id: church.id,
        clustergd_id: cluster.id,
      })
      .execute()

    await addClusterHistory(db, cluster.id, 'church_join', null, church.name, user.id)

    return NextResponse.json({ cluster, code: cluster.code }, { status: 201 })
  } catch (error) {
    console.error('Error creating cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function joinCluster(deps: GdclusterDeps, req: NextRequest) {
  try {
    const { walletAddress, token, code } = await req.json()

    if (!code || code.length !== 6) {
      return NextResponse.json(
        { error: 'Invalid cluster code' },
        { status: 400 }
      )
    }

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const user = auth.usuario
    if (user.church_relationship !== 'pastor') {
      return NextResponse.json(
        { error: 'Only pastors can join clusters' },
        { status: 403 }
      )
    }

    const church = await getPastorChurch(db, user.id)
    if (!church) {
      return NextResponse.json(
        { error: 'You must declare a church before joining a cluster' },
        { status: 400 }
      )
    }

    const existingMembership = await getChurchCluster(db, church.id)
    if (existingMembership) {
      return NextResponse.json(
        { error: 'Your church already belongs to a cluster. Leave it first.' },
        { status: 409 }
      )
    }

    const cluster = await db
      .selectFrom('clustergd')
      .selectAll()
      .where('code', '=', code.toUpperCase())
      .executeTakeFirst()

    if (!cluster) {
      return NextResponse.json(
        { error: 'Cluster not found with this code' },
        { status: 404 }
      )
    }

    if (cluster.country_id !== church.country_id) {
      return NextResponse.json(
        { error: 'All churches in a cluster must be from the same country' },
        { status: 400 }
      )
    }

    await db
      .insertInto('church_clustergd')
      .values({
        church_id: church.id,
        clustergd_id: cluster.id,
      })
      .execute()

    await addClusterHistory(db, cluster.id, 'church_join', null, church.name, user.id)

    return NextResponse.json({ cluster })
  } catch (error) {
    console.error('Error joining cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function getCluster(
  deps: GdclusterDeps,
  _request: NextRequest,
  params: Record<string, string>
) {
  const clusterId = parseInt(params?.id ?? '', 10)
  if (isNaN(clusterId) || clusterId < 1) {
    return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  }

  try {
    const db = deps.db()

    const cluster = await db
      .selectFrom('clustergd')
      .selectAll()
      .where('id', '=', clusterId)
      .executeTakeFirst()

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    const members = await getClusterMembers(db, clusterId)
    const history = await getClusterHistory(db, clusterId)

    return NextResponse.json({
      id: cluster.id,
      name: cluster.name,
      code: cluster.code,
      country_id: cluster.country_id,
      created_at: cluster.created_at,
      member_count: members.length,
      status: members.length >= 3 ? 'Formed' : 'In Progress',
      members,
      history,
    })
  } catch (error) {
    console.error('Error fetching cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function updateCluster(
  deps: GdclusterDeps,
  req: NextRequest,
  params: Record<string, string>
) {
  const clusterId = parseInt(params?.id ?? '', 10)
  if (isNaN(clusterId) || clusterId < 1) {
    return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  }

  try {
    const { walletAddress, token, name } = await req.json()
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    const membership = await getChurchCluster(db, church.id)
    if (!membership || membership.clustergd_id !== clusterId) {
      return NextResponse.json(
        { error: 'Your church is not a member of this cluster' },
        { status: 403 }
      )
    }

    const cluster = await db
      .selectFrom('clustergd')
      .selectAll()
      .where('id', '=', clusterId)
      .executeTakeFirst()

    if (!cluster) {
      return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })
    }

    if (!name || name.length < 3 || name.length > 50) {
      return NextResponse.json(
        { error: 'Cluster name must be between 3 and 50 characters' },
        { status: 400 }
      )
    }

    const existingName = await db
      .selectFrom('clustergd')
      .select('id')
      .where('name', '=', name)
      .where('country_id', '=', cluster.country_id)
      .where('id', '!=', clusterId)
      .executeTakeFirst()
    if (existingName) {
      return NextResponse.json(
        { error: 'A cluster with this name already exists in your country' },
        { status: 409 }
      )
    }

    const oldName = cluster.name
    await db
      .updateTable('clustergd')
      .set({ name, updated_at: new Date() })
      .where('id', '=', clusterId)
      .execute()

    await addClusterHistory(db, clusterId, 'name_change', oldName, name, auth.usuario.id)

    return NextResponse.json({ success: true, name })
  } catch (error) {
    console.error('Error updating cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function leaveCluster(
  deps: GdclusterDeps,
  req: NextRequest,
  params: Record<string, string>
) {
  const clusterId = parseInt(params?.id ?? '', 10)
  if (isNaN(clusterId) || clusterId < 1) {
    return NextResponse.json({ error: 'Invalid cluster ID' }, { status: 400 })
  }

  try {
    const { walletAddress, token } = await req.json()
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress, token)
    if (!auth) {
      return NextResponse.json({ error: 'Authentication failed' }, { status: 401 })
    }

    const church = await getPastorChurch(db, auth.usuario.id)
    if (!church) {
      return NextResponse.json({ error: 'Church not found' }, { status: 404 })
    }

    const membership = await getChurchCluster(db, church.id)
    if (!membership || membership.clustergd_id !== clusterId) {
      return NextResponse.json(
        { error: 'Your church is not a member of this cluster' },
        { status: 403 }
      )
    }

    await db
      .updateTable('church_clustergd')
      .set({ left_at: new Date() })
      .where('church_id', '=', church.id)
      .where('clustergd_id', '=', clusterId)
      .where('left_at', 'is', null)
      .execute()

    await addClusterHistory(db, clusterId, 'church_leave', church.name, null, auth.usuario.id)

    const remainingMembers = await getClusterMembers(db, clusterId)
    if (remainingMembers.length === 0) {
      await db
        .deleteFrom('clustergd_history')
        .where('clustergd_id', '=', clusterId)
        .execute()
      await db
        .deleteFrom('clustergd')
        .where('id', '=', clusterId)
        .execute()
      return NextResponse.json({ dissolved: true })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error leaving cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
