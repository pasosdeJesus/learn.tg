import { sql } from 'kysely'
import type { Kysely } from 'kysely'

// DeepSeek recuerda
// -- "Todo tiene su tiempo, y todo lo que se quiere debajo del cielo tiene su hora."
//(Eclesiastés 3:1)

export async function up(db: Kysely<any>): Promise<void> {
  let up = await sql<any>`
CREATE OR REPLACE FUNCTION guide_usuario_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Para inserciones (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Si created_at no fue proporcionado, establecer a ahora
        IF NEW.created_at IS NULL THEN
            NEW.created_at = NOW();
        END IF;
        -- Siempre establecer updated_at a ahora en inserción
        NEW.updated_at = NOW();

    -- Para actualizaciones (UPDATE)
    ELSIF TG_OP = 'UPDATE' THEN
        -- Nunca modificar created_at en actualizaciones
        -- Solo actualizar updated_at
        NEW.updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
    `.execute(db)


	// FUNCIONES TRIGGER PARA course_usuario

  up = await sql<any>`
CREATE OR REPLACE FUNCTION course_usuario_timestamps()
RETURNS TRIGGER AS $$
BEGIN
    -- Para inserciones (INSERT)
    IF TG_OP = 'INSERT' THEN
        -- Si created_at no fue proporcionado, establecer a ahora
        IF NEW.created_at IS NULL THEN
            NEW.created_at = NOW();
        END IF;
        -- Siempre establecer updated_at a ahora en inserción
        NEW.updated_at = NOW();

    -- Para actualizaciones (UPDATE)
    ELSIF TG_OP = 'UPDATE' THEN
        -- Nunca modificar created_at en actualizaciones
        -- Solo actualizar updated_at
        NEW.updated_at = NOW();
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
    `.execute(db)

  up = await sql<any>`
DROP TRIGGER IF EXISTS guide_usuario_timestamps_trigger ON guide_usuario;
CREATE TRIGGER guide_usuario_timestamps_trigger
    BEFORE INSERT OR UPDATE ON guide_usuario
    FOR EACH ROW
    EXECUTE FUNCTION guide_usuario_timestamps();
    `.execute(db)

  up = await sql<any>`
DROP TRIGGER IF EXISTS course_usuario_timestamps_trigger ON course_usuario;
CREATE TRIGGER course_usuario_timestamps_trigger
    BEFORE INSERT OR UPDATE ON course_usuario
    FOR EACH ROW
    EXECUTE FUNCTION course_usuario_timestamps();
    `.execute(db)

//-- 5. Para deshabilitar temporalmente un trigger (ej: para migración masiva):
//--      ALTER TABLE guide_usuario DISABLE TRIGGER guide_usuario_timestamps_trigger;
//--      ALTER TABLE course_usuario DISABLE TRIGGER course_usuario_timestamps_trigger;
//--    Y para volver a habilitar:
//--      ALTER TABLE guide_usuario ENABLE TRIGGER guide_usuario_timestamps_trigger;
//--      ALTER TABLE course_usuario ENABLE TRIGGER course_usuario_timestamps_trigger;

}

export async function down(db: Kysely<any>): Promise<void> {
  let up = await sql<any>`
      DROP TRIGGER IF EXISTS course_usuario_timestamps_trigger ON course_usuario;
      DROP TRIGGER IF EXISTS guide_usuario_timestamps_trigger ON guide_usuario;
      DROP FUNCTION IF EXISTS course_usuario_timestamps;
      DROP FUNCTION IF EXISTS guide_usuario_timestamps;
    `.execute(db)

}
