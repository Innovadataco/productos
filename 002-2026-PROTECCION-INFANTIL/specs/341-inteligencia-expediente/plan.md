# Implementation Plan: SPEC-341 · La inteligencia del expediente (análisis IA en fila)

**Branch**: `work/pi-SPEC-341-inteligencia-expediente` | **Date**: 2026-09-01 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/341-inteligencia-expediente/spec.md`

## Summary

Un análisis interpretativo de la cadena del expediente generado por LLM local
(Ollama, cliente existente `src/lib/ai/ollama-client.ts`), disparado
exclusivamente al abrir el expediente cuando la cadena cambió (hash de
`(ultimoEventoEn, numEventos, categoriasDominantesJson)` no coincide) o
cuando el padre pulsa "Actualizar" después del cool-down. Corre en fila
de a uno vía **pg-boss** (cola `padre.analisis.expediente`, prioridad
estrictamente MENOR que la de clasificación) con advisory-lock propio en el
worker `scripts/worker-analisis-expediente.mjs`. Se persiste en un modelo
nuevo `AnalisisExpediente` inmutable con `versionSecuencial`, `corteN`,
`hashCadena` y `alcance` (`PADRE_COMPLETO` | `COLEGIO_BLINDADO`). El
orquestador es reutilizable — el módulo colegio C3 monta encima cambiando
solo `alcance`, sin código nuevo de motor. La UI vive bajo el mapa del
`ExpedienteVivo` (SPEC-340): componente `ExpedienteGenerando` con
posición-en-fila REAL + estimado + capa 1 "En vivo" + análisis previo
marcado "N hechos nuevos después".

## Technical Context

**Language/Version**: TypeScript 5.x (strict) sobre Node.js 20 LTS, según
`AGENTS.md` del repo y `constitution.md §2.1` (stack heredado 001).

**Primary Dependencies**:
- **Prisma 5.22** — nuevo modelo `AnalisisExpediente` + migración.
- **pg-boss** — cola nueva `padre.analisis.expediente` sobre wrapper
  `src/lib/queue.ts` (patrón ya establecido: `sendReporte`, `colegio-aviso`).
- **Ollama client existente** — `src/lib/ai/ollama-client.ts`
  (`llamarOllamaStructured<T>`) con timeout ya parametrizado
  (`ia.ollama.timeout_ms`).
- **Vitest** — integración por cada punto de entrada; unit para el hash y
  para el orquestador con ambos `alcance`.
- **Next.js 16 App Router** — nuevas rutas `GET/POST /api/padre/expedientes/[id]/analisis`.

**Storage**: PostgreSQL 16 (Prisma). Nueva tabla `AnalisisExpediente` con
índices `(expedienteId, versionSecuencial DESC)` y `(expedienteId, hashCadena, estado)`.
Advisory-lock nuevo — registrar en `scripts/ADVISORY-LOCKS.md` (siguiente
número libre).

**Testing**: `pnpm test` (Vitest, con Postgres real vía `.env.test`).
Recorridos E2E de Calidad (no aquí — quedan a su plan). Contract tests: (a)
del hash (determinista sobre las 3 columnas exactas), (b) del orquestador con
`alcance` distinto (payload observable via test de "grep de identificadores").

**Target Platform**: Web (dashboard padre), servida por el mismo Next.js
del producto; worker separado en la Mac de producción.

**Project Type**: web (Next.js) + worker Node.js.

**Performance Goals**:
- Apertura con análisis vigente y hash coincidente: < 1 s (SC-001).
- Publicación de un análisis nuevo con cola vacía: < 2 × `tiempo_estimado_seg`
  en el 80 %+ de los casos (SC-003).
- Cero jobs de análisis pasan por delante de clasificación de reporte (SC-008).

**Constraints (R16)**: la Mac única de producción NO puede correr análisis en
paralelo con clasificación pesada. `max_concurrentes` por defecto = 1. Sin
barrido nocturno. Sin regeneración por evento.

**Scale/Scope**: Docena de expedientes activos por padre; centenares de padres
totales. Análisis raro (mayoría de aperturas caen en el camino barato de
"hash coincide → reuso").

## Constitution Check

*Verificación contra `.specify/memory/constitution.md`:*

- **§1.3 (presunción de inocencia en el lenguaje)**: el análisis DEBE
  describir patrones, no acusar. Se enforca vía FR-011 (etiqueta "análisis
  asistido"), FR-014 (rechazo de frases pre-horneadas del parámetro
  `padre.analisis.frases_prohibidas_json`) y prompt sistema sembrado.
  **PASA.**
- **§1.4 (umbral parametrizable)**: TODOS los tiempos y topes están en
  `ParametroSistema` seedeados (cool-down, TTL, max_concurrentes, tope_fila,
  tiempo_estimado, prioridad, modelo, prompt, frases prohibidas). **PASA.**
- **§1.5 (clasificación, no scoring de personas)**: el análisis no calcula
  score ni compara personas — describe patrones de la cadena. **PASA.**
- **§2.1 (stack heredado)**: reusa Next/Prisma/pg-boss/Ollama existentes, no
  agrega ninguna dependencia externa nueva. **PASA.**
- **§3.1 (TypeScript strict)**: se aplica igual que en el resto del código;
  ratchets `Q-3` (no prisma directo fuera del DAL) y `SPEC-197` (worker sin
  alias `@/lib`) se cumplen — el worker importa desde rutas relativas.
- **§4.4 (pg-boss para procesamiento asíncrono)**: el flujo del análisis
  sigue el patrón canónico (API encola → worker consume → publica registro).
  **PASA.**

Sin violaciones → sin tabla de Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/341-inteligencia-expediente/
├── plan.md                     # este archivo
├── research.md                 # Fase 0
├── data-model.md               # Fase 1
├── quickstart.md               # Fase 1
├── contracts/                  # Fase 1
│   ├── analisis-endpoint.md    # GET/POST /api/padre/expedientes/[id]/analisis
│   └── queue-job-schema.md     # payload de pg-boss
├── checklists/
│   └── requirements.md         # ya creado por /speckit-specify
└── tasks.md                    # generado por /speckit-tasks
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── prisma/
│   ├── schema.prisma                          # + modelo AnalisisExpediente + enum AlcanceAnalisis + enum EstadoAnalisis
│   ├── migrations/
│   │   └── <timestamp>_analisis_expediente/   # nueva migración
│   └── seed.ts                                # + parámetros padre.analisis.* + colegio.analisis.*
├── src/
│   ├── lib/
│   │   ├── expediente/
│   │   │   ├── analisis/
│   │   │   │   ├── hash-cadena.ts             # NUEVO: hash determinista sobre las 3 columnas
│   │   │   │   ├── armar-payload.ts           # NUEVO: orquestador reutilizable con `alcance`
│   │   │   │   ├── prompt.ts                  # NUEVO: resuelve prompt del ParametroSistema
│   │   │   │   ├── validar-salida.ts          # NUEVO: check anti-frases-pre-horneadas
│   │   │   │   └── ejecutar-analisis.ts       # NUEVO: entrada del worker (arma + llama Ollama + persiste)
│   │   │   └── (existentes, no se tocan)
│   │   └── dal/services/
│   │       └── analisis-expediente.ts         # NUEVO: leer último vigente + encolar apertura
│   ├── app/api/padre/expedientes/[id]/
│   │   └── analisis/
│   │       ├── route.ts                       # NUEVO: GET (leer vigente + hash actual) + POST (actualizar)
│   │       └── route.test.ts                  # NUEVO
│   ├── components/modules/padre/
│   │   ├── AnalisisExpediente.tsx             # NUEVO: sección "Análisis detallado" bajo el mapa
│   │   ├── ExpedienteGenerando.tsx            # NUEVO: banner honesto con posición + estimado
│   │   └── ExpedienteVivo.tsx                 # + monta AnalisisExpediente bajo el mapa
│   └── lib/queue.ts                           # + `sendAnalisisExpediente()` + prioridad + tope de fila
├── scripts/
│   ├── worker-analisis-expediente.mjs         # NUEVO: worker de la cola
│   └── ADVISORY-LOCKS.md                      # + nueva línea con el número reservado
└── tests/
    ├── integration/
    │   └── analisis-expediente/               # NUEVO: tests del orquestador con ambos alcances
    └── (existentes)
```

**Structure Decision**: el módulo del análisis vive todo bajo
`src/lib/expediente/analisis/` (patrón espejo de `src/lib/expediente/compilacion/`
que ya existe) para que la reusabilidad por `alcance` esté encapsulada en un
solo lugar. La UI cuelga bajo el `ExpedienteVivo` que dejó SPEC-340 (o su
antecesor `ExpedienteDetalleClient` si SPEC-340 aún no está en `main` al
implementar).

## Fases

### Phase 0 — Research (research.md)

Preguntas de investigación abiertas por el spec:

1. **Cliente Ollama estructurado**: verificar en `src/lib/ai/ollama-client.ts`
   cómo maneja `llamarOllamaStructured<T>` timeout, retries y errores. Definir
   si el análisis necesita reintentos (probablemente NO — un fallo cae al
   flujo de "último análisis + aviso").
2. **Advisory-lock**: qué número libre queda. Leer `scripts/ADVISORY-LOCKS.md`
   y reservar el siguiente.
3. **Prioridad de pg-boss**: cómo se lee `queue.clasificacion.prioridad`
   actualmente en `src/lib/queue.ts` para setear `padre.analisis.prioridad`
   estrictamente menor.
4. **Sello de fecha en la UI**: cómo formatear con zona `America/Bogota` de
   forma consistente con lo que ya usa `ExpedienteVivo` (SPEC-340).
5. **SPEC-340 status**: verificar en `main` si `Reporte.reportePrincipalId`
   y `ExpedienteVivo` están mergeados al momento del `/speckit-tasks`. Si no,
   documentar la ruta de reintegración.
6. **Cliente polling / SSE**: elegir mecanismo para que el UI "vivo" refresque
   el estado del job. Preferencia: polling ligero al `GET /api/…/analisis`
   cada 15 s durante estado GENERANDO — evita infra nueva de SSE.

**Salida**: `research.md` con Decision/Rationale/Alternatives por cada punto.

### Phase 1 — Design & Contracts

#### 1.1 `data-model.md`

Documentar:

- **`AnalisisExpediente`** — campos completos (ver Key Entities de spec),
  índices, constraint de unicidad `@@unique([expedienteId, versionSecuencial])`,
  reglas de invariancia (una fila `PUBLICADO` vigente por expediente + histórico).
- **`EstadoAnalisis`** (enum): `GENERANDO | PUBLICADO | FALLIDO`.
- **`AlcanceAnalisis`** (enum): `PADRE_COMPLETO | COLEGIO_BLINDADO`.
- Relación con `Expediente` (FK obligatoria, `onDelete: Cascade` — si se
  borra el expediente por Ley 1581, los análisis se van con él).
- Diagrama simple: `Expediente 1:N AnalisisExpediente`.

#### 1.2 Contratos

- **`contracts/analisis-endpoint.md`** — describir `GET` y `POST /api/padre/expedientes/[id]/analisis`:
  - `GET`: sesión PARENT dueña → devuelve `{ vigente, hashActual, estado, cola: {posicion, estimadoSeg}, hechosNuevosDesde }`.
  - `POST` (Actualizar): honra cool-down y respuesta "ya está al día".
- **`contracts/queue-job-schema.md`** — payload del job y campo `priority`.

#### 1.3 `quickstart.md`

Recorrido manual de validación:

1. Login como padre, abrir un expediente sin análisis previo → aparece banner
   con posición en fila.
2. Correr el worker en local, esperar publicación → sección aparece con sello
   y sección "Qué puedes hacer ahora".
3. Agregar un evento → el hash cambia → reabrir muestra "N hechos nuevos".
4. Pulsar "Actualizar" antes del cool-down → botón deshabilitado.
5. Después del cool-down y con hash nuevo → nuevo job → publicación.
6. Test unitario del orquestador con `alcance=COLEGIO_BLINDADO` → payload
   sin identificadores.

## Complexity Tracking

Sin violaciones — sección vacía.
