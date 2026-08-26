import { registerHook } from '@pasosdejesus/m/plugin'
import { isGDCourse, resolveGDClusterDestination } from '@/lib/gd-cluster-routing'

// Hook `reward:route-destination` (REQ/35 §5.4).
// Temporalmente registrado desde el core; pasa al motor `gdcluster` en Fase 3.
// Si el curso es GD, resuelve el cluster/country fund destino y el split (10%).
registerHook('reward:route-destination', async (ctx: any) => {
  if (!isGDCourse(ctx.courseId)) return
  ctx.destino = await resolveGDClusterDestination(ctx.db, ctx.usuarioId)
  ctx.gdUsdtAmount = (ctx.usdtAmount * 10n) / 100n
  ctx.gdSlearnAmount = (ctx.slearnAmount * 10n) / 100n
  ctx.gdAddr = process.env.NEXT_PUBLIC_ADDRESS as `0x${string}` | undefined
})
