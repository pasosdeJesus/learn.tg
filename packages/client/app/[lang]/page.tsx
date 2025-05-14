"use client"

export default async function Home({params} : {
  params: Promise<{
    lang:string,
  }>
}) {
  const { lang } = await params

  return (
    <div>
      Lang: {lang}
    </div>
  )
}
