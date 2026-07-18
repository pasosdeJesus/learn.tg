import { Kysely, sql } from 'kysely'

export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Badjia', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Badjia' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bagbo', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bagbo' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bagbwe(Bagbe)', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bagbwe(Bagbe)' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bo Town', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bo Town' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Boama', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Boama' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bumpe Ngao', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bumpe Ngao' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbo', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbo' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Jaiama Bongor', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Jaiama Bongor' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kakua', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kakua' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Komboya', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Komboya' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Lugbu', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Lugbu' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Niawa Lenga', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Niawa Lenga' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Selenga', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Selenga' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tikonko', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tikonko' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Valunia', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Valunia' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Wonde', 10001, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Wonde' AND departamento_id = 10001
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Biriwa', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Biriwa' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bombali Sebora', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bombali Sebora' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbanti Kamarank', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbanti Kamarank' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbendembu Ngowa', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbendembu Ngowa' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Magbaimba Ndorh', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Magbaimba Ndorh' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Makari Gbanti', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Makari Gbanti' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Makeni Town', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Makeni Town' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Paki Masabong', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Paki Masabong' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Safroko Limba', 10002, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Safroko Limba' AND departamento_id = 10002
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bendu-Cha', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bendu-Cha' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bonthe Urban', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bonthe Urban' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bum', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bum' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dema', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dema' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Imperri', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Imperri' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Jong', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Jong' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kpanda Kemo', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kpanda Kemo' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kwamebai Krim', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kwamebai Krim' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Nongoba Bullom', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Nongoba Bullom' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sittia', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sittia' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sogbeni', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sogbeni' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Yawbeko', 10003, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Yawbeko' AND departamento_id = 10003
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dembelia - Sink', 10004, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dembelia - Sink' AND departamento_id = 10004
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Folosaba Dembel', 10004, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Folosaba Dembel' AND departamento_id = 10004
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Mongo', 10004, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Mongo' AND departamento_id = 10004
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Neya', 10004, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Neya' AND departamento_id = 10004
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sulima', 10004, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sulima' AND departamento_id = 10004
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dea', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dea' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Jawie', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Jawie' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kissi Kama', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kissi Kama' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kissi Teng', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kissi Teng' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kissi Tongi', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kissi Tongi' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kpeje Bongre', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kpeje Bongre' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kpeje West', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kpeje West' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Luawa', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Luawa' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Malema', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Malema' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Mandu', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Mandu' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Njaluahun', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Njaluahun' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Penguia', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Penguia' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Upper Bambara', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Upper Bambara' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Yawei', 10005, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Yawei' AND departamento_id = 10005
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bramaia', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bramaia' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbinle Dixing', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbinle Dixing' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Magbema', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Magbema' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Mambolo', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Mambolo' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Masungbala', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Masungbala' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Samu', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Samu' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tonko Limba', 10006, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tonko Limba' AND departamento_id = 10006
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Buya Romende', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Buya Romende' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dibia', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dibia' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Libeisaygahun', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Libeisaygahun' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sanda Loko', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sanda Loko' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sanda Magbolont', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sanda Magbolont' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sanda Tendaran', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sanda Tendaran' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sella Limba', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sella Limba' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tambakha', 10007, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tambakha' AND departamento_id = 10007
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dama', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dama' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dodo', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dodo' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gaura', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gaura' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gorama Mende', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gorama Mende' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kandu Leppiama', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kandu Leppiama' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kenema Town', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kenema Town' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Koya', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Koya' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Langrama', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Langrama' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Lower Bambara', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Lower Bambara' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Malegohun', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Malegohun' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Niawa', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Niawa' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Nomo', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Nomo' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Nongowa', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Nongowa' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Simbaru', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Simbaru' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Small Bo', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Small Bo' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tunkia', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tunkia' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Wandor', 10008, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Wandor' AND departamento_id = 10008
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Diang', 10009, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Diang' AND departamento_id = 10009
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kasunko', 10009, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kasunko' AND departamento_id = 10009
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Nieni', 10009, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Nieni' AND departamento_id = 10009
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sengbe', 10009, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sengbe' AND departamento_id = 10009
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Wara Wara Bafod', 10009, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Wara Wara Bafod' AND departamento_id = 10009
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Wara Wara Yagal', 10009, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Wara Wara Yagal' AND departamento_id = 10009
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Fiama', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Fiama' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbane', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbane' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbane Kandor', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbane Kandor' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbense', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbense' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gorama Kono', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gorama Kono' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kamara', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kamara' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Koidu Town', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Koidu Town' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Lei', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Lei' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Mafindor', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Mafindor' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Nimikoro', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Nimikoro' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Nimiyama', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Nimiyama' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sandor', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sandor' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Soa', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Soa' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tankoro', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tankoro' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Toli', 10010, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Toli' AND departamento_id = 10010
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bagruwa', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bagruwa' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bumpeh', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bumpeh' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Dasse', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Dasse' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Fakunya', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Fakunya' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kagboro', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kagboro' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kaiyamba', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kaiyamba' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kamajei', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kamajei' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kongbora', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kongbora' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kori', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kori' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kowa', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kowa' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Lower Banta', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Lower Banta' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Ribbi', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Ribbi' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Timdale', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Timdale' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Upper Banta', 10011, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Upper Banta' AND departamento_id = 10011
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Bureh Kasseh Ma', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Bureh Kasseh Ma' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kaffu Bullom', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kaffu Bullom' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Koya', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Koya' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Lokomasama', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Lokomasama' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Maforki', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Maforki' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Marampa', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Marampa' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Masimera', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Masimera' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'TMS', 10012, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'TMS' AND departamento_id = 10012
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Barri', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Barri' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Galliness Perri', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Galliness Perri' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kpaka', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kpaka' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Makpele', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Makpele' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Malen', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Malen' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Mono Sakrim', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Mono Sakrim' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Panga Kabonde', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Panga Kabonde' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Panga krim', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Panga krim' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Pejeh(Futa peje', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Pejeh(Futa peje' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Soro Gbema', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Soro Gbema' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sowa', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sowa' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Yakemu Kpukumu', 10013, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Yakemu Kpukumu' AND departamento_id = 10013
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Gbonkolenken', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Gbonkolenken' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kafe Simiria', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kafe Simiria' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kalansogoia', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kalansogoia' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kholifa Mabang', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kholifa Mabang' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kholifa Rowala', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kholifa Rowala' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kunike', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kunike' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Kunike Barina', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Kunike Barina' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Malal Mara', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Malal Mara' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Sambaya', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Sambaya' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tane', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tane' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Yoni', 10014, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Yoni' AND departamento_id = 10014
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Koya Rural', 10015, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Koya Rural' AND departamento_id = 10015
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Mountain Rural', 10015, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Mountain Rural' AND departamento_id = 10015
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Waterloo Rural', 10015, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Waterloo Rural' AND departamento_id = 10015
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'York Rural', 10015, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'York Rural' AND departamento_id = 10015
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Central I', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Central I' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Central II', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Central II' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'East I', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'East I' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'East II', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'East II' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'East III', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'East III' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'Tasso Island', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'Tasso Island' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'West I', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'West I' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'West II', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'West II' AND departamento_id = 10016
    )
  `.execute(db)

  await sql`
    INSERT INTO msip_municipio (nombre, departamento_id, fechacreacion, created_at, updated_at)
    SELECT 'West III', 10016, NOW(), NOW(), NOW()
    WHERE NOT EXISTS (
      SELECT 1 FROM msip_municipio
      WHERE nombre = 'West III' AND departamento_id = 10016
    )
  `.execute(db)

}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`
    DELETE FROM msip_municipio
    WHERE departamento_id IN (
      SELECT id FROM msip_departamento WHERE pais_id = 694
    )
  `.execute(db)
}
