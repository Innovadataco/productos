# SPEC-482 · Barrido residual del colegio al Sistema de Diseño (Lote-2, Olas A+B)

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: Lote-2 del rediseño (residual del territorio colegio), radicado por CEO tras la cert visual. Autoridad de forma: **Diseño** (certifica; post-merge). En paralelo con el barrido de admin (Dev 01).

## Para qué

Tras SPEC-462 (color/firma del colegio) quedaban crudos residuales en el territorio colegio. Este barrido los migra a token, mecánico:
- **emerald → pino** (el acento del colegio).
- **slate/gray → neutros**: texto `text-muted`/`text-subtle`/`text-body` por jerarquía; borde/relleno/divisor `border-tinta/N`, `bg-tinta/N`, `divide-tinta/N` (no existen `--linea/--velo/--surface` como token literal; se usan las utilities reales, igual que Tabla/EmptyState/admin).
- **amber → ambar** (Ola B, resultó mecánica): caja/trazo/fondo `bg-ambar/N` · `border-ambar/N`; **todo texto** `text-amber-*` → **`text-estado-ambar`** (el `--ambar-ink`, AA). No apareció ningún `<Alerta tono="advertencia">` con override crudo en el territorio (nada que quitar).

Todos los `dark:` de esos crudos se sueltan: el token invierte solo.

## Alcance (11 archivos, orden del CEO: Estadisticas + Cursos primero)

`app/dashboard/colegio/`: estadisticas/ColegioEstadisticasPageClient · cursos/CursosPageClient · materias/MateriasPageClient · onboarding/page · profesores/ProfesoresPageClient.
`components/modules/colegio/`: estadisticas/SeccionComparativa · estadisticas/TablaDesgloseCursos · curso/SeccionMateriasCurso · CargaProfesoresExcel · comite/CasoDetalle · comite/IdentificadoresIntegranteClient.

**EXCLUIDO**: `src/lib/colegio/pdf-informe-mensual.tsx` (Diseño lo revisa aparte; además vive fuera de las raíces UI del barrido y no tenía crudos del patrón).

Conducta intacta: no cambia lógica, rutas ni datos; solo piel de color.

## Candado

`src/lib/rediseno/colegio-sin-crudo.candado.test.ts` (fuente, sin BD): barre `app/dashboard/colegio` + `components/modules/colegio` (excluye `pdf-informe-mensual` y tests) y exige **0** crudo `emerald/slate/gray/amber`. **Verificado por mutación**: reintroducir un crudo en cualquier archivo de colegio → rojo con el archivo señalado.

## Impacto en arquitectura: no

Migración de color a token. No toca `tokens-check.ts` (baja crudos, SPEC-466 `<=`; piso ya en 841 por el `--tension` del CEO). Sin schema, sin API, sin runtime.

## Certificación (la da Diseño)

Contra prod, post-merge, junto con el barrido de admin. Verde en CI no cierra un rediseño.

## Referencias
- SPEC-462 (colegio color/firma) · SPEC-464 (barrido admin, mismo patrón) · SPEC-469 (Tabla, neutros tinta) · tokens `.text-estado-pino`/`.text-estado-ambar` en globals.css.
