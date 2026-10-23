import MigrationGuidePage from '@/components/migration/MigrationGuidePage'

type PageProps = { params: Promise<{ lang: string }> }

export const metadata = {
  title: 'Conserva tu cuenta verificada y agrega tu billetera de la aplicación',
  description:
    'Une la billetera de la aplicación a tu cuenta verificada de learn.tg: pide desde tu perfil, acepta con tu billetera verificada y conserva una sola cuenta con tu historial.',
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params
  return <MigrationGuidePage lang={lang} />
}
