# Implementation Plan: Spec 090 — Rúbrica multi-etiqueta + multi-modelo

**Branch**: `feature/001-scaffolding` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

## Summary

Motor de clasificación nuevo: rúbrica de preguntas factuales por categoría (parámetros), votación secuencial de N modelos diversos (1 voto c/u), % por categoría con umbral de presencia, desacuerdo → revisión humana, principal por gravedad+umbral, detalle privado "Mis reportes" con matriz y análisis por plantilla, tab "Rúbrica" de configuración, docs del pipeline al día, y validación contra el banco de 200. La Spec 089 queda intacta.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16, Prisma 5.22, Ollama local
**Storage**: PostgreSQL — 1 tabla nueva aditiva (`ClasificacionRubricaVoto`) + parámetros nuevos (seed)
**Testing**: Vitest (matriz, %, umbral, desacuerdo, principal, plantilla, privacidad, 089) + validación sobre banco 200
**Constraints**: todo parametrizable; modelos secuenciales (RAM); migraciones aditivas; 089 intacta; staging explícito.

## Diseño

### Motor (`src/lib/ai/rubrica.ts`)

1. **Carga de config** (params): `ia.rubrica.preguntas` (JSON `{categoria: [{texto, activo}]}`), `ia.rubrica.modelos` (JSON array), `ia.rubrica.temperatura`, `ia.rubrica.umbral_presencia`, `ia.rubrica.enabled`, `ia.rubrica.modelo_embudo` (default qwen2.5:14b).
2. **Embudo**: una llamada al modelo de embudo con el texto + lista de categorías → plausibles (las que tienen ALGUNA señal; denegar por defecto). Si ninguna → resultado OTRO→revisión.
3. **Votación**: para cada modelo (secuencial), UNA llamada estructurada con el texto + sets de preguntas de las categorías plausibles → `{categoria: {cumple: 0|1, preguntasCumplidas: string[]}}`. Preguntas estrictas en el prompt (1 solo con evidencia clara; ante duda 0).
4. **Agregación**: % por categoría = 1s/N. Categorías presentes = % > umbral. Principal = mayor severidad entre presentes. Ninguna presente o desacuerdo (ninguna supera) → REVISION_MANUAL. OTRO → revisión (089).
5. **Persistencia**: `ClasificacionRubricaVoto` (clasificacionIAId, modelo, categoria, cumple, preguntasJson). `ClasificacionIA` conserva `categoria` (principal), `confianza` = % de la principal, `categoriasSecundarias` = restantes presentes (formato existente), `usoCascada` = false.

### Integración pipeline

`src/app/api/reportes/procesar/helpers/clasificacion.ts`: si `ia.rubrica.enabled` → motor rúbrica; si no → `clasificarConVotos` (legacy). El resto del pipeline (PII, guardas, estados) no cambia.

### Detalle "Mis reportes"

`GET /api/reportes/mis-reportes/[id]` (o extensión del existente) — verificar ownership (usuarioId del reporte = usuario autenticado, o anónimo con su sesión interna). Devuelve matriz (votos por modelo), %, análisis por plantilla (`src/lib/ai/rubrica-analisis.ts` — determinista: "Acuerdo de 3/3 en X; 2/3 en Y"). Componente cliente privado. Nunca en superficies públicas.

### Tab Rúbrica + endpoints

- `GET /api/admin/ia/rubrica` (config completa), `PUT /api/admin/ia/rubrica/preguntas` (set por categoría), `PATCH /api/admin/ia/rubrica/preguntas/:categoria` (agregar/activar/desactivar), `PATCH /api/admin/ia/rubrica/config` (modelos, umbral, temperatura). Guard `requireModulo("ia_rubrica")` + módulo nuevo en `permisos-catalogo.ts` (hijo de `centro_control_ia`).
- Tab "Rúbrica" en `IA_TABS` (`nav-items.ts`) + `RubricaTab.tsx` siguiendo el patrón de `CasosTab.tsx`. Storage: los parámetros (no tabla nueva de preguntas — ADR_004 ya lo cubre).

### IaDocsPanel

Actualizar el flujo descrito al pipeline real post-090 (incl. deduplicación, que ya existía pero no se mencionaba).

### Validación (US4)

Script `scripts/eval-rubrica-banco.ts`: corre el motor nuevo sobre los 200 casos (vía el mismo path del pipeline, contra Ollama real) y produce la tabla comparativa con las métricas de la 085 (aciertos principal, silenciosos, subestimaciones, ESPS) vs el motor anterior (ya medido). Se corre como job en background dado el costo (200 casos × embudo + 3 modelos).

## Fases

1. Artefactos + seed (params + sets de preguntas iniciales) + migración.
2. Motor rúbrica + agregación + persistencia + tests (mocks de Ollama).
3. Integración pipeline (flag) + test de integración.
4. Detalle Mis reportes (endpoint + UI) + plantilla + tests privacidad.
5. Tab Rúbrica + endpoints + módulo permisos + tests.
6. IaDocsPanel + validación banco 200 (background) + gate + docs + commit/push.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Latencia ×3 por reporte | La cola async la absorbe; embudo reduce llamadas; secuencial cuida RAM |
| Sets de preguntas pobres | Semilla derivada de casos eval; CRUD para expertos; umbral ajustable |
| Costo de la validación 200×(1+3) llamadas | Background job; se reporta al terminar (quickstart documenta cómo re-lanzarla) |
| Romper 089 | Tests de regresión: esReporteAprobado, OTRO→revisión, 2 estados, sin nivelRiesgo |
