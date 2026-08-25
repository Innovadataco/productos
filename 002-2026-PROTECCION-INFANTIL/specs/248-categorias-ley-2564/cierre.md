# Cierre — SPEC-248 · Categorías Ley 2564 completas + Definiciones legales editables

**Rama**: `work/002-PI-151` · **Radicación**: 002-PI-151 · **Estado**: `PENDIENTE DE PRUEBA` (activación diferida a compuerta pre-deploy, D-51 MODO DESARROLLO)

## Resumen

Cierra la brecha del motor de clasificación IA frente a la Ley 2564 de 2026 art. 6: agrega 3 categorías dedicadas (`CIBERACOSO`, `HAPPY_SLAPPING`, `STALKING`) con rúbrica, severidad y fundamento legal, e introduce el parámetro `ia.rubrica.definiciones` con 14 definiciones legales editables por `ADMIN` desde `/admin/ia?tab=rubrica`. Sube la cobertura fuerte del motor de 2/6 a 5/6 conductas tipificadas.

## Commits

- `69843a99` — docs: spec + plan + research + data-model + quickstart + contracts + tasks
- `60bcb4b4` — implementación completa (rescate cross-contamination I-109): migración, semilla, endpoints, UI, tests, docs §9

## Evidencia local (gate técnico verde, worktree aislado)

- `npx tsc --noEmit` — 0 errores propios
- `npm run lint` — 0 errores (47 warnings preexistentes, ninguno introducido)
- `npx prisma migrate deploy` — 130 migraciones aplicadas OK (BD dev `_151` y test `_151_test` aisladas)
- Suite dirigida SPEC-248 — **25/25 verdes** en 14.53 s
  - `rubrica-semilla.test.ts` (10)
  - `route.test.ts` extendido (2 nuevos)
  - `definiciones/route.test.ts` (3)
  - `definiciones/[categoria]/route.test.ts` (5)
  - `seed-idempotencia-definiciones.test.ts` (3)

## Docs de gestión actualizados (brief §9)

- `MODELO-DE-CLASIFICACION.md` §5.1 (nuevo — definiciones editables) + §8 (13 conductas)
- `NORMATIVIDAD-VIGENTE-PROTECCION-INFANTIL.md` §1.3 (cobertura 6/6 confirmada)
- `ANALISIS-COMPARATIVO-PRODUCTO-VS-NORMATIVIDAD.md` §2 (matriz: 5/6 fuerte + 1/6 parcial) + §5 (items 3-4 cerrados)
- `ANALISIS-CUMPLIMIENTO-Y-ESTRATEGIA-COMERCIAL.md` §3 (matriz de cumplimiento actualizada) + nota metodológica

## Deuda técnica / diferido

- **FR-016 · SimulacionRun sobre dataset**: se ejecuta en la **compuerta pre-deploy** (D-51 MODO DESARROLLO: la compuerta ZEUS se movió de "antes de implementar" a "antes de producción"). Brief §7 pide "antes de activar en prod" — no antes del PR. El script `scripts/simulacion/spec-248-validacion.mjs` queda listo para dispararse desde el ambiente de deploy con el dataset `simulacion-198-casos-spec248.json` (198 casos: 12 categorías previas para no-regresión + 5 c/u de las 3 nuevas + 14 controles negativos).
- **`ui.grupos_categoria` en producción**: el parámetro ya está editado por el CEO en prod; el default nuevo con las 3 categorías (`acoso_digital`) solo aplica en instalaciones nuevas (patrón `update: {}`, D-72). El CEO decide si asigna manualmente las 3 nuevas a un grupo comercial en `/admin/configuracion` (fuera de alcance v1).
- **Sexting** sigue en cobertura parcial (compartida con `COMPARTIMIENTO_SEXUAL`/`DIFUSION_NO_CONSENTIDA`), no requiere categoría propia según brief §10.
- **v2 fuera de alcance** (brief §10): traducciones automáticas de definiciones, firma digital, historial de versiones UI.

## Notas de rescate (I-109)

El trabajo original se contaminó por compartir el clon principal con otra sesión (Kimi/SPEC-240). Rescate realizado en worktree dedicado (`productos-002-PI-151`, regla D-82 nueva); las decisiones §D1-§D3 del `plan.md` sobrevivieron intactas al rescate y quedaron aprobadas por ZEUS. `.env` y `.env.test` del worktree apuntan a BDs aisladas `_151` / `_151_test` (no van al commit).

## Referencias

- Instructivo: `01-PROYECTOS/001-2026-PROTECCION_INFANTIL/03-EJECUCION/02-RADICACIONES/INSTRUCTIVO-002-PI-151-CATEGORIAS-LEY-2564.md`
- Brief: `01-PROYECTOS/001-2026-PROTECCION_INFANTIL/05-ENTREGABLES/BRIEF-F-COL-4-CATEGORIAS-LEY-2564.md`
- Precedente 1:1: SPEC-195 (motor SPAM) + SPEC-199 (parche motor SPAM)
