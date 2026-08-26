// Dispatcher de enrutamiento de recompensas (REQ/35 §5.4).
//
// El core NO conoce GD: delega en el hook `reward:route-destination`, que
// registran los motores (gdcluster en Fase 3; temporalmente desde
// `m-extensions/gdcluster.ts`). Si ningún hook resuelve el curso, la
// recompensa va al vault por defecto (LearnTGVaults).
import { runHooks } from '@pasosdejesus/m/plugin'

export interface RewardRouteCtx {
  db: any
  usuarioId: number
  courseId: number
  usdtAmount: bigint
  slearnAmount: bigint
  destino?: string
  gdUsdtAmount?: bigint
  gdSlearnAmount?: bigint
  gdAddr?: `0x${string}`
}

export async function routeReward(ctx: RewardRouteCtx): Promise<void> {
  await runHooks('reward:route-destination', ctx)
}
