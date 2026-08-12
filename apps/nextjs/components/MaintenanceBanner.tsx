'use client'

/**
 * Maintenance banner shown during vault migrations.
 * Controlled by NEXT_PUBLIC_LEARNTG_VAULTS_READONLY env var.
 * Renders nothing when not in readonly mode.
 */
export function MaintenanceBanner() {
  if (process.env.NEXT_PUBLIC_LEARNTG_VAULTS_READONLY !== '1') return null

  return (
    <div className="bg-amber-500 text-white text-center text-sm py-2 px-4 font-medium">
      ⚠️ Scholarships are temporarily paused for maintenance. Please try again in a few minutes.
    </div>
  )
}
