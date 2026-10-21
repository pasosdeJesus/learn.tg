import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  let u = await sql<any>`
  UPDATE usuario SET profilescore=20 WHERE profilescore=52;
  `.execute(db)
  console.log("u=", u)
}

export async function down(db: Kysely<any>): Promise<void> {
  let d = await sql<any>`
  UPDATE usuario SET profilescore=52 WHERE profilescore=20;
  `.execute(db)
  console.log("d=", d)

}
