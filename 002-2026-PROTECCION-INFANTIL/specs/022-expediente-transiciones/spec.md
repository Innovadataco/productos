# Spec 022 — Expediente interno de transiciones

> Estado: **EN DISEÑO**.
> Plan: [`plan.md`](plan.md).

## Alcance

Crear una tabla dedicada `TransicionReporte` que registre todas las transiciones de estado de un reporte, quién/qué las originó y por qué. Sirve como expediente cronológico, trazabilidad y evidencia. Las specs 023-026 registrarán sus transiciones aquí.

## Decisiones

- **NO extender `AuditLog`**: `AuditLog` es transversal a muchos recursos y no está optimizada para reconstruir la historia completa de un reporte. `TransicionReporte` es especializada.
- Cada fila representa una transición: `estadoAnterior` → `estadoNuevo`.
- El campo `responsable` indica el actor: `IA`, `WORKER`, `OPERADOR:<id>`, `COMITE:<id>`, `ADMIN:<id>`, `SISTEMA`.
- Se registra `motivo` opcional (por ejemplo, "fallo en clasificación", "escalamiento", "decisión del operador").
- Se registra fecha/hora automáticamente.

## Requisitos

1. Modelo `TransicionReporte` con campos:
   - `reporteId` (relación con `Reporte`)
   - `estadoAnterior` (`EstadoReporte`)
   - `estadoNuevo` (`EstadoReporte`)
   - `responsable` (string etiquetado)
   - `motivo` (string opcional)
   - `metadatos` (JSON opcional: latencia, modelo, intento, etc.)
   - `creadoEn` (DateTime)
2. Helper `registrarTransicion()` que usen worker, endpoints de operador/comité y jobs automáticos.
3. Endpoint `/api/admin/reportes/[id]/transiciones` para obtener el timeline de un reporte (admin/operador/comité según permisos).
4. UI de timeline dentro del detalle del caso en el panel de operación.

## Riesgos mitigados

- Pérdida de contexto: sin expediente, no se sabe por qué un reporte cambió de estado.
- Sobrecarga de `AuditLog`: se mantiene `AuditLog` para eventos de seguridad y se usa `TransicionReporte` para la vida del reporte.

## R7

No aplica: no toca el pipeline de clasificación; solo agrega trazabilidad.
