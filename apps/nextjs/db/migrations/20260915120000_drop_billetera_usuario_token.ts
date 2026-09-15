import { Kysely } from 'kysely'

// R-#233 Fase 2: la cookie de sesión de NextAuth es la única credencial.
// `billetera_usuario.token` dejó de escribirse (`authorize()` ya no lo genera)
// y de leerse (`authenticateUser()` valida solo la sesión), así que se elimina.
//
// ORDEN DE DESPLIEGUE: ejecutar DESPUÉS de desplegar el código que ya no usa la
// columna. Si todavía corre el código anterior (que autenticaba con wallet +
// token), quitarla produciría 401 en todas las rutas autenticadas.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('billetera_usuario')
    .dropColumn('token')
    .execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('billetera_usuario')
    .addColumn('token', 'varchar(256)')
    .execute()
}
