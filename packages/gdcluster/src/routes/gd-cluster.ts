import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'kysely'
import {
  getPastorChurch,
  getChurchCluster,
  getClusterMembers,
  getClusterHistory,
  addClusterHistory,
  notifyUser,
  getClusterCandidates,
  isType1Country,
} from '../lib/gd-utils.js'
import { readClusterFunds, hasFunds, summarizeFunds } from '../lib/cluster-funds.js'
import { checkWalletControl, validateClusterWallet } from '../lib/cluster-wallet.js'
import { churchCompletedCluster } from '../lib/cluster-membership.js'
import { getClusterPastors } from '../lib/cluster-pastors.js'
import { suggestSlug, slugWithId, validateSlug } from '../lib/slug.js'
import type { GdclusterDeps } from '../index.js'

// Rutas de clústeres del curso Global Disciples (https://gitlab.com/pasosdeJesus/m/-/work_items/35 Fase 3, https://github.com/pasosdeJesus/learn.tg/issues/220).

export async function createCluster(deps: GdclusterDeps, req: NextRequest) {
  try {
    const { walletAddress, name, slug, inviteeIds } = await req.json()

    const clusterName = typeof name === 'string' ? name.trim() : ''
    if (clusterName.length < 3 || clusterName.length > 50) {
      return NextResponse.json(
        { error: 'Cluster name must be between 3 and 50 characters', code: 'name_invalid' },
        { status: 400 }
      )
    }

    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
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
        { error: 'Your church must be registered before creating a cluster' },
        { status: 400 }
      )
    }

    if (!(await isType1Country(db, church.country_id))) {
      return NextResponse.json(
        { error: 'Clusters are available only in countries classified as type 1' },
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

    const completed = await churchCompletedCluster(db, church.id)
    if (completed) {
      return NextResponse.json(
        {
          error: 'Your church belonged to a cluster that already received its funds and cannot take part in another one',
          code: 'cluster_completed',
        },
        { status: 403 },
      )
    }

    const existingMembership = await getChurchCluster(db, church.id)
    if (existingMembership) {
      return NextResponse.json(
        { error: 'Your church already belongs to a cluster. Leave it first.' },
        { status: 409 }
      )
    }

    // R-#299: `name` y `slug` son únicos en todo learn.tg. Los índices
    // `clustergd_name_unique` y `clustergd_slug_unique` son la verdad; esta consulta sólo
    // da el motivo amable (sin distinguir mayúsculas ni espacios).
    const existingName = await db
      .selectFrom('clustergd')
      .select('id')
      .where(sql<boolean>`lower(btrim(name)) = lower(btrim(${clusterName}))`)
      .executeTakeFirst()
    if (existingName) {
      return NextResponse.json(
        { error: 'A cluster with this name already exists', code: 'name_taken' },
        { status: 409 }
      )
    }

    // El alias es público y lo elige el iniciador; si no lo envía se sugiere con las
    // iniciales del nombre (R-#299 §4). Un alias tecleado que choca no se reescribe: 409.
    let requestedSlug: string | null = null
    if (slug !== undefined && slug !== null && String(slug).trim() !== '') {
      const checked = validateSlug(String(slug).trim().toLowerCase())
      if (!checked.ok) {
        return NextResponse.json(
          { error: 'The alias must have 2 to 40 characters: lowercase letters, digits and single hyphens', code: 'slug_invalid' },
          { status: 400 }
        )
      }
      requestedSlug = checked.slug
      const taken = await db
        .selectFrom('clustergd')
        .select('id')
        .where('slug', '=', requestedSlug)
        .executeTakeFirst()
      if (taken) {
        return NextResponse.json(
          { error: `The alias "${requestedSlug}" is already in use`, code: 'slug_taken' },
          { status: 409 }
        )
      }
    }

    const derived = suggestSlug(clusterName)
    const baseSlug = validateSlug(derived).ok ? derived : 'cl'

    // El clúster se inserta y, cuando el alias es el derivado, se resuelve con el `id`
    // propio (`<base>-<id>` si el derivado ya existe): una sola transacción, sin reintentos.
    const cluster = await db.transaction().execute(async (trx: any) => {
      const row = await trx
        .insertInto('clustergd')
        .values({
          name: clusterName,
          slug: requestedSlug ?? `cl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          status: 'pending',
          initiator_church_id: church.id,
          country_id: church.country_id,
        })
        .returningAll()
        .executeTakeFirstOrThrow()

      if (requestedSlug) return row

      let finalSlug = baseSlug
      const taken = await trx
        .selectFrom('clustergd')
        .select('id')
        .where('slug', '=', finalSlug)
        .executeTakeFirst()
      if (taken) finalSlug = slugWithId(baseSlug, row.id)
      await trx.updateTable('clustergd').set({ slug: finalSlug }).where('id', '=', row.id).execute()
      return { ...row, slug: finalSlug }
    })

    await db
      .insertInto('church_clustergd')
      .values({
        church_id: church.id,
        clustergd_id: cluster.id,
      })
      .execute()

    await addClusterHistory(db, cluster.id, 'church_join', null, church.name, user.id)

    // https://github.com/pasosdeJesus/learn.tg/issues/220 §2: invitaciones a los pastores seleccionados (solo candidatos
    // válidos: referidos https://github.com/pasosdeJesus/learn.tg/issues/163 / referidor, mismo país, iglesia verificada,
    // sin clúster). R-#299: es el único camino de ingreso; el código de 6 caracteres ya no existe.
    let createdInvites = 0
    if (Array.isArray(inviteeIds) && inviteeIds.length > 0) {
      const candidates = await getClusterCandidates(db, user.id, church.country_id, church.id)
      const requested = [...new Set(inviteeIds.map((id: any) => Number(id)))]
      const chosen = candidates.filter((c) => requested.includes(c.usuario_id))
      if (chosen.length === 0) {
        return NextResponse.json({ error: 'None of the selected pastors is a valid candidate' }, { status: 400 })
      }
      for (const c of chosen.slice(0, 2)) {
        await db
          .insertInto('cluster_invitation')
          .values({
            clustergd_id: cluster.id,
            invited_pastor_id: c.usuario_id,
            invited_church_id: c.church_id,
            invited_by_id: user.id,
          })
          .onConflict((oc) => oc.columns(['clustergd_id', 'invited_pastor_id']).doNothing())
          .execute()
        createdInvites++
        await addClusterHistory(db, cluster.id, 'invitation_sent', null, c.church_name, user.id)
        await notifyUser(
          db, c.usuario_id, 'cluster_invitation',
          'Cluster invitation',
          `You have been invited to join cluster ${cluster.slug} by ${user.nombre || user.nusuario}. Go to Cluster to accept or reject.`,
          `/${String(user.idioma || 'en').startsWith('es') ? 'es' : 'en'}/cluster`
        )
      }
    }

    return NextResponse.json({ cluster, invited: createdInvites }, { status: 201 })
  } catch (error) {
    console.error('Error creating cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function getCluster(
  deps: GdclusterDeps,
  request: NextRequest,
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
    const initiatorChurch = cluster.initiator_church_id
      ? await db.selectFrom('church').select('cluster_wallet').where('id', '=', cluster.initiator_church_id).executeTakeFirst()
      : null

    // `isInitiator` se calcula para la billetera que consulta (opcional): la página
    // del clúster lo usa para ofrecer la edición de la billetera solo al **iniciador
    // del clúster** (https://github.com/pasosdeJesus/learn.tg/issues/220).
    let isInitiator = false
    const walletAddress = request.nextUrl.searchParams.get('walletAddress') || ''
    if (walletAddress && deps.authenticateUser) {
      const auth = await deps.authenticateUser(db, walletAddress)
      if (auth) {
        const church = await getPastorChurch(db, auth.usuario.id)
        isInitiator = !!(church && cluster.initiator_church_id === church.id)
      }
    }

    return NextResponse.json({
      id: cluster.id,
      name: cluster.name,
      slug: cluster.slug,
      country_id: cluster.country_id,
      created_at: cluster.created_at,
      initiator_church_id: cluster.initiator_church_id,
      cluster_wallet: initiatorChurch?.cluster_wallet ?? null,
      isInitiator,
      member_count: members.length,
      status: cluster.status ?? (members.length >= 3 ? 'active' : 'pending'),
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
    const { walletAddress, name, slug, clusterWallet, confirmMigrate } = await req.json()
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
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

    // https://github.com/pasosdeJesus/learn.tg/issues/220 §4: solo el iniciador edita nombre/pseudónimo.
    if (cluster.initiator_church_id && cluster.initiator_church_id !== church.id) {
      return NextResponse.json({ error: 'Only the cluster initiator can edit the details' }, { status: 403 })
    }

    // Billetera del clúster (https://github.com/pasosdeJesus/learn.tg/issues/220):
    // la fuente de verdad sigue siendo `church.cluster_wallet` de la iglesia iniciadora.
    // La configura el iniciador del clúster y se recomienda una multisig con las
    // billeteras de los pastores. Cambiarla no mueve los fondos ya acreditados
    // (el fondo está indexado por la dirección anterior).
    let normalizedWallet: string | null | undefined
    let walletChecksummed = true
    let initiatorChurch: { id: number; cluster_wallet: string | null } | undefined
    if (clusterWallet !== undefined && ['requested', 'under_review', 'approved', 'sent', 'answered'].includes(cluster.gd_status)) {
      return NextResponse.json(
        { error: 'The cluster wallet is fixed while the presentation is with pdJ or with Global Disciples', code: 'gd_fields_locked' },
        { status: 409 },
      )
    }
    if (clusterWallet !== undefined) {
      if (clusterWallet === null || clusterWallet === '') {
        normalizedWallet = null
      } else if (typeof clusterWallet === 'string' && clusterWallet.trim()) {
        const checked = await validateClusterWallet(clusterWallet)
        if ('error' in checked) {
          const message = checked.error === 'zero'
            ? 'The cluster wallet cannot be the zero address'
            : checked.error === 'platform'
              ? 'That address belongs to the platform or to the contract: choose the cluster wallet (a multisig shared by the pastors is recommended)'
              : 'Invalid wallet address'
          return NextResponse.json({ error: message, code: `cluster_wallet_${checked.error}` }, { status: 400 })
        }
        normalizedWallet = checked.address
        walletChecksummed = checked.checksummed
      } else {
        return NextResponse.json({ error: 'Invalid wallet address' }, { status: 400 })
      }
      if (!cluster.initiator_church_id) {
        return NextResponse.json({ error: 'The cluster has no initiator church' }, { status: 400 })
      }
      initiatorChurch = await db
        .selectFrom('church')
        .select(['id', 'cluster_wallet'])
        .where('id', '=', cluster.initiator_church_id)
        .executeTakeFirst()

    }

    // https://github.com/pasosdeJesus/learn.tg/issues/220 §4: el fondo de
    // `ClusterFundsV2` está indexado por la billetera, así que cambiarla con saldo deja
    // los fondos viejos huérfanos (no se mueven, no se ven en el ranking y no se pueden
    // liberar desde la página). Se bloquea el cambio salvo confirmación explícita.
    let fundsSummary: ReturnType<typeof summarizeFunds> | null = null
    let fundsUnchecked = false
    if (normalizedWallet !== undefined && initiatorChurch) {
      const previousWallet = initiatorChurch.cluster_wallet ?? null
      if (normalizedWallet && previousWallet && normalizedWallet !== previousWallet) {
        const balance = await readClusterFunds(deps, previousWallet)
        if (balance === null) {
          fundsUnchecked = true
        } else if (hasFunds(balance)) {
          fundsSummary = summarizeFunds(balance)
          if (confirmMigrate !== true) {
            return NextResponse.json(
              {
                error:
                  'This cluster wallet already holds funds. Changing it does not move them: the existing fund stays in the old address. Confirm the change if that is what you want.',
                code: 'cluster_wallet_has_funds',
                previousWallet,
                funds: fundsSummary,
              },
              { status: 409 }
            )
          }
        }
      }
    }

      // La billetera tiene que ser una de las registradas en la cuenta del iniciador, o una
      // multisig cuyos dueños incluyan alguna (lecturas, sin mover fondos).
      if (normalizedWallet && normalizedWallet !== initiatorChurch?.cluster_wallet) {
        // Billeteras registradas de cada pastor del clúster: la multisig tiene que tener
        // un dueño por pastor y cada dueño una billetera de ESE pastor.
        const pastors = await getClusterPastors(db, clusterId)
        const pastorWallets: string[][] = []
        for (const pastor of pastors) {
          const rows = await db
            .selectFrom('billetera_usuario')
            .select('billetera')
            .where('usuario_id', '=', pastor.usuario_id)
            .execute()
          pastorWallets.push((rows as any[]).map((row) => row.billetera).filter(Boolean))
        }
        const callerId = Number(auth.usuario.id)
        const callerIndex = pastors.findIndex((pastor) => pastor.usuario_id === callerId)
        let initiatorWallets = callerIndex >= 0 ? pastorWallets[callerIndex] : []
        if (initiatorWallets.length === 0) {
          const rows = await db
            .selectFrom('billetera_usuario')
            .select('billetera')
            .where('usuario_id', '=', callerId)
            .execute()
          initiatorWallets = (rows as any[]).map((row) => row.billetera).filter(Boolean)
        }
        const control = await checkWalletControl(
          deps.backend.getPublicClient(),
          normalizedWallet,
          initiatorWallets,
          pastorWallets.length ? pastorWallets : [initiatorWallets],
        )
        if (!control.ok) {
          const message = control.reason === 'not_initiator'
            ? 'The cluster wallet must be one of the wallets registered in your account, or a multisig whose owners include one of them'
            : control.reason === 'safe_without_initiator'
              ? 'The multisig owners do not include a wallet registered in the initiator account'
              : control.reason === 'safe_owners'
                ? 'The multisig must have one owner per pastor of the cluster, and each owner must be a wallet registered in that pastor account'
                : 'The cluster wallet could not be verified as a multisig or as one of your wallets; try again or use a wallet registered in your account'
          return NextResponse.json({ error: message, code: `cluster_wallet_${control.reason}` }, { status: 400 })
        }
      }

    // R-#299: en esta ruta sólo se edita el alias (slug) y la billetera. El `name` es
    // interno y lo cambia el verificador desde /api/admin/clusters/[id].
    if (name !== undefined) {
      return NextResponse.json(
        { error: 'The cluster name is not editable here: use the alias (slug)', code: 'name_not_editable' },
        { status: 400 }
      )
    }

    let normalizedSlug: string | undefined
    if (slug !== undefined && slug !== null) {
      const checked = validateSlug(String(slug).trim().toLowerCase())
      if (!checked.ok) {
        return NextResponse.json(
          { error: 'The alias must have 2 to 40 characters: lowercase letters, digits and single hyphens', code: 'slug_invalid' },
          { status: 400 }
        )
      }
      normalizedSlug = checked.slug
      if (normalizedSlug !== cluster.slug) {
        const taken = await db
          .selectFrom('clustergd')
          .select('id')
          .where('slug', '=', normalizedSlug)
          .where('id', '!=', clusterId)
          .executeTakeFirst()
        if (taken) {
          return NextResponse.json(
            {
              error: `The alias "${normalizedSlug}" is already in use`,
              code: 'slug_taken',
              suggestion: slugWithId(normalizedSlug, clusterId),
            },
            { status: 409 }
          )
        }
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date() }
    if (normalizedSlug !== undefined) updates.slug = normalizedSlug

    await db.updateTable('clustergd').set(updates).where('id', '=', clusterId).execute()

    if (normalizedSlug !== undefined && normalizedSlug !== cluster.slug) {
      await addClusterHistory(db, clusterId, 'slug_change', cluster.slug, normalizedSlug, auth.usuario.id)
    }

    if (normalizedWallet !== undefined && initiatorChurch) {
      const previousWallet = initiatorChurch.cluster_wallet ?? null
      await db
        .updateTable('church')
        .set({ cluster_wallet: normalizedWallet, updated_at: new Date() })
        .where('id', '=', initiatorChurch.id)
        .execute()
      if (previousWallet !== normalizedWallet) {
        // La historia deja constancia de lo que quedó en la billetera anterior.
        const historyValue = fundsSummary
          ? `${normalizedWallet ?? ''} (confirmed with funds left in ${previousWallet ?? ''}: ${fundsSummary.usdt} USDT / ${fundsSummary.slearn} SLEARN)`
          : normalizedWallet
        await addClusterHistory(db, clusterId, 'cluster_wallet_change', previousWallet, historyValue, auth.usuario.id)
        await logEvent(db, auth.usuario.id, 'cluster_wallet_change', {
          cluster_id: clusterId,
          wallet: normalizedWallet,
          previous_wallet: previousWallet,
          funds_left: fundsSummary,
          funds_unchecked: fundsUnchecked,
        })
      }
    }

    return NextResponse.json({
      success: true,
      slug: normalizedSlug ?? cluster.slug,
      // Solo se informa cuando el cuerpo trajo la billetera: en un cambio de alias no
      // se consultó la fila de la iglesia iniciadora.
      ...(normalizedWallet !== undefined ? { cluster_wallet: normalizedWallet, wallet_checksummed: walletChecksummed } : {}),
      ...(fundsSummary ? { funds_left_in_previous_wallet: fundsSummary } : {}),
      ...(fundsUnchecked ? { funds_unchecked: true } : {}),
    })
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
    const { walletAddress } = await req.json()
    const db = deps.db()
    const auth = await deps.authenticateUser(db, walletAddress)
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

    const cluster = await db.selectFrom('clustergd').selectAll().where('id', '=', clusterId).executeTakeFirst()
    if (!cluster) return NextResponse.json({ error: 'Cluster not found' }, { status: 404 })

    const isInitiator = cluster.initiator_church_id === church.id

    await db
      .updateTable('church_clustergd')
      .set({ left_at: new Date() })
      .where('church_id', '=', church.id)
      .where('clustergd_id', '=', clusterId)
      .where('left_at', 'is', null)
      .execute()

    await addClusterHistory(db, clusterId, 'church_leave', church.name, null, auth.usuario.id)

    const remainingMembers = await getClusterMembers(db, clusterId)

    if (isInitiator) {
      // https://github.com/pasosdeJesus/learn.tg/issues/220 §4: el iniciador saliente transfiere el rol al miembro más
      // antiguo o disuelve el clúster si no quedan miembros.
      if (remainingMembers.length >= 1) {
        await db
          .updateTable('clustergd')
          .set({ initiator_church_id: remainingMembers[0].church_id, updated_at: new Date() })
          .where('id', '=', clusterId)
          .execute()
        await addClusterHistory(db, clusterId, 'initiator_transfer', church.name, remainingMembers[0].church_name, auth.usuario.id)
      } else {
        await db
          .updateTable('clustergd')
          .set({ status: 'disbanded', updated_at: new Date() })
          .where('id', '=', clusterId)
          .execute()
        await addClusterHistory(db, clusterId, 'status_change', cluster.status, 'disbanded', auth.usuario.id)
        return NextResponse.json({ dissolved: true })
      }
    } else if (remainingMembers.length < 3 && cluster.status === 'active') {
      // https://github.com/pasosdeJesus/learn.tg/issues/220 §4: con < 3 miembros el clúster vuelve a pending (el iniciador
      // puede invitar un reemplazo).
      await db
        .updateTable('clustergd')
        .set({ status: 'pending', updated_at: new Date() })
        .where('id', '=', clusterId)
        .execute()
      await addClusterHistory(db, clusterId, 'status_change', 'active', 'pending', auth.usuario.id)
    }

    return NextResponse.json({ success: true, initiator_transferred: isInitiator && remainingMembers.length >= 1, dissolved: isInitiator && remainingMembers.length === 0 })
  } catch (error) {
    console.error('Error leaving cluster:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ── helpers ────────────────────────────────────────────────────────────────

async function logEvent(db: any, usuarioId: number, eventType: string, eventData: unknown): Promise<void> {
  await db.insertInto('userevent')
    .values({ usuario_id: usuarioId, event_type: eventType, event_data: JSON.stringify(eventData), created_at: new Date() })
    .execute()
}
