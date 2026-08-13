import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    CREATE TABLE premium_course_usuario (
      id SERIAL PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuario(id),
      course_id INTEGER NOT NULL REFERENCES cor1440_gen_proyectofinanciero(id),
      purchased_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      usdt_amount_paid DECIMAL(10,2),
      slearn_amount_paid INTEGER,
      transaction_hash VARCHAR(66) NOT NULL,
      expires_at TIMESTAMP,
      UNIQUE(usuario_id, course_id)
    )
  `.execute(db)

  await sql`CREATE INDEX idx_premium_course_usuario_usuario ON premium_course_usuario(usuario_id)`.execute(db)
  await sql`CREATE INDEX idx_premium_course_usuario_course ON premium_course_usuario(course_id)`.execute(db)
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS premium_course_usuario`.execute(db)
}
