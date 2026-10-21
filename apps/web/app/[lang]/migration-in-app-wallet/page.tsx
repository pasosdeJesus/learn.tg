import MigrationGuidePage from '@/components/migration/MigrationGuidePage'

type PageProps = { params: Promise<{ lang: string }> }

export const metadata = {
  title: 'Move your wallet into learn.tg',
  description:
    'Import your recovery phrase and keep the same address, history, scholarships and referrals.',
}

export default async function Page({ params }: PageProps) {
  const { lang } = await params
  return <MigrationGuidePage lang={lang} />
}
