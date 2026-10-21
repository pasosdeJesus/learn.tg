import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql<any>`
    DROP TRIGGER IF EXISTS course_usuario_timestamps_trigger ON course_usuario;
  `.execute(db)

  await sql<any>`
    DROP FUNCTION IF EXISTS course_usuario_timestamps;
  `.execute(db)

  await db.schema.dropTable('course_usuario').ifExists().execute()
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('course_usuario')
    .addColumn('usuario_id', 'integer', (col) => col.notNull())
    .addColumn('proyectofinanciero_id', 'integer', (col) => col.notNull())
    .addColumn('points', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('guidespoints', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('amountscholarship', 'numeric', (col) => col.notNull().defaultTo(0))
    .addColumn('percentagecompleted', 'numeric', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamp')
    .addColumn('updated_at', 'timestamp')
    .addPrimaryKeyConstraint('course_usuario_pkey', ['usuario_id', 'proyectofinanciero_id'])
    .execute()

  await sql<any>`
    CREATE OR REPLACE FUNCTION course_usuario_timestamps()
    RETURNS TRIGGER AS $$
    BEGIN
        IF TG_OP = 'INSERT' THEN
            IF NEW.created_at IS NULL THEN
                NEW.created_at = NOW();
            END IF;
            NEW.updated_at = NOW();
        ELSIF TG_OP = 'UPDATE' THEN
            NEW.updated_at = NOW();
        END IF;
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db)

  await sql<any>`
    DROP TRIGGER IF EXISTS course_usuario_timestamps_trigger ON course_usuario;
    CREATE TRIGGER course_usuario_timestamps_trigger
        BEFORE INSERT OR UPDATE ON course_usuario
        FOR EACH ROW
        EXECUTE FUNCTION course_usuario_timestamps();
  `.execute(db)
}
