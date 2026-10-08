// R-#283: the pastor landing moved to /{lang}/pastor. This old GD path redirects
// there (only the GD course itself keeps using the /gdcluster course path).
import { redirect } from 'next/navigation'

type PageProps = { params: Promise<{ lang: string }> }

export default async function Page({ params }: PageProps) {
  const { lang } = await params
  redirect(`/${lang}/pastor`)
}
