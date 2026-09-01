# Tasks: SPEC-340 · Mis reportes y el expediente · el hilo (A-68 · Fase 1)

**Input**: spec, plan, research, data-model, contracts, quickstart · **Branch**: `work/pi-SPEC-340-mis-reportes-expediente`
**Pruebas obligatorias** (AGENTS.md + candado 24). Formato `- [ ] TNNN [P?] [US?] descripción con ruta`.

## Fase 1 · Preparación

- [ ] T001 Leer línea por línea lo que este plan toca: `src/app/api/reportes/route.ts`, `src/lib/expediente/motor/tareas-motor.ts`, `src/lib/expediente/estados/transiciones.ts`, `src/lib/expediente/pdf-expediente.ts`, `src/lib/expediente/pdf/generar-pdf.ts` (contrato del hash de SPEC-234), `src/lib/dal/services/reporte-query.ts`, `src/components/modules/ReporteWizard.tsx`, `SeguimientoClient.tsx`, `MapaUbicaciones.tsx`, `NavHeader.tsx`. Hallazgos fuera de alcance → reporte, no arreglo callado

## Fase 2 · Las derogaciones (primero, solas — el diff más caliente)

- [ ] T002a [US5] Migración: `Reporte.reportePrincipalId` (self-FK, `onDelete: SetNull`, índice) + backfill desde `EventoExpediente` con guarda que aborta si un reporte aparece en dos expedientes (data-model §0, aprobado CEO 01-09)
- [ ] T002b [US5] En la transacción del alta (`src/app/api/reportes/route.ts:144-169`): reemplazar la creación del expediente por la escritura de `reportePrincipalId` (resolviendo al principal si el previo ya era evento). La vinculación de `reporte-creation.ts:89-102` (lock + no-duplicación #202) queda ÍNTEGRA
- [ ] T002c [US5] `scripts/limpieza/borrar-reporte.ts`: al borrar un principal, null-ear los `reportePrincipalId` de sus eventos (coherente con SetNull)
- [ ] T003 [US5] Derogar el auto-cierre: en `src/lib/expediente/motor/tareas-motor.ts` la tarea retorna 0 documentando la derogación (D-1, «nada se cierra nunca»); en `src/lib/expediente/estados/transiciones.ts` la transición a CERRADO por inactividad queda código muerto documentado — no se borra
- [ ] T004 Migración de parámetro: `padre.expediente.auto_cierre_meses` → `0` (apagado) SOLO si sigue en `6` (respeta ediciones del admin); el motor trata `0` como derogado — doble valla con T003
- [ ] T005 [P] [US1] Quitar el letrero «Reportando como…» de `src/components/modules/ReporteWizard.tsx` y actualizar los 2 tests que lo afirman (assert de que NO existe)
- [ ] T006 [P] [US1] Quitar el CTA «Reportar de nuevo a este identificador» de `src/components/modules/SeguimientoClient.tsx` + su test
- [ ] T007 Correr la suite COMPLETA de reportes/cadena/expediente (`src/app/api/reportes/**`, `src/lib/expediente/**`, `src/lib/dal/services/reporte-query*`) y dejarla verde ANTES de construir nada encima (candado 24). Ajustar los tests que afirmaban el expediente automático: ahora afirman que NO nace

## Fase 3 · Fundaciones

- [ ] T008 `prisma/schema.prisma`: modelo `InformePadre` (data-model §1, sin campos editables) + `Expediente.origenCreacion @default("AUTOMATICO")` + migración aditiva
- [ ] T009 [P] Sembrar en `prisma/seed.ts`: `padre.texto.retapado_minutos=10` · `padre.texto.stepup_minutos=30` · `padre.analisis.explicacion.<CATEGORIA>` (una por categoría del clasificador, voz del brief, tuteo)
- [ ] T010 [P] Crear `src/lib/dal/services/informes-padre.ts` — SOLO `registrar` (número secuencial siguiente en transacción) y `listar`. Update/delete NO existen. AuditLog sin PII
- [ ] T011 [P] Test `informes-padre.test.ts`: secuencial correcto con generaciones concurrentes, y aserción de que el servicio no exporta mutación

## Fase 4 · El hilo de datos (US2 · US5)

- [ ] T012 [US2] `GET /api/padre/reportes/cadenas` — nueva ruta: una entrada por cadena con contadores, clasificación dominante, `textoDisponible` (JAMÁS el texto), `otrosReportes` del blindaje existente y `expedienteId|null`
- [ ] T013 [US2] `POST /api/reportes/[id]/evento` — nueva ruta: hereda nick/país/ciudad/edad del principal EN SERVIDOR; entrada solo `{texto, fechaIncidente}` con hora; reusa la vinculación existente
- [ ] T014 [US5] `POST /api/padre/expedientes` — el botón: crea con `origenCreacion:"PADRE"`, idempotente (cadena con expediente → devuelve el existente)
- [ ] T015 [P] [US2] Tests de cadenas y evento: herencia de campos, hora guardada, cadena de 3+1 suelto → 2 tarjetas, texto ausente del payload de listado, y FR-009 dedicado: ajeno anónimo y autenticado llegan con fecha/hora/lugar/clasificación, SIN texto y SIN autor, marcados; sin ajenos → null (la UI dice «sin otros reportes por ahora»)
- [ ] T016 [P] [US5] Tests del botón: crea una vez, idempotente, 404 ajeno, `origenCreacion` correcto, y el 2º reporte vinculado NO crea expediente (regresión de T002)
- [ ] T017 [US1] `POST /api/reportes`: `fechaIncidente` acepta y valida fecha+hora; el form (`ReporteStepDetalle.tsx:153`) pasa a fecha y hora; reportes viejos muestran solo fecha sin inventar hora. Y FR-004: la edad del menor validada estricta (entero en rango) — materia prima limpia de la analítica futura, con test

## Fase 5 · El step-up del texto (US3)

- [ ] T018 [US3] `POST /api/padre/step-up` — revalida contraseña con el contador GLOBAL de intentos (sin contador paralelo); emite cookie firmada `stepup_sello` (HMAC patrón `sesion_estado`, vida M min)
- [ ] T019 [US3] `GET /api/padre/reportes/[id]/texto` — única vía del texto propio: sesión < M min (iat del JWT) O sello fresco; si no, 403 `STEP_UP_REQUERIDO`. El PDF queda EXENTO por diseño (es el entregable)
- [ ] T020 [US3] Componente `TextoSensible.tsx`: difuminado + «Revelar texto · se ocultó por tu seguridad» + re-tapado a los N min (reloj cliente) + modal de contraseña cuando la ruta devuelve `STEP_UP_REQUERIDO`
- [ ] T021 [P] [US3] Tests: sesión joven entrega, vieja exige, contraseña errada alimenta el contador global y NO entrega, sello vence a los M, el texto no aparece en el payload de cadenas (regresión de T012)
- [ ] T022 [US3] «Ver análisis» (`VerAnalisis.tsx` + explicación en la ruta de detalle): parámetro por categoría, fallback sereno si falta la clave; sin clave técnica sola; caso «en camino» para reportes sin clasificar

## Fase 6 · La capa 1 (US8)

- [ ] T023 [US8] `src/lib/expediente/lectura-capa1.ts` — módulo PURO: franjas (bloques 3 h), escalada, aceleración, alcance, perfil (+cruce con hijos por identificador), ciudades ordenadas con el más reciente. Cifras tipadas, cero adjetivos
- [ ] T024 [P] [US8] `lectura-capa1.test.ts` — tabla de casos: el ejemplo del brief (4 de 5 entre 9-11 p. m.), un solo hecho, una ciudad, empates, escalada, sin escalada, cruce con hijo. Aserción anti-plantilla: ninguna cadena interpretativa en el módulo
- [ ] T025 [US8] `GET /api/padre/expedientes/[id]/lectura` + panel «Lo que muestra tu expediente» con la invitación al análisis detallado (SPEC-341) donde iría la interpretación

## Fase 7 · El expediente vivo (US6 · US7)

- [ ] T026 [US6] `ExpedienteVivo.tsx`: encabezado «N hechos documentados · X tuyos… · siempre abierto», mapa (`MapaUbicaciones` reusado) y línea de tiempo con marca mío/autenticado/anónimo, texto propio vía `TextoSensible`
- [ ] T027 [US6] La simulación: reproducción cronológica con fecha visible, pausa y arrastre, `fitBounds` al entrar ciudad/país fuera de encuadre; con `prefers-reduced-motion`, salto directo sin interpolación
- [ ] T028 [US7] PDF con sello: `pdf-expediente.ts` gana pie (fecha/hora Bogotá + código + URL pública) con el hash canónico en dos pasadas COPIANDO el contrato de `generar-pdf.ts:141` (SPEC-234) — mismo mecanismo, no uno nuevo
- [ ] T029 [US7] La ruta del PDF registra `InformePadre` en cada generación + AuditLog; el detalle del expediente lista «Informes generados» (número, fecha, código) permanente
- [ ] T030 [US7] `GET /api/publico/verificar-pdf/[hash]`: segunda búsqueda en `InformePadre`, contrato de respuesta idéntico
- [ ] T031 [P] [US7] Tests: pie impreso con fecha, hash verifica, PDF alterado no verifica, dos generaciones = dos registros numerados, el historial no tiene vía de mutación (regresión de T010)
- [ ] T032 [US2] `MisReportesCadenas.tsx` + `AgregarEvento.tsx`: tarjeta con acordeón cronológico, botones Crear/Ver expediente · Agregar evento (campos fijos visibles pero no editables) · Ver análisis · «Otros reportes» con «sin otros reportes por ahora»

## Fase 8 · El escudo (US9)

- [ ] T033 [US9] `NavHeader.tsx`: solo rol padre — consulta `/api/notificaciones/resumen` al montar y al recuperar foco; `noLeidas>0` → `Guardian` en alerta; al marcar leídas vuelve a calma sin recargar
- [ ] T034 [P] [US9] Test de NavHeader: ámbar con noLeidas>0, calma con 0, roles ajenos intactos

## Fase 9 · Voz, cierre y candados

- [ ] T035 Barrido de voz: tuteo neutro, cero «cerrar/resuelto/caso terminado», cero puntajes, cero rojo, ámbar único color de alerta — en todo lo nuevo (SC-007)
- [ ] T036 [P] `tests/e2e/mis-reportes-expediente.spec.ts` — el hilo a 390 px: reportar con hora → tarjeta → evento con campos fijos → crear expediente → reproducir historia → PDF → verificación pública
- [ ] T037 Regenerar `docs/architecture/` + declarar huérfano `InformePadre` si aplica (con motivo) + `npm run arch:check` verde
- [ ] T038 Puerta completa: `tsc` · lint · `npm run test` · build · `tokens:check` · `dev-restart.sh`
- [ ] T039 Recorrer `quickstart.md` (36 pasos) y adjuntar las capturas al PR
- [ ] T040 `cierre.md` + sección Implementación en spec.md + estado IMPLEMENTADO + fila README

## Dependencias

```text
F1 → F2 (derogaciones, con T007 como compuerta) → F3 → {F4, F5} → F6 → F7 → F8 → F9
T012 necesita T008 · T019 necesita T018 · T025 necesita T023 · T028-T031 necesitan T010
```

**Por qué las derogaciones primero**: reescriben el código más caliente (#202 es de ayer). Si algo se rompe ahí, quiero descubrirlo el primer día con la suite completa, no debajo de cinco capas nuevas.

## MVP

Fases 2-4 (T002-T017): el hilo sin expediente vivo — reportar con hora, cadenas, eventos sin fricción, expediente por botón. Ya demuestra las dos derogaciones y el flujo central.

## Resumen

- **42 tareas** · 9 fases · pruebas: **12** dedicadas + la compuerta T007
- Por historia: US1 3 · US2 5 · US3 5 · US4 (cubierta en T012/T032) · US5 5 · US6 2 · US7 5 · US8 3 · US9 2 · transversales 10
