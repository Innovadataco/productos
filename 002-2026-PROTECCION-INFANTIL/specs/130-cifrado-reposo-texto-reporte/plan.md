# Implementation Plan: SPEC-130 — Cifrado en reposo del texto del reporte (BL-4)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/130-cifrado-reposo-texto-reporte/spec.md` (instructivo 002-PI-053)

## Summary

Cifrar `Reporte.texto` en reposo (AES-256-GCM, patrón `param-encryption.ts` — el mismo
que ya protege `textoOriginal` y la evidencia de apelaciones), descifrar solo en la capa
de datos, y cerrar el hueco de anonimización: hoy solo se anonimiza con PII detectado.
Política por estado terminal (a aprobar por ZEUS): DUPLICADO se anonimiza al cierre del
pipeline; REVISION_MANUAL/POSIBLE_SPAM/REQUIERE_ANONIMIZACION se anonimizan a la
resolución humana; CLASIFICADO/CORREGIDO conservan texto cifrado. Migración explícita,
idempotente y por lotes de los textos históricos. Clave vigente gestionada por el CEO
(BL-2); sin rotación. La clasificación NO cambia.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22

**Primary Dependencies**: las ya instaladas — `src/lib/param-encryption.ts` (AES-256-GCM,
`encryptParameter`/`decryptParameter`/`isEncryptedValue`), DAL (`src/lib/dal/`). Ninguna
dependencia nueva ni cambio de schema (los campos ya son `@db.Text`).

**Storage**: PostgreSQL 16 — `Reporte.texto` y `Reporte.textoOriginal` cifrados en reposo

**Testing**: Vitest — tests de cifrado en reposo, lectura transparente del pipeline,
política por estado y migración (idempotencia)

**Target Platform**: Next.js (dev Mac + prod VPS standalone); worker `worker-reportes.mjs`

**Project Type**: hardening de datos (seguridad) sobre flujos existentes

**Performance Goals**: cifrado/descifrado por fila es O(n) del texto (máx 2000 chars):
coste despreciable por request; la migración procesa por lotes de 500

**Constraints**: NO cambiar la lógica de clasificación; NO rotar claves (BL-2 del CEO);
la evidencia original nunca se altera en su semántica; logs/auditoría sin texto;
migración idempotente (segura de re-correr y de correr con pipeline activo)

**Scale/Scope**: capa de datos del agregado Reporte (creación, pipeline, lifecycle,
corrección, anonimización, resolución), un helper de cifrado, la política por estado y
un script de migración

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **§1.2 Solo texto**: OK — protege exactamente ese texto.
- **§1.3 Presunción de inocencia**: OK — no cambia ninguna superficie pública.
- **§6.3 Protección de datos sensibles**: ES la spec — texto cifrado en reposo, clave en
  variable de entorno, logs/auditoría sin texto completo.
- **No modificar el texto original de un reporte (evidencia)**: OK — se cifra, no se
  altera (FR-003); la migración solo envuelve en GCM, contenido idéntico al descifrar.
- **Migraciones aditivas/no destructivas**: OK — la migración de datos es aditiva
  (re-cifra en el mismo campo; nunca borra contenido), sin cambio de schema.
- **Metodología Spec-Kit**: OK — spec+plan; compuerta §4 (PARA antes de tasks/implement).

Sin violaciones que justificar.

## Project Structure

### Documentation (this feature)

```text
specs/130-cifrado-reposo-texto-reporte/
├── plan.md              # This file
├── research.md          # Phase 0 (estado real en fuente + política por estado)
├── quickstart.md        # Phase 1 (verificación cifrado + política + migración)
├── checklists/
│   └── requirements.md  # Checklist de calidad de la spec
└── tasks.md             # Phase 2 (speckit-tasks) — TRAS aprobación de ZEUS (compuerta §4)
```

### Source Code (repository root)

```text
002-2026-PROTECCION-INFANTIL/
├── src/lib/
│   ├── texto-reporte-cifrado.ts     # NUEVO: cifrar/descifrar texto de reporte
│   │                                # (envuelve param-encryption; helper único)
│   ├── dal/
│   │   ├── services/reporte-creation.ts     # escribe texto cifrado
│   │   ├── services/reporte-processing/     # lee plano vía helper; escribe cifrado
│   │   ├── services/reporte-lifecycle.ts    # purga/anonimización en baja
│   │   └── services/reporte-query.ts        # lecturas autorizadas (descifrado)
│   └── reporte-transiciones.ts      # (sin texto; solo estados)
├── src/app/api/admin/               # resolución humana (spam/revisión/anonimizar):
│                                    # aplica la regla de la política al resolver
├── scripts/
│   └── migrar-cifrado-texto-reportes.ts  # NUEVO: migración idempotente por lotes
└── prisma/                          # SIN cambios de schema
```

**Structure Decision**: UN helper (`texto-reporte-cifrado.ts`) envuelve
`param-encryption.ts` para el caso del texto del reporte (misma clave, misma utilidad —
sin segunda fuente). Los puntos de lectura/escritura viven en el DAL (SPEC-053 ya
concentró el acceso): creación, pipeline, lifecycle, query y las resoluciones admin.

## Decisiones de diseño (Phase 1)

### D1 — Un solo helper, misma clave (sin segunda fuente de verdad)
`src/lib/texto-reporte-cifrado.ts`: `cifrarTextoReporte(texto)`, `descifrarTextoReporte(texto)`,
`estaCifrado(texto)` — envuelven `param-encryption.ts` (AES-256-GCM, `PARAM_ENCRYPTION_KEY`).
La clave NO cambia ni se duplica (BL-2: gestión y respaldo del CEO; fuera de alcance la rotación).

### D2 — Escritura cifrada en TODO camino (FR-001)
- **Creación** (`ReporteCreationService.crear`): `texto` se cifra igual que `textoOriginal`
  (hoy solo se cifra el segundo). La respuesta HTTP no cambia.
- **Pipeline**: `obtenerReporte` (seguridad.ts del pipeline) devuelve el texto DESCIFRADO
  para el procesamiento (embedding, dedup, guardas, clasificación, anonimización); las
  escrituras (estado, anonimización) persisten cifrado.
- **Corrección/anonimización** (admin): leen plano por el helper y guardan cifrado
  (la util `obtenerTextoOriginalPlano` existente se mueve al helper único).
- **Reactivación** (lifecycle): regenera embedding con el plano descifrado.

### D3 — Lectura descifrada SOLO en la capa de datos (FR-002)
El patrón es "plano en memoria dentro del DAL/servicio, cifrado en BD". Las pantallas
(expediente admin, revisión del operador, detalle del padre) consumen los servicios del
DAL como hoy; ningún handler lee `reporte.texto` crudo de Prisma (ya es la norma post-053;
los pocos puntos restantes se mueven al helper). La clasificación NO cambia: recibe el
mismo plano que hoy (candado).

### D4 — Política de anonimización/purga por estado terminal (FR-004)

| Estado | ¿Necesita texto después? | Regla propuesta |
|---|---|---|
| DUPLICADO | No (cierra sin revisión) | **Anonimizar al cierre** del pipeline (misma anonimización PII; si no hay PII, purga del texto a marcador `"[contenido purgado]"` conservando `textoOriginal` cifrado como evidencia) |
| REVISION_MANUAL | Sí, el operador | Cifrado en reposo; **anonimizar/purgar A LA RESOLUCIÓN** (confirmar/corregir/dar de baja) |
| POSIBLE_SPAM | Sí, el revisor de spam | Igual: cifrado; **a la resolución** |
| REQUIERE_ANONIMIZACION | Sí, revisión | Igual: cifrado; **a la resolución** |
| CLASIFICADO / CORREGIDO | Sí (expediente, correcciones futuras) | **Conservar cifrado**; la anonimización por PII sigue aplicándose (refuerzo: garantías de cobertura del detector documentadas) |

⚠️ Punto a confirmar por ZEUS en compuerta: en DUPLICADO y en resoluciones, ¿anonimizar
(con la util PII actual) o PURGAR a marcador conservando solo `textoOriginal` cifrado?
Recomendación ODIN: purgar el campo `texto` (ya no tiene uso) y conservar `textoOriginal`
cifrado como evidencia íntegra (nunca se altera, FR-003). La purga del `texto` es lo que
cierra el hueco "no se conserva texto identificable" sin tocar la evidencia.

### D5 — Migración explícita (FR-005)
`scripts/migrar-cifrado-texto-reportes.ts`, patrón 048 (idempotente, log de conteos):
1. Lotes de 500 reportes donde `texto` NO esté cifrado (`isEncryptedValue` = false):
   `texto = cifrar(texto plano)`.
2. Donde `textoOriginal` sea NULL: `textoOriginal = cifrar(texto plano original)`
   (pre-SPEC-110). Nunca reescribe un `textoOriginal` existente (evidencia).
3. Reporta: `cifrados`, `ya_cifrados`, `original_poblado`, `total_plano_restante`
   (verificación: 0). Segunda corrida = 0 cambios.
4. Ejecución: manual por entorno (dev primero, prod después), documentada en quickstart;
   segura con pipeline activo (el campo se reescribe con el mismo contenido cifrado).

### D6 — Sin texto en logs/auditoría (FR-006)
Se mantiene la regla: la migración y el pipeline loguean conteos/ids, nunca texto (ni
plano ni cifrado completo). Se añade guarda de test: ningún log del helper imprime texto.

## Impacto en el worker (lectura/escritura)

`worker-reportes.mjs` no toca texto directamente: llama a `POST /api/reportes/procesar`,
que vive en el DAL. El descifrado/cifrado ocurre dentro del pipeline (D2/D3); el worker
no requiere cambios. El job de anonimización backfill
(`dataset-anonimizacion-backfill`) y el de embedding backfill leen texto: pasan por el
mismo helper (se descifra al leer; se re-cifra al persistir si escriben).

## Clave (BL-2)

`PARAM_ENCRYPTION_KEY` única y vigente (misma para textoOriginal, apelaciones y params).
El CEO la gestiona y respalda (BL-2). Esta spec NO rota, NO duplica, NO persiste claves.
Si la clave falta, la app truena al arrancar (fail-closed, ya vigente patrón S-1/requireEnv).

## Research resumido (Phase 0 → research.md)

Estado real en fuente (textoOriginal ya cifrado al crear; texto en claro; anonimización
solo con PII), tabla de puntos de lectura/escritura, política por estado y alternativas
(cifrar solo `texto` vs. purgar al cierre por estado) con la recomendación.

## Quickstart (validación) → [quickstart.md](quickstart.md)

Verificación guiada: creación cifrada, pipeline transparente, política por estado,
migración en dev con conteos e idempotencia, y gates.

## Contracts

N/A — no expone endpoints nuevos ni cambia contratos HTTP (el cambio es en reposo y en
la capa de datos).

## Data Model

Sin cambio de schema (los campos ya son `@db.Text`). Cambia el CONTENIDO almacenado:
`texto` y `textoOriginal` pasan a ser valores GCM (`isEncryptedValue` = true). La
migración de datos es aditiva e idempotente (D5).

## Constitution Check (post-diseño)

Re-evaluado tras Phase 1: sin cambios — ninguna violación.

## Complexity Tracking

Sin violaciones de constitución que justificar.
