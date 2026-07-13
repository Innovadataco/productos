# Implementation Plan: Módulo de Reportes Comunitarios

**Branch**: `02-reportes-comunitarios` | **Date**: 2026-07-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/02-reportes-comunitarios/spec.md`

---

## Summary

Módulo de creación y clasificación automática de reportes comunitarios de protección infantil. Usuarios anónimos y autenticados reportan identificadores (números, nicks) de riesgo. Cada reporte se clasifica mediante modelo de IA local (Ollama), se detectan duplicados (autenticados por email+identificador, anónimos por similitud de embeddings), y un administrador puede corregir clasificaciones (acumulando dataset de entrenamiento). La visibilidad pública de un identificador requiere umbral de reportes independientes + mínimo 50% de reportes autenticados.

---

## Technical Context

| Aspecto | Valor |
|---------|-------|
| **Language/Version** | TypeScript 5.8.3, Node.js >=22 |
| **Primary Dependencies** | Next.js 16.2.10 (App Router), Prisma 5.22.0, jose, bcryptjs, pg-boss, Ollama (local) |
| **Storage** | PostgreSQL 15+ con extensión pgvector (para embeddings de similitud de texto) |
| **Testing** | Vitest 3.2.3 + jsdom + @testing-library/react |
| **Target Platform** | Servidor Linux, navegadores modernos |
| **Project Type** | Web application (Next.js App Router, API Routes) |
| **Performance Goals** | Clasificación IA < 30 segundos por reporte (SC-002) |
| **Constraints** | Textos sensibles nunca salen del servidor (constitución §2.1); IA local únicamente (Ollama) |
| **Scale/Scope** | Reportes ilimitados por colegio/periodo (modelo SaaS); cola de procesamiento asíncrona |

**Decisiones técnicas del PO**:

| Decisión | Elección | Justificación |
|----------|----------|---------------|
| Modelo de clasificación | `ornith:9b` vía Ollama local | Rápido, cumple SC-002 (<30s), deja memoria libre en servidor de 36GB |
| Configuración del modelo | Patrón ModuleSetting/Parametrización (fase 1) | `settingKey` "classification_model" para el módulo de reportes, default "ornith:9b" en seed |
| Similitud de texto (duplicados anónimos) | Embeddings `nomic-embed-text` vía Ollama + pgvector | Patrón probado en proyecto 001 |
| Cola de procesamiento | pg-boss + worker supervisado por pm2 | Lecciones del 001: logging explícito de llamadas a Ollama con latencia, detección de cola estancada, sin fallbacks silenciosos de secretos |

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Estado | Justificación |
|-----------|--------|---------------|
| **Stack heredado** (§2.1) | ✅ | Next.js App Router, Prisma 5.22.0, JWT manual (`jose`), pg-boss, Ollama, Vitest |
| **Sin PostgREST/GraphQL/tRPC** (§2.1) | ✅ | API Routes de Next.js exclusivamente |
| **Sin NextAuth.js** (§2.1) | ✅ | JWT manual + cookie `httpOnly` (heredado de fase 1) |
| **Sin Bull/RabbitMQ** (§2.1) | ✅ | pg-boss sobre PostgreSQL |
| **IA local únicamente** (§2.1) | ✅ | Ollama local; textos nunca salen del servidor |
| **Strict TypeScript** (§3.1) | ✅ | `tsconfig.json` tiene `"strict": true`; sin `any`, sin `@ts-ignore` |
| **Tipado Prisma** (§3.2) | ✅ | Filtros `where` con `Prisma.ReporteWhereInput` |
| **Multi-tenant** (§2.3) | ✅ | `tenantId` en entidades de negocio (colegios aislados) |
| **SaaS** (§2.4) | ✅ | Tablas `Plan`, `Subscription`, `Tenant`, `BillingCycle` vacías inicialmente |
| **No fotos/videos/audio** (constitución) | ✅ | Solo texto (FR-003) |
| **Lenguaje descriptivo sin culpabilidad** (constitución) | ✅ | FR-012: estadístico/descriptivo, nunca juicios de valor |
| **Canales oficiales de denuncia** (constitución) | ✅ | FR-004: Línea 141 ICBF, CAI Virtual, Te Protejo |

**Violaciones**: Ninguna.

---

## Project Structure

### Documentation (this feature)

```text
specs/02-reportes-comunitarios/
├── spec.md              # Especificación funcional (/speckit-specify)
├── plan.md              # Este archivo (/speckit-plan)
├── research.md          # Phase 0: decisiones técnicas resueltas
├── data-model.md        # Phase 1: entidades, campos, relaciones
├── quickstart.md        # Phase 1: guía de validación end-to-end
├── contracts/           # Phase 1: contratos de API
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── api/
│   │   ├── reportes/              # POST crear reporte (anónimo/autenticado)
│   │   ├── reportes/[id]/         # GET detalle de reporte (admin)
│   │   ├── admin/
│   │   │   └── reportes/          # GET listado paginado + PATCH corregir clasificación
│   │   └── reportes/
│   │       └── procesar/          # POST webhook para worker pg-boss
│   ├── reportar/                  # Página de creación de reporte
│   └── dashboard/
│       └── reportes/              # Panel admin de reportes
├── lib/
│   ├── ai/                        # Clasificación IA, embeddings, similitud
│   │   ├── classifier.ts          # Llama a Ollama (ornith:9b)
│   │   ├── embedder.ts            # Genera embeddings (nomic-embed-text)
│   │   └── similarity.ts          # Compara embeddings con pgvector
│   ├── queue.ts                   # Cliente pg-boss (publicar jobs)
│   └── duplicate-detector.ts      # Lógica de deduplicación autenticada + anónima
├── prisma/
│   └── schema.prisma              # Entidades: Reporte, IdentificadorReportado, etc.
└── scripts/
    └── worker-reportes.mjs        # Worker pg-boss supervisado por pm2
```

**Structure Decision**: Single project Next.js App Router. La cola de procesamiento usa pg-boss con un worker Node.js separado (scripts/worker-reportes.mjs) supervisado por pm2. No se requiere backend separado.

---

## Complexity Tracking

> No violations. Sin justificaciones adicionales necesarias.

---

## Phase 0: Research

### NEEDS CLARIFICATION → Resueltas

| # | Tema | Decisión | Rationale |
|---|------|----------|-----------|
| R1 | Modelo de clasificación IA | `ornith:9b` vía Ollama local | PO decidió: rápido, <30s, memoria libre en servidor 36GB |
| R2 | Configuración del modelo | Patrón ModuleSetting/Parametrización (fase 1) | PO decidió: `classification_model` con default "ornith:9b" en seed |
| R3 | Similitud de texto (duplicados anónimos) | Embeddings `nomic-embed-text` + pgvector | PO decidió: patrón probado en proyecto 001 |
| R4 | Cola de procesamiento | pg-boss + worker pm2 | PO decidió: lecciones del 001 (logging, latencia, cola estancada) |
| R5 | Embeddings en PostgreSQL | Extensión pgvector | Necesario para búsqueda por similitud de vectores |

### Decisions Log

- **D1: pgvector obligatorio en PostgreSQL**: La extensión `pgvector` debe estar instalada en la instancia de PostgreSQL (incluir en docker-compose.yml y documentar en README).
- **D2: Worker separado para pg-boss**: El procesamiento de IA no bloquea el servidor web. El worker es un script Node.js independiente (`scripts/worker-reportes.mjs`) supervisado por pm2.
- **D3: Logging de llamadas a Ollama**: Cada llamada a Ollama registra: modelo usado, prompt tokens, response tokens, latencia total, éxito/fracaso. Sin logging = fallo silencioso inaceptable (lección del 001).
- **D4: Detección de cola estancada**: El worker monitorea la edad del job más antiguo. Si supera 5 minutos, alerta (console.error + métrica).
- **D5: Parámetro `visibility.min_authenticated_ratio`**: Nuevo parámetro de sistema (fase 1) con default 0.5, gestionable desde el panel de configuración del admin.
- **D6: Detección de PII integrada en clasificación**: El prompt a `ornith:9b` solicita además de categoría y confianza: `contiene_pii` (boolean) y `pii_detectada` (lista de fragmentos). Una sola llamada, sin latencia extra.
- **D7: Campo `textoOriginal` restringido**: Solo accesible por admin. Nunca expuesto en APIs públicas ni alimenta el dataset de entrenamiento.

**Regla dura**: Un reporte en estado `REQUIERE_ANONIMIZACION` **NUNCA** cuenta para el umbral de visibilidad pública ni aparece en ninguna consulta hasta ser anonimizado.

---

## Phase 1: Design

### data-model.md

Ver `specs/02-reportes-comunitarios/data-model.md` para el modelo de datos completo.

**Resumen de entidades**:

| Entidad | Propósito | Clave |
|---------|-----------|-------|
| `Reporte` | Denuncia individual | `id`, `identificador`, `plataforma`, `texto`, `textoOriginal`, `fechaIncidente`, `ciudad`, `pais`, `estado`, `usuarioId` (nullable) |
| `IdentificadorReportado` | Agregación por identificador | `id`, `identificador`, `plataforma`, `totalReportes`, `reportesAutenticados`, `esVisiblePublicamente` |
| `ClasificacionIA` | Resultado del análisis automático | `id`, `reporteId`, `categoria`, `confianza`, `contienePii`, `piiDetectada`, `modeloUsado`, `latenciaMs` |
| `CorreccionAdmin` | Corrección manual de clasificación | `id`, `clasificacionId`, `categoriaOriginal`, `categoriaCorregida`, `adminId`, `motivo` |
| `DatasetEntrenamiento` | Par para reentrenamiento | `id`, `texto`, `clasificacionCorrecta`, `fuente` (corrección/manual) |
| `EmbeddingReporte` | Vector del texto para similitud | `id`, `reporteId`, `vector` (pgvector), `modeloUsado` |

**Nuevos enums**:

- `CategoriaConducta`: CONTACTO_INSISTENTE, SOLICITUD_MATERIAL, OFRECIMIENTO_REGALOS, SUPLANTACION_IDENTIDAD, SOLICITUD_ENCUENTRO, COMPARTIMIENTO_SEXUAL, OTRO
- `EstadoReporte`: PENDIENTE, PROCESANDO, CLASIFICADO, REVISION_MANUAL, POSIBLE_SPAM, DUPLICADO, REQUIERE_ANONIMIZACION

### contracts/

Ver `specs/02-reportes-comunitarios/contracts/` para los contratos de API.

**Endpoints definidos**:

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/reportes` | Opcional (anónimo/autenticado) | Crear reporte |
| GET | `/api/admin/reportes` | ADMIN | Listado paginado con filtros |
| PATCH | `/api/admin/reportes/[id]/clasificacion` | ADMIN | Corregir clasificación |
| POST | `/api/reportes/procesar` | Interno (worker) | Webhook para pg-boss |
| PATCH | `/api/admin/reportes/[id]/anonimizar` | ADMIN | Eliminar PII, guardar texto original en auditoría |

### quickstart.md

Ver `specs/02-reportes-comunitarios/quickstart.md` para la guía de validación end-to-end.

**Escenarios de validación**:

1. Crear reporte anónimo → verificar estado PENDIENTE
2. Ejecutar worker → verificar clasificación automática
3. Crear reporte duplicado (autenticado) → verificar detección
4. Corregir clasificación como admin → verificar dataset de entrenamiento
5. Anonimizar reporte con PII → verificar estado REQUIERE_ANONIMIZACION → CLASIFICADO
6. Consultar identificador con reportes mixtos → verificar visibilidad condicional