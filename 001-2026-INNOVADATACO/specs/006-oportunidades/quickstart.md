# Quickstart — Verificación de Oportunidades

Verificación de la spec 006, **sin turno** (no hay inferencia). Todo desde
`001-2026-INNOVADATACO/`. **El stack del CEO no se baja**; la migración se **ensaya en BD
desechable** antes de la viva (D-039, RZ-4).

## 0. Baseline

```bash
npx vitest run                       # 249 en 36 archivos
npx tsc --noEmit                     # limpio
# datos vivos a preservar (SC-003):
#   count(*) de licitaciones, LicitacionStatus, EntidadLicitacion
```

## 1. Migración — ENSAYO en BD desechable (SC-003, cero pérdida)

```bash
# En una BD desechable con una copia del esquema+datos, no la del CEO:
#   1. contar filas antes
#   2. aplicar migration.sql
#   3. contar filas después → DEBEN COINCIDIR
#   4. verificar que toda licitación existente quedó con tipoId = licitación pública
#      y conserva su numero/fechaApertura
```

Objetivo: `count(*)` de `licitaciones`, `LicitacionStatus`, `EntidadLicitacion` **igual antes
y después**; ninguna oportunidad sin `tipoId`; ningún `numero`/`fechaApertura` perdido.

## 2. Catálogo de tipos (US2)

```bash
npx vitest run src/app/api/licitaciones/tipos
npm run seed                         # idempotente: 3 tipos, 2ª pasada no duplica
```

Objetivo: `GET /api/licitaciones/tipos` devuelve ≥ 3 tipos; `POST` crea uno nuevo con sus
banderas `exigeNumero`/`exigeFechaApertura`; 401 sin sesión; contrato `apiError`.

## 3. Validación por tipo + enriquecimiento (US1, US3)

```bash
npx vitest run src/app/api/licitaciones/route.test.ts src/app/api/licitaciones/[id]
```

Objetivos:
- SC-001: crear una oportunidad de tipo **sin exigencias** (contratación directa) **sin**
  `numero`/`fechaApertura` → 201.
- SC-002: crear una **licitación pública** sin `numero` o sin `fechaApertura` → 400 legible.
- La exigencia se lee de las **banderas del tipo**, no de un `if` por nombre (revisión de
  código + prueba con un tipo configurado a mano).
- SC-005/SC-006: cronograma (5 hitos), ≥ 2 partidas y ciudad persisten; el total = suma de
  partidas.

## 4. Expediente — SIN RAG (US4)

```bash
npx vitest run src/app/api/licitaciones/[id]/documentos
```

Objetivos:
- SC-007: subir PDF y Excel → asociados y listados; tipo no permitido → 400; excede tamaño →
  413.
- **SC-008**: `expect(prisma.documentoChunk.create).not.toHaveBeenCalled()` — el expediente
  **no** vectoriza.
- SC-009: borrar la oportunidad elimina sus documentos (CASCADE).

## 5. Interfaz (US5)

Objetivos:
- SC-010: el submódulo de listado **no** tiene botón de crear; "Nueva" sí crea.
- SC-011: `grep -ri "licitaci" src/components/modules/LicitacionesTab.tsx src/components/licitaciones`
  en **textos visibles** → 0 (el identificador técnico interno puede quedar).

## 6. Gates y aplicación a la viva

```bash
npx vitest run                       # >= 249 verdes, sin BD ni Ollama
npx tsc --noEmit                     # limpio
npx eslint src/lib src/app/api       # 0 no-explicit-any
git diff --cached --name-only        # solo rutas de 001-2026-INNOVADATACO/
```

Solo tras el ensayo verde (paso 1) y con la suite verde:

```bash
npx prisma migrate deploy            # aplica a la BD viva, sin bajar el stack (down -v PROHIBIDO)
npm run seed                         # siembra los 3 tipos en la viva (idempotente)
# reconstruir imagen + recrear app/worker como en SPEC-004, acotando la interrupción
```

Verificar en la viva que `count(*)` de los catálogos no cambió (SC-003) y que la app
responde (HTTP 200).
