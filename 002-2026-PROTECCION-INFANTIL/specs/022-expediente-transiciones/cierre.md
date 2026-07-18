> # Cierre — Spec 022: Expediente interno de transiciones
>
> ## Resumen
>
> Se implementó la tabla `TransicionReporte` como expediente cronológico append-only de los cambios de estado de un reporte. Se agregó el enum `ResponsableTransicion`, el helper `registrarTransicion()` y el endpoint `GET /api/admin/reportes/[id]/transiciones`. Se integró el registro de transiciones en los flujos principales de cambio de estado (worker, confirmación, corrección, anonimización y baja).
>
> ## Archivos tocados
>
> - `prisma/schema.prisma`: nuevo enum `ResponsableTransicion`, modelo `TransicionReporte`, relaciones en `Reporte` y `Usuario`.
> - `prisma/migrations/20260718000000_add_transicion_reporte/migration.sql`: migración manual aplicada con `prisma migrate deploy` (evitando `db push`).
> - `src/lib/reporte-transiciones.ts`: helper `registrarTransicion()` y `responsableTipoFromRol()`.
> - `src/lib/test-utils.ts`: `resetDatabase` ahora limpia `TransicionReporte`.
> - `src/app/api/admin/reportes/[id]/transiciones/route.ts`: endpoint de timeline con filtro opcional `responsableTipo`.
> - `src/app/api/reportes/procesar/route.ts`: transiciones PENDIENTE→PROCESANDO, PROCESANDO→estado final, duplicados y errores, atómicas vía transacción.
> - `src/app/api/admin/reportes-revision/[id]/confirmar/route.ts`: transición REVISION_MANUAL→CLASIFICADO.
> - `src/app/api/admin/correcciones/route.ts`: transición REVISION_MANUAL→CORREGIDO.
> - `src/app/api/admin/reportes/[id]/anonimizar/route.ts`: transición REQUIERE_ANONIMIZACION→CLASIFICADO.
> - `src/lib/reporte-lifecycle.ts`: transición al dar de baja (mismo estado, documenta el cambio de flag `eliminado`).
> - `src/lib/reporte-transiciones.test.ts`: tests unitarios del helper.
> - `src/app/api/admin/reportes/[id]/transiciones/route.test.ts`: tests del endpoint.
>
> ## Migración ejecutada
>
> - `npx prisma migrate deploy` aplicó `20260718000000_add_transicion_reporte` en la base de desarrollo (`proteccion_infantil`) y en la base de test (`proteccion_infantil_test`).
> - `npx prisma generate` generó el cliente Prisma actualizado.
> - No se usó `prisma db push`.
>
> ## Resultados de tests
>
> - `npm run lint`: ✅ 0 errores (1 warning preexistente en `src/lib/sms.ts` no relacionado).
> - `npx tsc --noEmit`: ✅ sin errores.
> - `npm run build`: ✅ build exitoso.
> - `npm run test`: ✅ 56 archivos, 273 tests pasaron.
> - `npm run smoke-e2e`: no existe en este proyecto.
>
> ## Decisiones pendientes de revisión
>
> 1. **Rol `COMITE_VALIDACION`**: la spec de endpoint requiere auth para `ADMIN`, `OPERADOR` y `COMITE_VALIDACION`. El enum `RolUsuario` actual no incluye `COMITE_VALIDACION`; el endpoint acepta `ADMIN` y `OPERADOR`. Cuando se agregue el rol de comité, debe actualizarse `src/app/api/admin/reportes/[id]/transiciones/route.ts` y la función `responsableTipoFromRol()`.
> 2. **Transición de baja con estado igual**: para dar de baja se registró una transición con `estadoAnterior === estadoNuevo` porque el flag `eliminado` cambia pero el estado no. Se mantiene la invariante append-only.
> 3. **UI de timeline**: se implementó solo el endpoint; no se agregó una sección de UI en el detalle de caso porque no había un componente listo. Esto puede hacerse en una tarea posterior con poco esfuerzo consumiendo el endpoint.
>
> ## Hash del commit
>
> - `85398cc1f5c34892a94951835c1616cfe4c4a588`
