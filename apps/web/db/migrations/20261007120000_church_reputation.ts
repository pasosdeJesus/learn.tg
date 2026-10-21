import { Kysely, sql } from 'kysely'

// R-#164 Fase 1 — Church directory + minimal (internal) reputation.
// https://github.com/pasosdeJesus/learn.tg/issues/164
//
// Base de:
//   - el directorio público de iglesias (`/[lang]/directory/churches`);
//   - la reputación interna (verificación + evidencia, con tope -50);
//   - `activity_score`: agregado por iglesia de los seis componentes de la R-#278,
//     guardado como **crudos por iglesia** en `churchactivitycache` y normalizado
//     **al leer** (no se guarda el valor normalizado).
//
// Privacidad (R-#164 §1.1): una iglesia cuyo país es región tipo 2 nunca se publica;
// el directorio la excluye por `msip_pais.tipo_region`.

export async function up(db: Kysely<any>): Promise<void> {
  // ── Reputación de pastor (interna) ──────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS pastorreputation (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuario(id),
      reputation_score INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (usuario_id)
    )
  `.execute(db)

  await sql`
    CREATE TABLE IF NOT EXISTS reputationevidence (
      id SERIAL PRIMARY KEY,
      pastorreputation_id INTEGER NOT NULL REFERENCES pastorreputation(id),
      evidence_reason VARCHAR(50) NOT NULL,
      evidence_notes TEXT,
      recorded_by INTEGER NOT NULL REFERENCES usuario(id),
      recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      notified_at TIMESTAMP,
      reply_received_at TIMESTAMP,
      resolved_at TIMESTAMP,
      resolved_by INTEGER REFERENCES usuario(id),
      resolution_notes TEXT,
      CONSTRAINT reputationevidence_reason_check
        CHECK (evidence_reason IN ('dishonesty', 'sexual_abuse', 'zionism', 'other'))
    )
  `.execute(db)

  await sql`
    CREATE TABLE IF NOT EXISTS reputationevidencefile (
      id SERIAL PRIMARY KEY,
      reputationevidence_id INTEGER NOT NULL REFERENCES reputationevidence(id),
      file_path VARCHAR(255) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      file_mime VARCHAR(100),
      file_size INTEGER,
      uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)

  await sql`
    CREATE TABLE IF NOT EXISTS churchreputation (
      id SERIAL PRIMARY KEY,
      church_id INTEGER NOT NULL REFERENCES church(id),
      reputation_score INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (church_id)
    )
  `.execute(db)

  // ── Caché de actividad por iglesia (crudos, no normalizados) ─────────────
  await sql`
    CREATE TABLE IF NOT EXISTS churchactivitycache (
      church_id INTEGER PRIMARY KEY REFERENCES church(id),
      guide_score_sum NUMERIC NOT NULL DEFAULT 0,
      referral_count_sum NUMERIC NOT NULL DEFAULT 0,
      donations_usdt_sum NUMERIC NOT NULL DEFAULT 0,
      sbt_count_sum NUMERIC NOT NULL DEFAULT 0,
      slearn_balance_sum NUMERIC NOT NULL DEFAULT 0,
      profilescore_sum NUMERIC NOT NULL DEFAULT 0,
      amount_member INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `.execute(db)

  // ── Columnas nuevas de `church` ─────────────────────────────────────────
  await sql`
    ALTER TABLE church ADD COLUMN IF NOT EXISTS is_listed BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE church ADD COLUMN IF NOT EXISTS listing_reason VARCHAR(50);
    ALTER TABLE church ADD COLUMN IF NOT EXISTS consent_public BOOLEAN NOT NULL DEFAULT TRUE
  `.execute(db)

  // ── Reputación interna: recalculo por iglesia ───────────────────────────
  // Positivos (§2.1): +10 iglesia verificada, +20 pastor principal verificado.
  // Negativos (§2.3): evidencia activa de deshonestidad/abuso contra el pastor
  // principal o un co-pastor **topea** la iglesia en -50 (no compensable); líder -20
  // y miembro -10 (sin tope), una vez por rol.
  await sql`
    CREATE OR REPLACE FUNCTION refresh_church_reputation(p_church_id INTEGER)
    RETURNS void AS $$
    DECLARE
      v_positives INTEGER := 0;
      v_penalty INTEGER := 0;
      v_cap BOOLEAN := FALSE;
      v_reg_verified BOOLEAN := FALSE;
    BEGIN
      SELECT COALESCE(c.registration_verified, FALSE) INTO v_reg_verified
      FROM church c WHERE c.id = p_church_id;
      IF NOT FOUND THEN
        RETURN;
      END IF;

      IF v_reg_verified THEN v_positives := v_positives + 10; END IF;
      IF EXISTS (
        SELECT 1 FROM usuario u
        WHERE u.church_id = p_church_id AND u.church_relationship = 'pastor'
          AND u.verified_church_relationship = 'pastor'
      ) THEN v_positives := v_positives + 20; END IF;

      SELECT EXISTS (
        SELECT 1 FROM reputationevidence e
        JOIN pastorreputation pr ON pr.id = e.pastorreputation_id
        JOIN usuario u ON u.id = pr.usuario_id
        WHERE u.church_id = p_church_id AND e.resolved_at IS NULL
          AND e.evidence_reason IN ('dishonesty', 'sexual_abuse')
          AND u.church_relationship IN ('pastor', 'co_pastor')
      ) INTO v_cap;

      IF NOT v_cap THEN
        IF EXISTS (
          SELECT 1 FROM usuario u
          WHERE u.church_id = p_church_id AND u.church_relationship = 'leader'
            AND EXISTS (SELECT 1 FROM reputationevidence e
                        JOIN pastorreputation pr ON pr.id = e.pastorreputation_id
                        WHERE pr.usuario_id = u.id AND e.resolved_at IS NULL)
        ) THEN v_penalty := v_penalty + 20; END IF;
        IF EXISTS (
          SELECT 1 FROM usuario u
          WHERE u.church_id = p_church_id AND u.church_relationship = 'member'
            AND EXISTS (SELECT 1 FROM reputationevidence e
                        JOIN pastorreputation pr ON pr.id = e.pastorreputation_id
                        WHERE pr.usuario_id = u.id AND e.resolved_at IS NULL)
        ) THEN v_penalty := v_penalty + 10; END IF;
      END IF;

      INSERT INTO churchreputation (church_id, reputation_score, updated_at)
      VALUES (
        p_church_id,
        CASE WHEN v_cap THEN LEAST(v_positives - v_penalty, -50) ELSE v_positives - v_penalty END,
        NOW()
      )
      ON CONFLICT (church_id) DO UPDATE
        SET reputation_score = EXCLUDED.reputation_score, updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  // ── Actividad por iglesia: crudos de los seis componentes de la R-#278 ──
  // Local: con `p_church_id` recalcula solo esa iglesia.
  await sql`
    CREATE OR REPLACE FUNCTION refresh_church_activity_cache(p_church_id INTEGER DEFAULT NULL)
    RETURNS void AS $$
    BEGIN
      INSERT INTO churchactivitycache (
        church_id, guide_score_sum, referral_count_sum, donations_usdt_sum,
        sbt_count_sum, slearn_balance_sum, profilescore_sum, amount_member, updated_at)
      SELECT
        m.church_id,
        COALESCE(SUM(m.guide_score), 0),
        COALESCE(SUM(m.referral_count), 0),
        COALESCE(SUM(m.donations_usdt), 0),
        COALESCE(SUM(m.sbt_count), 0),
        COALESCE(SUM(m.slearn_balance), 0),
        COALESCE(SUM(m.profilescore), 0),
        COUNT(*),
        NOW()
      FROM (
        SELECT
          u.church_id,
          COALESCE(u.profilescore, 0) AS profilescore,
          COALESCE((
            SELECT COUNT(DISTINCT gu.actividadpf_id)
            FROM guide_usuario gu
            JOIN cor1440_gen_actividadpf a ON a.id = gu.actividadpf_id
            LEFT JOIN cor1440_gen_proyectofinanciero c ON c.id = a.proyectofinanciero_id
            WHERE gu.usuario_id = u.id AND gu.points > 0
              AND (c.contenido_sensible = FALSE OR u.mostrar_cursos_sensibles_publico = TRUE)
          ), 0)
          + COALESCE((
            SELECT COUNT(DISTINCT gu.actividadpf_id)
            FROM guide_usuario gu
            JOIN cor1440_gen_actividadpf a ON a.id = gu.actividadpf_id
            LEFT JOIN cor1440_gen_proyectofinanciero c ON c.id = a.proyectofinanciero_id
            WHERE gu.usuario_id = u.id
              AND (c.contenido_sensible = FALSE OR u.mostrar_cursos_sensibles_publico = TRUE)
              AND EXISTS (
                SELECT 1 FROM transaction t
                WHERE t.usuario_id = gu.usuario_id AND t.type = 'scholarship'
                  AND t.crypto = 'usdt' AND t.metadata->>'guideId' = gu.actividadpf_id::text)
          ), 0)
          + COALESCE((
            SELECT COUNT(DISTINCT gu.actividadpf_id)
            FROM guide_usuario gu
            JOIN cor1440_gen_actividadpf a ON a.id = gu.actividadpf_id
            LEFT JOIN cor1440_gen_proyectofinanciero c ON c.id = a.proyectofinanciero_id
            WHERE gu.usuario_id = u.id
              AND (c.contenido_sensible = FALSE OR u.mostrar_cursos_sensibles_publico = TRUE)
              AND EXISTS (
                SELECT 1 FROM transaction t
                WHERE t.usuario_id = gu.usuario_id AND t.type = 'scholarship'
                  AND t.crypto = 'slearn' AND t.metadata->>'guideId' = gu.actividadpf_id::text)
          ), 0) AS guide_score,
          COALESCE((SELECT COUNT(*) FROM referralrelationship rr WHERE rr.referrer_id = u.id), 0) AS referral_count,
          COALESCE((SELECT SUM(t.amount) FROM transaction t
                    WHERE t.usuario_id = u.id AND t.type = 'donation' AND t.crypto = 'usdt'), 0) AS donations_usdt,
          COALESCE((
            SELECT COUNT(*)
            FROM credential_emission ce
            LEFT JOIN cor1440_gen_proyectofinanciero c ON c.id = ce.course_id
            WHERE ce.usuario_id = u.id AND ce.revoked_at IS NULL
              AND (c.contenido_sensible = FALSE OR u.mostrar_cursos_sensibles_publico = TRUE)
          ), 0) AS sbt_count,
          COALESCE((SELECT SUM(t.balance_impact) FROM transaction t
                    WHERE t.usuario_id = u.id AND t.crypto = 'slearn'), 0) AS slearn_balance
        FROM usuario u
        JOIN church ch ON ch.id = u.church_id
        WHERE u.church_id IS NOT NULL
          AND u.excluir_leaderboard IS NOT TRUE
          AND (p_church_id IS NULL OR u.church_id = p_church_id)
      ) m
      GROUP BY m.church_id
      ON CONFLICT (church_id) DO UPDATE SET
        guide_score_sum = EXCLUDED.guide_score_sum,
        referral_count_sum = EXCLUDED.referral_count_sum,
        donations_usdt_sum = EXCLUDED.donations_usdt_sum,
        sbt_count_sum = EXCLUDED.sbt_count_sum,
        slearn_balance_sum = EXCLUDED.slearn_balance_sum,
        profilescore_sum = EXCLUDED.profilescore_sum,
        amount_member = EXCLUDED.amount_member,
        updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  // ── Triggers: reputación ────────────────────────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION trg_reputationevidence_refresh() RETURNS trigger AS $$
    DECLARE
      v_usuario INTEGER;
      v_church INTEGER;
    BEGIN
      SELECT pr.usuario_id INTO v_usuario FROM pastorreputation pr
        WHERE pr.id = COALESCE(NEW.pastorreputation_id, OLD.pastorreputation_id);
      SELECT u.church_id INTO v_church FROM usuario u WHERE u.id = v_usuario;
      IF v_church IS NOT NULL THEN
        PERFORM refresh_church_reputation(v_church);
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS trg_reputationevidence_refresh ON reputationevidence;
    CREATE TRIGGER trg_reputationevidence_refresh
      AFTER INSERT OR UPDATE ON reputationevidence
      FOR EACH ROW EXECUTE FUNCTION trg_reputationevidence_refresh()
  `.execute(db)

  await sql`
    CREATE OR REPLACE FUNCTION trg_church_reputation_refresh() RETURNS trigger AS $$
    BEGIN
      PERFORM refresh_church_reputation(NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    DROP TRIGGER IF EXISTS trg_church_reputation_refresh ON church;
    CREATE TRIGGER trg_church_reputation_refresh
      AFTER INSERT OR UPDATE OF registration_verified ON church
      FOR EACH ROW EXECUTE FUNCTION trg_church_reputation_refresh()
  `.execute(db)

  // ── Triggers: actividad ─────────────────────────────────────────────────
  await sql`
    CREATE OR REPLACE FUNCTION trg_user_church_activity_refresh() RETURNS trigger AS $$
    DECLARE
      v_user INTEGER;
      v_church INTEGER;
    BEGIN
      IF TG_TABLE_NAME = 'usuario' THEN
        v_user := COALESCE(NEW.id, OLD.id);
      ELSIF TG_TABLE_NAME = 'referralrelationship' THEN
        v_user := COALESCE(NEW.referrer_id, OLD.referrer_id);
      ELSE
        v_user := COALESCE(NEW.usuario_id, OLD.usuario_id);
      END IF;
      SELECT u.church_id INTO v_church FROM usuario u WHERE u.id = v_user;
      IF v_church IS NOT NULL THEN
        PERFORM refresh_church_activity_cache(v_church);
      END IF;
      IF TG_TABLE_NAME = 'usuario' AND TG_OP = 'UPDATE' THEN
        IF OLD.church_id IS NOT NULL AND OLD.church_id IS DISTINCT FROM NEW.church_id THEN
          PERFORM refresh_church_activity_cache(OLD.church_id);
        END IF;
      END IF;
      RETURN COALESCE(NEW, OLD);
    END;
    $$ LANGUAGE plpgsql
  `.execute(db)

  for (const [table, op] of [
    ['usuario', 'AFTER INSERT OR UPDATE OF church_id, excluir_leaderboard, profilescore, mostrar_cursos_sensibles_publico, mostrar_cursos_publico'],
    ['transaction', 'AFTER INSERT OR UPDATE OR DELETE'],
    ['guide_usuario', 'AFTER INSERT OR UPDATE OR DELETE'],
    ['credential_emission', 'AFTER INSERT OR UPDATE OR DELETE'],
    ['referralrelationship', 'AFTER INSERT OR UPDATE OR DELETE'],
  ] as const) {
    await sql`
      DROP TRIGGER IF EXISTS trg_church_activity_${sql.raw(table)} ON ${sql.raw(table)};
      CREATE TRIGGER trg_church_activity_${sql.raw(table)}
        ${sql.raw(op)} ON ${sql.raw(table)}
        FOR EACH ROW EXECUTE FUNCTION trg_user_church_activity_refresh()
    `.execute(db)
  }

  // ── Backfill ────────────────────────────────────────────────────────────
  await sql`SELECT refresh_church_activity_cache(NULL)`.execute(db)
  await sql`
    DO $$
    DECLARE r RECORD;
    BEGIN
      FOR r IN SELECT id FROM church LOOP
        PERFORM refresh_church_reputation(r.id);
      END LOOP;
    END;
    $$
  `.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const t of ['usuario', 'transaction', 'guide_usuario', 'credential_emission', 'referralrelationship']) {
    await sql`DROP TRIGGER IF EXISTS trg_church_activity_${sql.raw(t)} ON ${sql.raw(t)}`.execute(db)
  }
  await sql`DROP FUNCTION IF EXISTS trg_user_church_activity_refresh()`.execute(db)
  await sql`DROP TRIGGER IF EXISTS trg_church_reputation_refresh ON church`.execute(db)
  await sql`DROP FUNCTION IF EXISTS trg_church_reputation_refresh()`.execute(db)
  await sql`DROP TRIGGER IF EXISTS trg_reputationevidence_refresh ON reputationevidence`.execute(db)
  await sql`DROP FUNCTION IF EXISTS trg_reputationevidence_refresh()`.execute(db)
  await sql`DROP FUNCTION IF EXISTS refresh_church_activity_cache(INTEGER)`.execute(db)
  await sql`DROP FUNCTION IF EXISTS refresh_church_reputation(INTEGER)`.execute(db)
  await sql`ALTER TABLE church DROP COLUMN IF EXISTS consent_public`.execute(db)
  await sql`ALTER TABLE church DROP COLUMN IF EXISTS listing_reason`.execute(db)
  await sql`ALTER TABLE church DROP COLUMN IF EXISTS is_listed`.execute(db)
  await sql`DROP TABLE IF EXISTS churchactivitycache`.execute(db)
  await sql`DROP TABLE IF EXISTS churchreputation`.execute(db)
  await sql`DROP TABLE IF EXISTS reputationevidencefile`.execute(db)
  await sql`DROP TABLE IF EXISTS reputationevidence`.execute(db)
  await sql`DROP TABLE IF EXISTS pastorreputation`.execute(db)
}
