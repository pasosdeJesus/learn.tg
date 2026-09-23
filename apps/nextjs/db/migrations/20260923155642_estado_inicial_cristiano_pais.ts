import { Kysely, sql } from 'kysely'

/**
 * Estado inicial de "publicar cursos con contenido cristiano" cuando el país se
 * conoce o cambia (R-#259, https://github.com/pasosdeJesus/learn.tg/issues/259).
 *
 * La migración `20260923150546` dejó el interruptor tri-estado y un disparador que
 * lo materializa desde el país, y `20260923152923` clasificó los 249 países.
 * Faltaban dos casos, detectados al verificar contra la base de desarrollo
 * (2026-09-23, transacciones con ROLLBACK):
 *
 * 1. **Cuentas sin país.** Al quitar el `NOT NULL DEFAULT false` las cuentas que ya
 *    existían se quedaron con `false` explícito, no con `NULL`: la migración de
 *    países solo miró a quien **ya** tenía país. Como el disparador solo
 *    materializa si el valor es `NULL`, esas cuentas nunca reciben el estado
 *    inicial de su país cuando el país se conoce — al contrario del objetivo ("en
 *    los países sin persecución el interruptor empieza encendido"). Aquí vuelven a
 *    `NULL` (sin decidir, el estado que sí materializa). Se limita a
 *    `pais_id IS NULL`: es el mismo criterio con el que `20260923152923` trató
 *    `false` como "no decidió" entre quienes ya tenían país.
 * 2. **Cambio de país.** El disparador dejaba el valor tal cual si no era `NULL`,
 *    así que una cuenta materializada en `true` en un país sin persecución seguía
 *    publicando al cambiarse a un país perseguidor (verificado: Colombia → Corea
 *    del Norte conservaba `true`).
 *
 * Ahora el país manda: cuando el país cambia (decisión del operador, 2026-09-23) el
 * interruptor se recalcula con el país nuevo —encendido donde no hay persecución,
 * apagado donde la hay— y **después la persona puede cambiarlo a mano**: esa
 * decisión se conserva mientras el país no vuelva a cambiar (el disparador no toca
 * nada si `pais_id` llega con el mismo valor).
 *
 * Sin país no hay estado que materializar: el interruptor queda en `NULL`, que todo
 * el código de R-#259 lee como "no publicar" (el default conservador).
 */

const FUNCION_ANTERIOR = sql`
  CREATE OR REPLACE FUNCTION usuario_visibilidad_cristiana_por_pais()
  RETURNS trigger AS $$
  BEGIN
    IF NEW.mostrar_cursos_cristianos_publico IS NULL AND NEW.pais_id IS NOT NULL THEN
      SELECT CASE WHEN p.clasificado_cristianos
                  THEN NOT COALESCE(p.persigue_cristianos, false)
                  ELSE NULL
             END
        INTO NEW.mostrar_cursos_cristianos_publico
        FROM msip_pais p
       WHERE p.id = NEW.pais_id;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
`

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Cuentas sin país que quedaron con el `false` del default histórico: pasan a
  // "sin decidir" para que el disparador materialice el estado de su país cuando lo
  // fijen.
  const sinPais = await sql`
    UPDATE usuario
       SET mostrar_cursos_cristianos_publico = NULL
     WHERE pais_id IS NULL
       AND mostrar_cursos_cristianos_publico = false
  `.execute(db)
  console.log(`[estado_inicial_cristiano_pais] cuentas sin país que vuelven a "sin decidir": ${sinPais.numAffectedRows ?? '?'}`)

  // 2. El disparador recalcula con el país nuevo cada vez que el país cambia.
  await sql`
    CREATE OR REPLACE FUNCTION usuario_visibilidad_cristiana_por_pais()
    RETURNS trigger AS $$
    BEGIN
      IF NEW.pais_id IS NULL THEN
        RETURN NEW;
      END IF;

      -- El país no cambió (la fila se guardó por otra razón): la decisión del
      -- estudiante manda y no se recalcula nada.
      IF TG_OP = 'UPDATE' AND NEW.pais_id IS NOT DISTINCT FROM OLD.pais_id THEN
        RETURN NEW;
      END IF;

      -- Un valor explícito al crear la cuenta se respeta: el estado del país solo
      -- llena la ausencia de decisión.
      IF TG_OP = 'INSERT' AND NEW.mostrar_cursos_cristianos_publico IS NOT NULL THEN
        RETURN NEW;
      END IF;

      SELECT CASE WHEN p.clasificado_cristianos
                  THEN NOT COALESCE(p.persigue_cristianos, false)
                  ELSE NULL
             END
        INTO NEW.mostrar_cursos_cristianos_publico
        FROM msip_pais p
       WHERE p.id = NEW.pais_id;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await FUNCION_ANTERIOR.execute(db)

  // La única dirección segura es volver al default conservador.
  await sql`
    UPDATE usuario
       SET mostrar_cursos_cristianos_publico = false
     WHERE pais_id IS NULL
       AND mostrar_cursos_cristianos_publico IS NULL
  `.execute(db)
}
