// Hook `reward:route-destination` (https://gitlab.com/pasosdeJesus/m/-/work_items/35 §5.4): registrado por el motor
// `gdcluster` (Fase 3) en el proceso server vía `lib/gdcluster-app.ts`
// (`import '@learn-tg/gdcluster/src/register'`), que es donde `routeReward`
// lo ejecuta. El cargador de `m-extensions/` (CLI de m) no puede importar TS
// del paquete del motor (sin dist/ hasta Fase 4), por eso este archivo queda
// vacío: la carga CLI no registraba el hook de todos modos (proceso distinto).
