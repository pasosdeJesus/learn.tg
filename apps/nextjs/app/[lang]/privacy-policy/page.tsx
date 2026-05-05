'use client'

export default function Page() {
  return (
    <div className="bg-gradient-to-br from-white via-gray-50 to-gray-100 py-12 px-6">
      <h1>Privacy Policy</h1>
      <ul>
        <li>
          We will not sell neither share the personal information you provide.
        </li>
        <li>
          Your wallet address, your login name, your blockchain
          transactions and your actions in the platform are considered public.
          The rest of the information in your profile is private and we
          will not present it to the public.
        </li>
        <li>
          To remove your personal information as presented by this app, please
          go to the profile page and fill the fields with non-personal
          information (any sequence of letters or numbers will work)
        </li>
        <li>
          We cannot remove from our internal records neither from logs your
          onchain transaction neither your personal information
        </li>
      </ul>
    </div>
  )
}
