# Spec 017 — Módulo de documentación navegable

> **Status**: PLANEADO (antes "EN DISEÑO", normalizado por spec 087-US1) — índice propuesto en [`plan.md`](plan.md). Se espera aprobación del esqueleto antes de generar contenido o UI.
> Fecha: 2026-07-18.

## Objetivo

Crear un módulo dentro de la aplicación que permita navegar la documentación de la plataforma de lo humano a lo técnico, con acceso controlado por rol. El contenido se deriva de la materia prima que ya existe en el repo (`specs/*/spec.md`, `specs/*/reporte-cierre.md`, `docs/*`, `README`, `IMPLEMENTATION-REPORT.md` y el propio código), sin inventar información.

## Audiencias

1. **Aliados / comunicación / prensa** — necesitan entender qué es la plataforma y por qué existe sin ver datos sensibles ni detalles técnicos.
2. **Administradores y operadores** — necesitan saber cómo operar cada módulo del panel.
3. **Equipo de desarrollo / DevOps / auditoría** — necesitan entender la arquitectura, modelos, migraciones, tests y procedimientos de despliegue.

## Alcance

- Un índice maestro de 3 capas con fuente de cada tema.
- Un lector/document viewer interno que renderice archivos Markdown existentes.
- Control de acceso por capa.
- Enlaces contextuales desde el panel admin ("¿Qué es esto?" / "Ver documentación").

## Fuera de alcance (no se hará ahora)

- Edición de documentos desde la UI.
- Conversión automática de TODO el Markdown a páginas estáticas.
- Generación de nuevo contenido que no exista ya en el repo.
- Traducciones automáticas.

## Control de acceso propuesto

| Capa | Contenido | Acceso |
|---|---|---|
| Capa 1 — Qué y por qué | Motivación, marco, catálogo de funcionalidades | Semi-público (visible sin login, sin PII) |
| Capa 2 — Cómo funciona | Flujo de reporte, guía de operación del panel | Solo usuarios autenticados (`PARENT`, `OPERADOR`, `ADMIN`, etc.) |
| Capa 3 — Por dentro | Arquitectura, IA, migraciones, tests, despliegue | Solo `ADMIN` / `SCHOOL_ADMIN` y equipo técnico |

La decisión final de qué ver cada rol queda documentada en [`plan.md`](plan.md) por tema.

## Fuentes oficiales de contenido

- `specs/README.md` — índice maestro de specs.
- `specs/*/spec.md` — alcance original de cada funcionalidad.
- `specs/*/reporte-cierre.md` — evidencia de implementación y decisiones.
- `docs/deuda-tecnica.md` — deuda técnica clasificada.
- `docs/despliegue.md` y `docs/despliegue-v2-checklist.md` — procedimientos de despliegue.
- `docs/runbook.md` — procedimientos operativos.
- `docs/configuracion/parametros-sistema.md` — referencia de parámetros.
- `IMPLEMENTATION-REPORT.md` — reporte global de implementación.
- `README.md` del proyecto — introducción general.
- Código fuente (`src/app/api`, `src/components/modules`, `prisma/schema.prisma`) — como fuente técnica de última instancia.

## Entregables

1. [`plan.md`](plan.md) — índice completo de 3 capas con fuentes.
2. UI de lectura reutilizando componentes existentes.
3. Endpoint `/api/docs/indice` (futuro) que devuelva el índice en JSON.
4. Rutas de lectura:
   - `/docs` — Capa 1 pública.
   - `/docs/operar` — Capa 2 autenticada.
   - `/docs/tecnico` — Capa 3 solo admin.

## Convención de mantenimiento

- Cuando se cierre una spec, se actualiza el índice para apuntar a su `reporte-cierre.md`.
- Cuando cambie un parámetro de sistema, se verifica que `docs/configuracion/parametros-sistema.md` siga alineado.
- La documentación se escribe en Markdown en `docs/` y `specs/`; la UI solo la muestra.
