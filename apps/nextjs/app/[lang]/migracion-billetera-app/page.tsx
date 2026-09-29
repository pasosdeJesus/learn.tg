import MigrationGuidePage from '@/components/migration/MigrationGuidePage'

type PageProps = { params: Promise<{ lang: string }> }

export const metadata = {
  title: 'Pasa tu billetera a learn.tg',
  description:
    'Importa tu frase de recuperación y conserva la misma dirección, tu historial, tus becas y tus referidos.',
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params
  return <MigrationGuidePage lang={lang} />
}
