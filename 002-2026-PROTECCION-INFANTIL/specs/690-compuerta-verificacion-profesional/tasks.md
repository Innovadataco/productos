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
- [x] T8 · PR 690-A → #613 mergeado. Reportado verde al CEO.

## 690-B · compuerta + barrido + candado + vigencia única (#618)
- [x] T9 · `exigirProfesionalHabilitadoApi(userId)` sobre `estaHabilitado` (403). Renombrado con sufijo `Api` para NO chocar con la guardia de PÁGINAS de Dev 2 (`exigirProfesionalHabilitado`, redirige, #616). Núcleo común: `obtenerHabilitacionProfesional`.
- [x] T10 · Compuerta en rutas operativas: panel · franjas GET/POST · franjas/[id] DELETE · solicitudes GET · confirmar/rechazar PATCH · reportes/acceso/canjar (solo actor PROFESIONAL).
- [x] T11 · Barrido de páginas: las 4 páginas operativas (panel · calendario · citaciones · casos) pasan por la guardia de Dev 2; `perfil-profesional/completar` NO gatea a propósito (registro). Sin costura entre API (403) y página (redirect).
- [x] T12 · Candado de rutas derivado del árbol (`compuerta-rutas.candado.test.ts`): exige la LLAMADA (no el import), allowlist de registro que se limpia sola. Verificado por mutación: borrar/comentar el gate → rojo; ruta nueva sin gatear → rojo. + control positivo runtime: SUSPENDIDO no canjea (403).
- [x] T14 · `verificacionVigente` como término ÚNICO: `venceEnVigente` alineado a `revisadoEn`; directorio (`listarActivos`/`contarActivos`/`obtenerPublicoPorId`) filtra por `verificacionVigente` (SQL grueso como pre-filtro + JS autoritativo), H-2 intacto (verificaciones en query interna).
- [x] T15 · Candado de integración directorio ≡ estaHabilitado (`perfil-profesional-directorio-vigencia.candado.test.ts`) con la fila DIVERGENTE (aprobación nueva vence antes que una vieja) como control positivo. Rojo con el SQL solo, verde con el filtro autoritativo.
- [x] T16 · Fixtures de rutas gateadas corregidos (causa: fixture anterior a la compuerta, no defecto de la compuerta). Comentarios stale corregidos (`perfil-profesional.ts` vigenciaVigente/contarActivos).
- [ ] T13 · PR 690-B (#618). CI verde; pendiente revisión + merge del CEO.

## Fuera
- Pantalla (Diseño). · `upsert` del documento verificado → I-416.
