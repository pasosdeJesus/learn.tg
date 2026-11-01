import { Kysely, sql } from 'kysely'

// Liberación del fondo del clúster (https://github.com/pasosdeJesus/learn.tg/issues/161).
//
// El 10 % de las compras y becas de las iglesias de un clúster sigue llegando al fondo
// del clúster mientras ese fondo exista, aunque el clúster haya salido del ranking. Solo
// cuando el fondo se entrega a la billetera del clúster (estado `answered` de la
// presentación a Global Disciples y todos los pastores han pulsado Retirar) las compras y
// becas siguientes de esas iglesias enrutan el 10 % al fondo del país: ya no hay fondo de
// clúster.
//
// `fund_released_at` es la señal que usa `resolveGDClusterDestination`; los montos se
// guardan en unidades humanas (USDT y SLEARN) para el historial y el tablero.
// Reversible.

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('clustergd')
    .addColumn('fund_released_at', 'timestamptz')
    .addColumn('fund_released_amount', sql`numeric(14,2)`)
    .addColumn('fund_released_slearn', sql`numeric(14,2)`)
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('clustergd')
    .dropColumn('fund_released_at')
    .dropColumn('fund_released_amount')
    .dropColumn('fund_released_slearn')
    .execute()
}
