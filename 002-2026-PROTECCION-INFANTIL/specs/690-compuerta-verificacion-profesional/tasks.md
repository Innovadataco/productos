# SPEC-690 · Tasks

## Medición (antes de escribir) — hecho
- [x] T1 · Enumerar el árbol de rutas del profesional + `api/reportes/acceso/canjar`; medir la guardia real.
- [x] T2 · Confirmar que `rol: PROFESIONAL` persiste en los 6 estados (el gate no existe en ninguna).
- [x] T3 · Matriz estado × capacidad → aprobada por CEO (+ Diseño).

## 690-A · fuente única + contrato /api/me — hecho
- [x] T4 · `estaHabilitado` en `vigencia.ts` (fuente única); `puedeAparecerEnDirectorio` delega.
- [x] T5 · `obtenerHabilitacionProfesional(usuarioId)` — `{estado, habilitado}` contra la base, cada petición.
- [x] T6 · `/api/me` PROFESIONAL → `profesional:{estado,habilitado}`.
- [x] T7 · Candados: `estaHabilitado` unit (incluye SUSPENDIDO) + delegación directorio≡habilitado + contrato `/api/me` (integración: suspender misma sesión → habilitado:false en la siguiente llamada).
- [ ] T8 · PR 690-A. Reportar verde al CEO.

## 690-B · compuerta + barrido + candado (sale de main cuando A entre)
- [ ] T9 · `exigirProfesionalHabilitado(userId)` sobre `estaHabilitado`.
- [ ] T10 · Compuerta en rutas operativas (panel · franjas · solicitudes · confirmar/rechazar · canjar-profesional).
- [ ] T11 · Barrido de páginas del profesional que leen por el DAL directo.
- [ ] T12 · Candado de conducta derivado del árbol + control positivo por remoción del discriminador (ACTIVO pasa, SUSPENDIDO falla).
- [ ] T13 · PR 690-B.

## Fuera
- Pantalla (Diseño). · `upsert` del documento verificado → I-416.
