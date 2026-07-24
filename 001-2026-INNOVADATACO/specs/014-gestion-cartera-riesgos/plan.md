# Implementation Plan: Espacio de gestión — cartera, detalle y Riesgos

**Branch**: `feature/001-scaffolding` (dir: `014-gestion-cartera-riesgos`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/014-gestion-cartera-riesgos/spec.md` (Aprobada D-073). `/speckit-analyze`
sustituye la compuerta del plan (D-060).

## Summary

Sacar la gestión PM2 del modal a un submódulo "Gestión" con vista de cartera y detalle, y
añadir la colección **Riesgos**. **Reutiliza** todo lo de SPEC-008; no lo reescribe. Una
migración aditiva (una tabla), cero dependencias.

## Decisión: reutilizar por composición, no por reescritura (RZ-2)

`GestionPm2({ proyectoId })` ya es un componente autónomo; hoy se renderiza dentro de
`ProjectForm`. Sacarlo del modal es **moverlo de contenedor**, no tocarlo: el submódulo de
detalle lo renderiza directamente, con sitio. Riesgos entra como una pestaña más de
`GestionPm2`, sobre `PanelColeccion` genérico. Si esta spec reescribiera `GestionPm2` o
`PanelColeccion`, habría fallado su propia RZ-2.

## Decisión: endpoint propio para la cartera

`GET /api/projects` devuelve el arreglo plano que consumen el tablero de fases y la página de
proyectos. Cargarlo de agregados (partidas, entregables, conteo de riesgos por proyecto)
penalizaría a esos dos consumidores. Por eso la cartera va en `GET /api/projects/cartera`
(segmento estático, gana al `[id]` dinámico en Next.js), que calcula los agregados al leer.

**Alternativa descartada**: campos agregados persistidos en `Proyecto`. Se desincronizarían con
cada cambio de un entregable o un riesgo; el agregado es un cálculo, no un dato (mismo criterio
que la indexabilidad de la spec 013).

## Decisión: el avance agregado es un promedio simple

El modelo `Entregable` no tiene peso. "Ponderado por entregable" se implementa como cada
entregable pesando igual = media del `avance`. Es la única lectura posible sin inventar un
campo, y se documenta en la función pura. Pesos reales serían otra spec.

## Technical Context

**Dependencias nuevas**: ninguna · **Migración**: 1 tabla aditiva (`riesgos_proyecto`)
**Testing**: función pura de agregados y ruta de riesgos con test; suite ≥ 525.
**Constraints**: `verifyAuth`+`apiError`+`auditLog` en la ruta; cero `any` en `src/lib` y API.

## Constitution Check — **PASS**

| Principio | Evaluación |
|---|---|
| §0.1 Spec-driven | ✅ Spec aprobada (D-073); `/speckit-analyze` antes de implementar. |
| §0.2 Pruebas | ✅ Agregados (puro) y ruta de riesgos con test propio. |
| §0.3 Tipado | ✅ Cero `any`; validación de riesgo pura y tipada. |
| §0.5 Aislamiento | ✅ Solo `001-`. Sin trabajo pesado. |
| §2.5 Auditoría | ✅ La mutación de riesgos audita. |
| §3.2 Rutas | ✅ `riesgos` y `riesgos/[itemId]` siguen la convención; la prueba de superficie las cubre. |

## Cambios exactos

| Archivo | Qué |
|---|---|
| `prisma/schema.prisma` + migración | Modelo `RiesgoProyecto`, CASCADE, `@@map` |
| `src/lib/riesgo.ts` (+test) | `validarRiesgo` / `datosRiesgo` (patrón de `entregable.ts`) |
| `src/lib/cartera.ts` (+test) | `calcularAgregados`: presupuesto total, avance medio, riesgos abiertos, fase |
| `src/app/api/projects/[id]/riesgos/route.ts` (+`[itemId]`) + test | CRUD, patrón de las otras colecciones |
| `src/app/api/projects/cartera/route.ts` + test | Proyectos + agregados |
| `src/lib/proyectoPm2.ts` | Añadir `ESTADOS_RIESGO`, `PROBABILIDADES`, `IMPACTOS` (constantes) |
| `src/components/proyectos/GestionPm2.tsx` | Riesgos como 6ª pestaña, sobre `PanelColeccion` |
| `src/components/proyectos/CarteraProyectos.tsx` (nuevo) | Cartera + navegación a detalle |
| `src/components/modules/ProyectosTab.tsx` | Enrutar `gestion` |
| `src/context/WorkspaceContext.tsx` | Submódulo `gestion` |
| `src/components/ProjectForm.tsx` | **Retirar** `GestionPm2` del modal (FR-007) |

## Verificación por requisito

| FR | Cómo |
|---|---|
| FR-001 | Submódulo visible junto a Fases |
| FR-002 / FR-006 | `calcularAgregados` con test; cartera en el contenedor |
| FR-003 | Detalle con `GestionPm2` reutilizado + Riesgos |
| FR-004 | Ruta `riesgos` con test (401/404/400/crear/aislamiento) |
| FR-005 | Test: `cerrado` no cuenta; `abierto`/`mitigado` sí |
| FR-007 | `git grep GestionPm2` en `ProjectForm` = 0 |
| SC-001 | Ensayo en BD desechable, conteo antes/después |

## Riesgos

- **R-01 · La migración toca datos vivos.** Aditiva y ensayada en desechable con conteo
  (D-039). Es una tabla nueva, sin alterar `proyectos`.
- **R-02 · Colisión de ruta `cartera` vs `[id]`.** En Next.js el segmento estático gana al
  dinámico; `/api/projects/cartera` resuelve a la ruta estática. Se verifica con su test.
- **R-03 · Retirar la gestión del modal rompe la edición.** El modal queda como edición básica
  (código/nombre/cliente/fase), que es lo que era antes de SPEC-008; la gestión se mueve, no se
  pierde.
