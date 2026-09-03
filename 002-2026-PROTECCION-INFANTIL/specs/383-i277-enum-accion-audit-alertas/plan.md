# Plan · SPEC-383 · I-277 · enum AccionAudit + quitar los casts

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

## Decisiones

**El fix del bug y la desactivación del vector van juntos.** Si solo agrego los dos valores al enum, mañana alguien vuelve a escribir `"OTRO_VALOR_INVENTADO" as AccionAudit` y el bug renace. Si solo quito los casts sin agregar los valores, el compilador rechaza los strings actuales y el código no compila. Los dos juntos: el enum queda al día y la vía queda cerrada.

**`ADD VALUE IF NOT EXISTS`, no `CREATE OR REPLACE TYPE`.** Postgres permite añadir valores a un enum sin tocar los existentes; renombrar o borrar exige recrear el tipo y todas las columnas que lo usan — imposible acá con 275 valores. El `IF NOT EXISTS` hace la migración idempotente por si alguien la corrió a mano.

**Los 6 casts dinámicos se quedan.** `audit-logs/route.ts`, `colegio/auditoria/route.ts` y `AuditLogViewer.tsx` reciben strings de query-params o del componente, y hacen `array as AccionAudit[]` para pasarlos a Prisma. Ahí el cast es un narrowing declarado sobre valores validados; no es el mismo problema del literal inventado. Quitarlos exigiría un runtime-validator para cada query, y no es lo que rompe.

**Función muerta borrada, no marcada.** El CEO fue explícito: dejar la función con `// sin callers` es una plantilla que alguien lee mañana y toma por vigente. El patrón real está en el servicio del comité y en git. El único efecto de quitar la función es que hay menos código; el enum sigue con `COLEGIO_ALERTA_ESCALADA` disponible para un futuro caller.

**Test que faltaba, no test paraguas.** El único bug real es `asignar` → 500 por enum inválido; el único test que faltaba es el de `asignar/route.test.ts`. Se agrega ese archivo con dos tests dirigidos (asignar, desasignar). Los demás handlers ya tienen tests o cubrieron el candado en SPEC-373; no se hincha la suite sin motivo.

## Archivos

- `prisma/schema.prisma` — 2 valores agregados al enum.
- `prisma/migrations/20260903020000_i277_.../migration.sql` — migración con `ADD VALUE IF NOT EXISTS`.
- `src/lib/colegio/alertas.ts` — 4 casts fuera + función muerta eliminada + import huérfano quitado.
- `src/lib/dal/services/circulo-confianza/contactos-mutaciones.ts` — 2 casts fuera (el import de `AccionAudit` sigue: hay un uso legítimo en `const accion: AccionAudit =` línea 241).
- `src/app/api/colegio/estadisticas/pdf/route.ts` — 1 cast fuera + import huérfano quitado.
- `src/app/api/colegio/alertas/[id]/asignar/route.test.ts` — 2 tests nuevos.
