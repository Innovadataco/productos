# Plan · SPEC-372 · asignar huérfanos + edad servidor

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 (docs+test UI en follow-up sobre el trabajo de la primera sesión)

## Decisiones

**Se reusa `reconciliarHuerfanos`, no se reimplementa.** Cron y botón
disparan la misma función; la ruta es una capa fina de auth + rate-limit +
audit del disparo. Así no hay dos comportamientos que puedan divergir.

**Se sigue el patrón de `reasignar`.** `verifyAuth("ADMIN")` +
`assertModulo("operadores")` + `checkRateLimit("admin_write")` +
`errorToResponse`. Mismo estilo que el resto de `admin/operadores/*`: un
admin que ya sabe usar reasignar no aprende un patrón nuevo.

**Doble audit intencional.** La función interna audita el RESULTADO agregado
cuando hay asignados (sin usuarioId — es el trabajo del sistema). El endpoint
manual audita el DISPARO con `usuarioId: admin.id` y `tipoRecurso:
"Operador"` y `disparo: "manual"`. El objetivo es distinto en cada fila:
"qué pasó" vs "quién lo pidió".

**P4: helper puro, no `refine` de Zod.** Se prefirió una función
`validarAnioNacimientoMenor` en `documento-menor.ts` que se llama después del
`safeParse` — igual que `validarDocumentoMenor`. Ventaja: se comparte entre
POST y PATCH sin duplicar el schema, el mensaje sale del propio helper, y la
ventana 5-17 se calcula con `getFullYear()` al momento de la validación (se
mueve sola con el año). El schema sigue con `min(1900).max(2100)` como
guardarraíl anti-basura amplio.

**P4 se aplica en POST y PATCH.** Ese fue el motivo por el que #266 ganó
sobre la primera versión: sin la validación en PATCH el hueco quedaba
abierto por edición.

**Docs Spec Kit en follow-up.** #266 no las trajo. La disciplina de la casa
exige `specs/NNN/{spec,plan,tasks}.md` + fila en `specs/README.md` +
`docs/architecture/02-roles-capacidades.md` al día. Este follow-up las
agrega y pone la fila 372 en la lista.

## Archivos

- `src/app/api/admin/operadores/reconciliar-huerfanos/route.ts` — endpoint
  nuevo (POST), en `work/pi-SPEC-372-A74-P3-P4` (PR #266).
- `src/app/api/admin/operadores/reconciliar-huerfanos/route.test.ts` — 4
  tests (idem).
- `src/app/api/padre/hijos/route.ts` + `[id]/route.ts` — validador aplicado.
- `src/app/api/padre/hijos/route.test.ts` + `[id]/route.test.ts` — tests
  nuevos.
- `src/app/dashboard/admin/operadores/asignar/page.tsx` — botón + aviso.
- `src/lib/padre/documento-menor.ts` + `.test.ts` — helper
  `validarAnioNacimientoMenor` + tests.
- **Follow-up (esta rama)**: `specs/372-asignar-huerfanos-edad-servidor/*`,
  `specs/README.md`, `docs/architecture/02-roles-capacidades.md`,
  `src/app/dashboard/admin/operadores/asignar/page.test.tsx` + registro en
  `vitest.unit.includes.ts`.
