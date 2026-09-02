import { registerHook } from '@pasosdejesus/m/plugin'
import { isGDCourse, resolveGDClusterDestination } from './lib/gd-cluster-routing'

// Hook `reward:route-destination` (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §5.4).
// Registrado por el motor `gdcluster` (Fase 3); el core solo llama
// `routeReward` (dispatcher en lib/reward-routing.ts) y no conoce GD.
// Si el curso es GD, resuelve el cluster/country fund destino y el split (10%).
registerHook('reward:route-destination', async (ctx: any) => {
  if (!isGDCourse(ctx.courseId)) return
  ctx.destino = await resolveGDClusterDestination(ctx.db, ctx.usuarioId)
  ctx.gdUsdtAmount = (ctx.usdtAmount * 10n) / 100n
  ctx.gdSlearnAmount = (ctx.slearnAmount * 10n) / 100n
  ctx.gdAddr = process.env.NEXT_PUBLIC_ADDRESS as `0x${string}` | undefined
})
