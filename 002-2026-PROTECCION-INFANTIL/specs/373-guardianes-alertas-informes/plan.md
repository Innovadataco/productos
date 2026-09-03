# Plan · SPEC-373 · guardianes alertas + informes

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

## Decisiones

**Un solo SPEC para las dos direcciones.** I-251 (quitar) e I-266 (agregar) son la misma clase de problema — un guard mal alineado con la regla del producto —, uno por defecto y otro por exceso. Cerrarlos juntos hace que el mensaje del commit y el PR sean legibles: *cada handler alineado con SU regla*.

**El middleware manda, el handler no lo contradice.** `guardias.ts:202-206` exime la familia `/api/colegio/alertas`; el handler no puede ponerle un guard propio que devuelva 403 cuando el middleware ya deja pasar. La misma lógica que usó SPEC-356 en `/api/reportes`: quitar el guard, no ablandarlo.

**En informes hacemos lo opuesto.** El middleware no exime `casos/[id]/informes` (no está en la familia); el guard extra estaba faltando. Se agrega usando el mismo helper (`verificarVigenciaColegio`) que ya usan `alertas/[id]/asignar` y `alertas/[id]/escalar` — la orden del CEO era explícita: no inventar un helper nuevo.

**Bloquear SOLO la emisión.** El sello (SPEC-234) es una promesa hacia el futuro: quien firma pretende que un tercero pueda verificarlo mañana. Emitirlo desde un colegio vencido rompe esa promesa. Pero **leer** los informes ya emitidos y **verificar** un `/verificar/<código>` público no dependen de la vigencia — son consumos por terceros. La lectura y el endpoint público no cambian.

**Un archivo de test dedicado.** En vez de esparcir tests por los 6 archivos de alertas, uso `vigencia.spec-373.test.ts` con los 7 handlers en un lugar. La regla queda documentada en un sitio, no fragmentada por verbo.

**Candado 26 explícito.** Antes de quitar un guard hay que probar que otro guard sigue. El test *"sin módulo → 403"* le saca el permiso al rol vía `permisoModulo` y afirma el 403 — la puerta cierra por módulo, no por vigencia.

**Bug preexistente de `asignarAlerta` no se arregla acá.** Descubrí que `logAudit` con `accion: "COLEGIO_ALERTA_ASIGNADA"` truena porque el enum `AccionAudit` no lo tiene. Ese fix cambia el schema Prisma (migration) — fuera del alcance de I-251/I-266. Reportado al CEO para radicado aparte. Mi test hace assert de `status !== 403` para asignar; el 200 exacto llega cuando ese enum se arregla.

## Archivos

- `src/app/api/colegio/casos/[id]/informes/route.ts` — I-266: import + guard nuevo en POST.
- `src/app/api/colegio/casos/[id]/informes/route.test.ts` — 2 tests nuevos.
- `src/app/api/colegio/alertas/route.ts` — I-251: quitar import + 2 bloques (GET, POST).
- `src/app/api/colegio/alertas/[id]/route.ts` — I-251: quitar import + 1 bloque.
- `src/app/api/colegio/alertas/[id]/asignar/route.ts` — idem.
- `src/app/api/colegio/alertas/[id]/escalar/route.ts` — idem.
- `src/app/api/colegio/alertas/[id]/estado/route.ts` — idem.
- `src/app/api/colegio/alertas/[id]/notas/route.ts` — idem.
- `src/app/api/colegio/alertas/vigencia.spec-373.test.ts` — 8 tests nuevos (7 handlers + candado 26).
