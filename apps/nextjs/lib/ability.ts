// @ts-ignore
import { AbilityBuilder, PureAbility, AbilityClass, ExtractSubjectType } from '@casl/ability'

export type Actions = 'manage' | 'create' | 'read' | 'update' | 'delete' | 'view_religion'
export type Subjects = 'User' | 'all'

export type AppAbility = PureAbility<[Actions, Subjects]>
export const AppAbility = PureAbility as AbilityClass<AppAbility>

/**
 * Define las habilidades basadas en el usuario.
 * Esta función es el ÚNICO lugar donde se definen los permisos del sistema.
 */
export function defineAbilitiesFor(user: { rol: number | null } | null | undefined) {
  const { can, rules, build } = new AbilityBuilder(AppAbility)

  // Regla: Solo el rol 1 puede ver religiones
  if (user?.rol === 1) {
    can('view_religion', 'User')
  }

  // Se pueden añadir más reglas aquí fácilmente
  // if (user?.rol === 2) { can('edit', 'Post') }

  return build({
    detectSubjectType: (item: any) => item?.constructor?.name as ExtractSubjectType<Subjects>,
  })
}
