import { Kysely, sql } from 'kysely'

// Modelo de roles iglesia→persona (en `usuario.church_relationship`):
//   'pastor'      → pastor PRINCIPAL (uno por iglesia; coincide con `church.pastor_id`)
//   'co_pastor'   → pastores secundarios (muchos por iglesia)
//   'leader'      → líder de iglesia (rol independiente; NO es pastor principal)
//   'member'      → miembro
//
// Migración:
//   1. Dedupe: si una iglesia tiene varios 'pastor', conserva UNO (el que ya era
//      church.pastor_id, o el de menor id) y degrada los demás a 'co_pastor'.
//      'leader' y 'member' NO se tocan.
//   2. Índice único parcial: máximo un pastor principal por iglesia (garantía dura).
//   3. CHECK de vocabulario en ambos campos (church_relationship y su verificado).
//   4. Trigger: mantiene `church.pastor_id` sincronizado con el pastor principal
//      (el invariante "solo un principal, que coincide con pastor_id").

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Dedupe: un solo 'pastor' por iglesia (prefiere church.pastor_id, si no el
  //    de menor id); los demás pasan a 'co_pastor'.
  await sql`
    UPDATE usuario u
    SET church_relationship = 'co_pastor', updated_at = NOW()
    WHERE u.id IN (
      SELECT id FROM (
        SELECT u2.id,
               row_number() OVER (
                 PARTITION BY u2.church_id
                 ORDER BY (u2.id = COALESCE(c.pastor_id, -1)) DESC, u2.id ASC
               ) AS rn
        FROM usuario u2
        LEFT JOIN church c ON c.id = u2.church_id
        WHERE u2.church_id IS NOT NULL AND u2.church_relationship = 'pastor'
      ) t WHERE t.rn > 1
    )
  `.execute(db)

  // 2. CHECK de vocabulario
  await sql`
    ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_church_relationship_check;
    ALTER TABLE usuario ADD CONSTRAINT usuario_church_relationship_check
      CHECK (church_relationship IS NULL OR church_relationship IN ('pastor', 'co_pastor', 'leader', 'member'))
  `.execute(db)
  await sql`
    ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_verified_church_relationship_check;
    ALTER TABLE usuario ADD CONSTRAINT usuario_verified_church_relationship_check
      CHECK (verified_church_relationship IS NULL OR verified_church_relationship IN ('pastor', 'co_pastor', 'leader', 'member'))
  `.execute(db)

  // 3. Índice único parcial: máximo un pastor principal por iglesia
  await sql`
    DROP INDEX IF EXISTS one_principal_per_church;
    CREATE UNIQUE INDEX one_principal_per_church
      ON usuario (church_id) WHERE church_relationship = 'pastor'
  `.execute(db)

  // 4. Trigger: `church.pastor_id` siempre coincide con el pastor principal
  await sql`
    CREATE OR REPLACE FUNCTION sync_church_principal() RETURNS trigger AS $$
    BEGIN
      IF NEW.church_id IS NOT NULL AND NEW.church_relationship = 'pastor' THEN
        UPDATE church SET pastor_id = NEW.id, updated_at = NOW() WHERE id = NEW.church_id;
      ELSE
        IF OLD.church_id IS NOT NULL THEN
          UPDATE church SET pastor_id = NULL, updated_at = NOW()
          WHERE id = OLD.church_id AND pastor_id = NEW.id;
        END IF;
        IF NEW.church_id IS NOT NULL THEN
          UPDATE church SET pastor_id = NULL, updated_at = NOW()
          WHERE id = NEW.church_id AND pastor_id = NEW.id;
        END IF;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DROP TRIGGER IF EXISTS trg_sync_church_principal ON usuario;
    CREATE TRIGGER trg_sync_church_principal
      AFTER INSERT OR UPDATE OF church_id, church_relationship ON usuario
      FOR EACH ROW EXECUTE FUNCTION sync_church_principal()
  `.execute(db)

  // 5. Backfill: dispara el trigger para los principales existentes (los UPDATE
  //    sin cambio real ejecutan el trigger y sincronizan church.pastor_id).
  await sql`
    UPDATE usuario SET church_relationship = church_relationship
    WHERE church_relationship = 'pastor' AND church_id IS NOT NULL
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS trg_sync_church_principal ON usuario`.execute(db)
  await sql`DROP FUNCTION IF EXISTS sync_church_principal()`.execute(db)
  await sql`DROP INDEX IF EXISTS one_principal_per_church`.execute(db)
  await sql`ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_church_relationship_check`.execute(db)
  await sql`ALTER TABLE usuario DROP CONSTRAINT IF EXISTS usuario_verified_church_relationship_check`.execute(db)
  // Los 'co_pastor' vuelven a 'pastor' (estado previo: los secundarios eran 'pastor')
  await sql`UPDATE usuario SET church_relationship = 'pastor', updated_at = NOW() WHERE church_relationship = 'co_pastor'`.execute(db)
}
