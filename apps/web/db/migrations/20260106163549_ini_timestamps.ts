import { sql } from 'kysely'
import type { Kysely } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  let up = await sql<any>`
      UPDATE guide_usuario SET updated_at = NOW(), created_at = NOW() WHERE created_at IS NULL; 
    `.execute(db)
  console.log("up=", up)
  up = await sql<any>`
      UPDATE course_usuario SET updated_at = NOW(), created_at = NOW() WHERE created_at IS NULL; 
    `.execute(db)
  console.log("up=", up)

}

export async function down(db: Kysely<any>): Promise<void> {
}
