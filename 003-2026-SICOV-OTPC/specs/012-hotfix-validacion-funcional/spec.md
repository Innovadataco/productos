# Feature Specification: 012 — Hotfix de validación funcional (I-13, I-14, botón de login)

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-23

**Status**: FINALIZADO — implementado, probado (64/64) y verificado en navegador (ventana privada)

**Input**: Encargo 003-SICOV-001 bloque 2 (ZEUS). Tres correcciones de lo que el CEO probó en vivo.
Artefactos mínimos: no hay cambios de datos (solo semilla) ni de integración.

---

## Alcance

| # | Defecto | Corrección | Commit |
|---|---|---|---|
| 1 | **I-14** — sin navegación de retorno: desde `/dashboard/salidas/nueva` la única salida era el botón del navegador | Breadcrumb derivado de la ruta + enlace "← Volver" al módulo padre, resuelto **en el LAYOUT del dashboard, una sola vez, como componente compartido** (decisión de arquitectura de ZEUS — no página por página; las specs 005-008 lo heredan sin escribir nada). Sin librerías nuevas | `ba651dd0` |
| 2 | **I-13** — `POST /api/auth/login` con `admin` devolvía `[inicio, salidas]`; el manual (HANDOFF §10.8) dice que el administrador de plataforma solo ve Inicio y Usuarios y NO opera | `prisma/seed.ts`: rol 1 queda solo con `inicio` (Usuarios llega con la spec 009); roles 2 y 3 sin tocar; sincronización que retira asignaciones semilla obsoletas. Solo dato semilla — el bloqueo server-side es el guard de módulos de 005-A (D-017), no se adelantó | `ff118d71` |
| 3 | **Botón de login acoplado a la hidratación** — `disabled={cargando \|\| !usuario \|\| !contrasena}` se renderiza en servidor en `true` y solo se recalcula si React hidrata: un fallo de hidratación (fue I-12) deja el login como callejón sin salida silencioso | `disabled={cargando}`; la validación de vacíos la hacen los `required` nativos de los inputs. Honesto en el comentario: NO hace que el login funcione sin JavaScript — hace que un fallo de hidratación se vea como error en vez de formulario muerto | `c4ae2963` |

## Requisitos funcionales

- **FR-1 (I-14)**: todo submódulo bajo `/dashboard/*` DEBE mostrar breadcrumb derivado de la ruta
  (raíz = "Inicio") y un retorno al módulo padre; en la raíz no hay retorno. Implementado en
  `src/app/dashboard/layout.tsx` + `breadcrumb.tsx` + `src/lib/navegacion.ts` (función pura, testeada).
- **FR-2 (I-13)**: la semilla DEBE asignar al rol 1 únicamente el módulo `inicio` y retirar
  asignaciones obsoletas al re-ejecutarse; roles 2/3 conservan `[inicio, salidas]`.
- **FR-3**: el botón Ingresar DEBE depender solo de `cargando`; los campos vacíos los bloquea
  `required` nativo (sin dependencia de la hidratación).

## Criterios de éxito (verificados)

- **SC-1**: 64/64 tests verdes (58 previos + 6 de `navegacion.test.ts`); `tsc --noEmit`, `lint` y
  `build` limpios.
- **SC-2 (navegador real, contextos privados nuevos — sin cache/cookies)**: `admin` ve SOLO Inicio
  (API: `modulos=["inicio"]`); `vigilado` entra, navega Salidas → Nueva y VUELVE con el breadcrumb
  (URLs verificadas); botón Ingresar clicable con campos vacíos y submit bloqueado por `required`
  ("Please fill out this field."). Evidencia completa en el cuerpo de los tres commits.

## Notas

- Respaldo previo al seed: `~/003-backups/003-sicov-20260723-105804-pre-seed-i13.sql` (constitución §1.2).
- "Consulta integradora" sigue visible para todos: es un enlace fijo del dashboard (spec 003), no un
  módulo asignable; queda para el guard D-017 / spec 009.
