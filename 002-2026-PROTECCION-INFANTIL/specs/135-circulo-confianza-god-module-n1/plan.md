# Implementation Plan: SPEC-135 — circulo-confianza: partir el god-module + matar el N+1 (E-2)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-01 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/135-circulo-confianza-god-module-n1/spec.md` (002-PI-056, E-2)

## Summary

Partir `circulo-confianza.ts` (864 L, 17 exports, 5 responsabilidades) en una carpeta
con un módulo por responsabilidad + barrel que preserva la API pública (consumidores
intactos), y eliminar el N+1 de `listarContactos` (2 queries por contacto → 1 query de
reportes para todos los valores + agrupación en memoria). Revisar los otros dos loops
(`notificarCambio…`, `obtenerVistaAgregada`) por N+1 reales.

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22
**Primary Dependencies**: Prisma 5.22; patrón DAL SPEC-053 (`tx?: Prisma.TransactionClient`). Nada nuevo.
**Storage**: PostgreSQL 16 — sin cambios de schema
**Testing**: Vitest — test existente del módulo (423 L) como red + test nuevo anti-N+1
**Target Platform**: Next.js standalone
**Project Type**: refactor estructural + optimización de queries (comportamiento preservado)
**Performance Goals**: `listarContactos` ≤ 3 queries constantes (hoy 2 + 2N)
**Constraints**: FR-005/FR-006 — cero cambios de comportamiento ni de consumidores;
defecto real → PARAR y reportar
**Scale/Scope**: 1 archivo → carpeta de ~6 módulos; 1-2 queries eliminadas por listado

## Constitution Check

- **No debilitar tests**: OK — el test existente conserva sus afirmaciones (solo se
  reorganiza si la estructura de archivos lo exige).
- **Migraciones aditivas**: N/A — sin schema.
- **Metodología Spec-Kit**: OK — compuerta §4.

Sin violaciones que justificar.

## Project Structure

### Source Code (repository root)

```text
src/lib/dal/services/circulo-confianza/
├── index.ts            # barrel: reexporta TODA la API pública actual (funciones + tipos)
├── tipos.ts            # EstadoContacto, IdentificadorInput, DatosReporte, helpers puros
├── estado.ts           # calcularEstado, whereReportesCirculo, determinarEstadoContacto,
│                       #   contarContactosActivos, obtenerTopeContactos, obtenerUmbralAgregacion
├── contactos.ts        # listarContactos (SIN N+1), agregarContacto, actualizarContacto,
│                       #   obtenerDetalleContacto, validarPlataformas, normalizarIdentificadores
├── agregado.ts         # obtenerVistaAgregada, construirAgregado
├── preferencias.ts     # toggleNotificacionesCirculo, obtenerPreferenciasCirculo
└── notificaciones.ts   # notificarCambioCirculoSiCorresponde (revisión N+1: FR-004)

src/lib/dal/services/circulo-confianza.test.ts   # red existente (mismas afirmaciones)
src/lib/dal/services/circulo-confianza-n1.test.ts # NUEVO: conteo de queries de listarContactos
```

El archivo viejo `circulo-confianza.ts` se elimina; TS resuelve el barrel en la misma
ruta de import.

## Data Model

N/A — no cambia schema ni entidades; es reorganización de código + menos queries.

## Contracts

N/A — no cambia ningún endpoint ni la API pública del módulo (el barrel la reexporta).

## Diseño del fix N+1 (listarContactos)

Hoy: `findMany` contactos+identificadores (1 query) → por contacto:
`identificadorContacto.findMany` + `reporte.findMany` (2N queries).

Nuevo: la query inicial YA trae los identificadores por contacto → recolectar todos
los valores en un `Map<valor, contactoIds[]>` → UNA `reporte.findMany({ identificador:
{ in: valores } })` con el mismo select → agrupar por valor en memoria →
`calcularEstado(reportesDelContacto)` por contacto. Total: 2 queries.

Mismo resultado por construcción: `determinarEstadoContacto` filtra por valor y
`calcularEstado` solo depende del subconjunto de reportes del contacto.

## Fases de implementación (resumen para tasks)

1. **Partir**: crear la carpeta con los módulos (movimiento mecánico, lógica intacta) +
   barrel; borrar el archivo viejo; suite del módulo verde.
2. **N+1**: reescribir `listarContactos` (2 queries) + test anti-N+1 con contador de
   queries; revisar `notificarCambio…` y `obtenerVistaAgregada` (FR-004).
3. **Gates + cierre**: suite completa, tsc, lint, build, arch:check, cierre documental.
