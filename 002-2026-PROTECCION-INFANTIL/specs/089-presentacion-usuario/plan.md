# Implementation Plan: Spec 089 — Presentación al usuario

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-23 | **Spec**: [spec.md](./spec.md)

## Summary

Alinear la capa de presentación con la constitución: 2 estados visibles, OTRO siempre a revisión, ganador por gravedad, predicado único `esReporteAprobado` para todo conteo, consulta pública sin `nivelRiesgo`/score (señal descriptiva), categorías multi-conducta ordenadas por gravedad, divulgación progresiva, y bugs UI menores. Sin cambios de schema.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16, Prisma 5.22
**Storage**: PostgreSQL — sin migraciones de schema (solo seed de parámetros nuevos)
**Testing**: Vitest — cada regla con test dedicado
**Constraints**: parámetros para severidad/umbrales; predicado único; nada de score/etiquetas sobre personas en la superficie pública; staging explícito del 002.

## Diseño por US

### US1 — Estados (estético)
`src/lib/reporte-estados-usuario.ts`: "Verificado" → "Procesado" (label + tests). Sin cambio de lógica.

### US2 — Clasificador
- `src/lib/ai/classifier.ts`: (a) tras el cálculo de estado, si `categoriaFinal === "OTRO"` → `estado = "REVISION_MANUAL"` (incl. cascada que confirma OTRO). (b) ranking ordena por `severidad(categoria)` desc → `count` desc → `confPromedio` desc, usando `obtenerSeveridades()` (params). `categoriasSecundarias` quedan también ordenadas por gravedad.
- Config del clasificador ya carga parámetros; la severidad se resuelve con el mismo patrón (`scoring.severity.*`).

### US3 — Predicado único
`src/lib/reporte-aprobado.ts` (nuevo):
```ts
export const CATEGORIAS_NO_APROBADAS = ["SPAM", "OTRO"];
export function esReporteAprobado(r: { estado: string; eliminado: boolean }, categoria?: string | null): boolean
export function whereReporteAprobado(): Prisma.ReporteWhereInput  // estado in [...] AND eliminado false AND clasificacion.categoria notIn [...]
```
Aplicar en: `src/app/api/consulta/route.ts` (query de reportes), `src/lib/scoring.ts` (query de `calcularScore`), `src/app/api/estadisticas-publicas/route.ts` (dashboard).

### US4 — Categorías
- Consulta: lista `categorias: [{categoria, total}]` excluyendo SPAM/OTRO, incluyendo secundarias de `ClasificacionIA.categoriasSecundarias`, ordenada por gravedad (params).
- Seguimiento (`SeguimientoClient`): muestra todas las conductas del reporte (principal + secundarias, por gravedad); si solo SPAM/OTRO → "No se identifica riesgo".

### US5/US6 — Consulta pública (route + frontend)
- Route: aplicar predicado; quitar `nivelRiesgo` (y no exponer score); añadir `actividad: "baja"|"alta"` vía parámetro `visibility.actividad_alta_min` (default 5, seed); `categorias` multi-gravedad; `ubicaciones` con rollup país (anónimo) y depto/ciudad (autenticado, detectado por token opcional); cuadre `total = autenticados + anonimos`.
- Frontend (`ConsultaPublicaClient`/`ConsultaEnriquecidaClient`): fix "(undefined)" (lee `total`), formato compacto "N unidad (nombres)", señal descriptiva, mostrar detalle siempre, divulgación progresiva (anónimo resumen / autenticado completo).

### US7 — Seguimiento
Mostrar conductas propias sin ocultar; mensaje "gracias por reportar"; ganchos de valor (alertas, círculo) ya existentes — solo copy.

### US8 — Bugs UI
- `AdminNav`: active = match más largo (`pathname === href` gana sobre `startsWith` de la raíz).
- `ComiteSubNav`: estabilizar layout (reservar ancho/altura consistente entre tabs; causa probable: contenido variable hace saltar el contenedor — fijar clases del nav para que no cambie el layout al filtrar tabs).

## Fases

1. Artefactos + US1 + US2 (classifier) + tests.
2. US3 (predicado + 3 consumidores) + tests.
3. US4/US5/US6 (consulta route + frontend) + tests.
4. US7/US8 + gate + validación en vivo + docs + commit/push.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Cambiar el ganador altera resultados del pipeline | La confianza de la categoría grave suele < umbral → va a revisión humana (seguro); tests dedicados |
| Predicado cambia conteos públicos existentes | Es el objetivo (cierre del hueco); documentar antes/después en cierre |
| Auth opcional en consulta | Token opcional sin bloquear anónimos (patrón ya usado en layouts) |
