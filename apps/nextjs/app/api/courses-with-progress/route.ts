import { newKyselyPostgresql } from '@/.config/kysely.config.ts';
import { NextResponse } from 'next/server';
import { sql } from 'kysely';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lang = searchParams.get('lang') || 'es';
  const walletAddress = searchParams.get('walletAddress');

  if (!walletAddress) {
    return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 });
  }

  try {
    const db = newKyselyPostgresql();

    const user = await db
      .selectFrom('billetera_usuario')
      .innerJoin('usuario', 'usuario.id', 'billetera_usuario.usuario_id')
      .where('billetera_usuario.billetera', '=', walletAddress)
      .select('usuario.id as userId')
      .executeTakeFirst();

    if (!user) {
      const courses = await db
        .selectFrom('cor1440_gen_proyectofinanciero')
        .where('idioma', '=', lang)
        .where('conBilletera', '=', true)
        .selectAll()
        .execute();

      const coursesWithZeroProgress = courses.map(course => ({
        ...course,
        percentageCompleted: 0,
        percentagePaid: 0,
      }));
      return NextResponse.json(coursesWithZeroProgress);
    }

    const coursesWithProgress = await db
      .selectFrom('cor1440_gen_proyectofinanciero as p')
      .leftJoin('cor1440_gen_actividadpf as a', 'a.proyectofinanciero_id', 'p.id')
      .leftJoin('guide_usuario as gu', (join) =>
        join.onRef('a.id', '=', 'gu.actividadpf_id')
            .on('gu.usuario_id', '=', user.userId)
      )
      .where('p.idioma', '=', lang)
      .where('p.conBilletera', '=', true)
      .groupBy([
        'p.id',
        'p.titulo',
        'p.subtitulo',
        'p.idioma',
        'p.prefijoRuta',
        'p.imagen',
        'p.resumenMd',
        'p.creditosMd'
      ])
      .select([
        'p.id',
        'p.titulo',
        'p.subtitulo',
        'p.idioma',
        'p.prefijoRuta',
        'p.imagen',
        'p.resumenMd',
        'p.creditosMd',
        sql<number>`
          COALESCE(
            (SUM(CASE WHEN gu.points > 0 THEN 1 ELSE 0 END) * 100.0) /
            NULLIF(COUNT(a.id), 0),
            0
          )
        `.as('percentageCompleted'),
        sql<number>`
          COALESCE(
            (SUM(CASE WHEN gu.amountpaid > 0 THEN 1 ELSE 0 END) * 100.0) /
            NULLIF(COUNT(a.id), 0),
            0
          )
        `.as('percentagePaid')
      ])
      .execute();

    return NextResponse.json(coursesWithProgress);

  } catch (error) {
    console.error('Error fetching courses with progress:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return NextResponse.json({ error: 'Failed to fetch data: ' + errorMessage }, { status: 500 });
  }
}
