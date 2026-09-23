import { Kysely, sql } from 'kysely'

/**
 * Estado inicial de "publicar cursos con contenido sensible" cuando la región se
 * conoce o cambia (R-#259, https://github.com/pasosdeJesus/learn.tg/issues/259).
 *
 * La migración `20260923150546` dejó el interruptor tri-estado y un disparador que
 * lo materializa desde la región, y `20260923152923` clasificó los países. Faltaban
 * dos casos, detectados al verificar contra la base de desarrollo (2026-09-23,
 * transacciones con ROLLBACK):
 *
 * 1. **Cuentas sin país.** Al quitar el `NOT NULL DEFAULT false` las cuentas que ya
 *    existían se quedaron con `false` explícito, no con `NULL`: la migración de
 *    regiones solo miró a quien **ya** tenía país. Como el disparador solo
 *    materializa si el valor es `NULL`, esas cuentas nunca reciben el estado
 *    inicial de su región cuando el país se conoce — al contrario del objetivo ("en
 *    las regiones sin restricciones el interruptor empieza encendido"). Aquí vuelven
 *    a `NULL` (sin decidir, el estado que sí materializa). Se limita a
 *    `pais_id IS NULL`: es el mismo criterio con el que `20260923152923` trató
 *    `false` como "no decidió" entre quienes ya tenían país.
 * 2. **Cambio de región.** El disparador dejaba el valor tal cual si no era `NULL`,
 *    así que una cuenta materializada en `true` en una región sin restricciones
 *    seguía publicando al mudarse a una región restringida (verificado: Colombia →
 *    Corea del Norte conservaba `true`).
 *
 * Ahora la región manda: cuando el país cambia (decisión del operador, 2026-09-23)
 * el interruptor se recalcula con la región nueva —encendido en Tipo 1, apagado en
 * Tipo 2— y **después la persona puede cambiarlo a mano**: esa decisión se conserva
 * mientras el país no vuelva a cambiar (el disparador no toca nada si `pais_id`
 * llega con el mismo valor).
 *
 * Sin país no hay estado que materializar: el interruptor queda en `NULL`, que todo
 * el código de R-#259 lee como "no publicar" (el default conservador).
 */

const FUNCION_ANTERIOR = sql`
  CREATE OR REPLACE FUNCTION usuario_visibilidad_sensible_por_region()
  RETURNS trigger AS $$
  BEGIN
    IF NEW.mostrar_cursos_sensibles_publico IS NULL AND NEW.pais_id IS NOT NULL THEN
      SELECT CASE WHEN p.tipo_region IS NOT NULL
                  THEN p.tipo_region = 1
                  ELSE NULL
             END
        INTO NEW.mostrar_cursos_sensibles_publico
        FROM msip_pais p
       WHERE p.id = NEW.pais_id;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql
`

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Cuentas sin país que quedaron con el `false` del default histórico: pasan a
  // "sin decidir" para que el disparador materialice el estado de su región cuando
  // la fijen.
  const sinPais = await sql`
    UPDATE usuario
       SET mostrar_cursos_sensibles_publico = NULL
     WHERE pais_id IS NULL
       AND mostrar_cursos_sensibles_publico = false
  `.execute(db)
  console.log(`[estado_inicial_sensible] cuentas sin país que vuelven a "sin decidir": ${sinPais.numAffectedRows ?? '?'}`)

  // 2. El disparador recalcula con la región nueva cada vez que el país cambia.
  await sql`
    CREATE OR REPLACE FUNCTION usuario_visibilidad_sensible_por_region()
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

      -- Un valor explícito al crear la cuenta se respeta: el estado de la región
      -- solo llena la ausencia de decisión.
      IF TG_OP = 'INSERT' AND NEW.mostrar_cursos_sensibles_publico IS NOT NULL THEN
        RETURN NEW;
      END IF;

      SELECT CASE WHEN p.tipo_region IS NOT NULL
                  THEN p.tipo_region = 1
                  ELSE NULL
             END
        INTO NEW.mostrar_cursos_sensibles_publico
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
       SET mostrar_cursos_sensibles_publico = false
     WHERE pais_id IS NULL
       AND mostrar_cursos_sensibles_publico IS NULL
  `.execute(db)
}
