# Tasks — SPEC-750

Orden por dependencias. `[P]` = paralelizable.

## Fase 1 — Backend + candados (P1, «donde se gana o se pierde»)
- [x] T001 Asignación con simultaneidad: `src/lib/operadores/asignador-citas.ts` (reusa estrategia + filtro de solape) + `simultaneidad.ts` (solape puro).
- [x] T002 DTO/servicio del operador SIN PII: `src/lib/operadores/calendario-operador.service.ts` (query con `select` sin `padreUsuario`).
- [x] T003 Enlace: `enlace-validacion.ts` (https/no-HTML + visibilidad, puras) + `enlace-sesion.ts` (publicar + HECHO).
- [x] T004 HECHO tipado: `hecho-sesion-tipos.ts` (forma sin url/contenido) → `registrarHechoSesion`.
- [x] T005 Candados: `sesion-operador.candado.test.ts` (C-a/C-b/C-c integración) + `enlace-sesion.test.ts` + `asignador-citas.test.ts` (unit).
- [x] T006 Fallback DTO (C-d): `reasignar`/`reprogramar` no devuelven el modelo crudo.
- [x] T007 FR-013: proyección — vistas admin de pagos no exponen el enlace.
- [x] T008 Parámetro sembrado `operador.guion.version` (prisma/seed.ts).
- [x] T009 Ruta `POST /api/operador/citas/[id]/enlace`.

## Fase 2 — Cableado a producción (MOTOR · #733)
- [x] T010 Disparar `asignarOperadorACita` al CONFIRMAR la cita (cita.service) — antes del día.

## Fase 3 — SUPERFICIE (→ T014, PR aparte sobre `main`; CEO cierra su DoD)
> El corte es por NATURALEZA (veredicto CEO 04:18): #733 = motor, sin superficie; T014 = superficie completa.
- [ ] T011 Módulo `sesiones_operador`: catálogo + grant a OPERADOR + **ítem de nav con su ícono de Diseño** + guardia de página. (Los tres juntos: grant sin ítem rompe nav-items; ítem sin ícono rompe nav-iconos.)
- [ ] T012 Página del operador `/dashboard/admin/sesiones`: `calendarioDelOperador` (DTO SIN PII) + candado C-a + formulario de enlace.
- [ ] T013 Componente de límites [NORMA] (copy FORMA §6; la pantalla NO se presenta como el guion).
- [ ] T014 Capacidad al admin: en `/dashboard/admin/operadores/asignar`, citas CONFIRMADAS sin operador (ámbar) + acción de asignar.

## Fase 3 — Cierre
- [ ] T015 `test:unit` completo + tsc + eslint + arch:check verdes.
- [ ] T016 Deploy limpio + recorrido quickstart.
