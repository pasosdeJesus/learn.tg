import MigrationGuidePage from '@/components/migration/MigrationGuidePage'

type PageProps = { params: Promise<{ lang: string }> }

export const metadata = {
  title: 'Keep your verified account and add your in-app wallet',
  description:
    'Join the in-app wallet to your verified learn.tg account: request it from your profile, accept with your verified wallet, and keep one account with your history.',
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params
  return <MigrationGuidePage lang={lang} />
}
