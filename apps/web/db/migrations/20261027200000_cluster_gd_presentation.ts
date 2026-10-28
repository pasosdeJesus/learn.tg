import { Kysely, sql } from 'kysely'

// Presentación de un clúster a Global Disciples (R-#161, decisión del operador
// 2026-10-27). El iniciador solicita la presentación cuando el clúster y sus pastores
// cumplen las condiciones; pdJ escribe a su contacto en GD, marca el envío y registra
// la respuesta y el correo/canal que GD indique para seguir hablando directamente.
//
// Verificación de condiciones: `packages/gdcluster/src/lib/gd-presentation.ts`.
// Reversible (las columnas se eliminan en `down`).

export async function up(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE clustergd
    ADD COLUMN gd_requested_at timestamptz,
    ADD COLUMN gd_requested_by integer,
    ADD COLUMN gd_sent_at timestamptz,
    ADD COLUMN gd_sent_by integer,
    ADD COLUMN gd_response text,
    ADD COLUMN gd_response_at timestamptz,
    ADD COLUMN gd_response_by integer,
    ADD COLUMN gd_contact_email text`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE clustergd
    DROP COLUMN gd_requested_at,
    DROP COLUMN gd_requested_by,
    DROP COLUMN gd_sent_at,
    DROP COLUMN gd_sent_by,
    DROP COLUMN gd_response,
    DROP COLUMN gd_response_at,
    DROP COLUMN gd_response_by,
    DROP COLUMN gd_contact_email`.execute(db)
}
