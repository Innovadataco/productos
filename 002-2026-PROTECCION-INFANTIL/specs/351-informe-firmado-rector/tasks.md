# Tasks: SPEC-351 · Informe firmado del rector (A-69 · C5)

**Status**: Planeada
**Impacto en arquitectura:** aditivo · nuevo modelo `InformeCaso`, nueva columna `Colegio.escudoAssetKey`, nuevos endpoints bajo `/api/colegio/casos/[id]/informes`, extensión del verificador público (`/api/publico/verificar-pdf/[hash]` y `/verificar/[codigo]`) para resolver informes del colegio además de los del padre.

## Fase 1 · Setup
- [ ] T001 Migración Prisma aditiva: `Colegio.escudoAssetKey String?` + tabla `InformeCaso` con FK, unique compuesto `(casoId, anio, numeroCorrelativo)` y `pdfHash`/`codigoVerificacion` únicos.
- [ ] T002 `npx prisma generate`.

## Fase 2 · Foundational
- [ ] T010 [P] `src/lib/colegio/escudo-storage.ts`: helper para guardar/leer el escudo desde `pi_apelaciones_storage/escudos/<colegioId>.<ext>` con validación de tipo y tamaño ≤ 500 KB.
- [ ] T011 [P] `src/lib/caso/pdf-informe-caso.ts`: `generarPdfInformeCaso(datos): Buffer` usando `pdfmake`. Header con escudo + nombre + NIT + fecha (TZ Bogota) + correlativo. Cuerpo por secciones seleccionadas (hechos, actuación con `NotaSeguimiento`, análisis del comité, contexto del curso). Footer con firma del rector + código de verificación de 16 hex y URL `<baseUrl>/verificar/<codigo>`.
- [ ] T012 [P] Test contract del PDF: verifica que el buffer produce archivo válido, que el header incluye el correlativo formateado y que el footer incluye el código (grep sobre el rawText del PDF).

## Fase 3 · US1 · Generar informe (P1)
- [ ] T030 [US1] `src/lib/dal/services/informes-caso.ts`: `registrarInformeCaso({ casoId, generadoPorId, pdfHash, codigoVerificacion, secciones, anio })` con `pg_advisory_xact_lock(hashtext("informe-caso:"+casoId))` para serializar el correlativo. `buscarInformeCasoPorHash`, `buscarInformeCasoPorCodigo`. NO exporta update/delete (blindaje inmutabilidad).
- [ ] T031 [US1] `POST /api/colegio/casos/[id]/informes`: guard `SCHOOL_ADMIN` del colegio del caso, valida body `{ secciones }`, carga datos del caso (hechos + notas + análisis comité si existe), decide el `codigoVerificacion` ANTES, genera el PDF, calcula el hash del buffer FINAL, registra vía DAL y devuelve `{ id, numeroCorrelativo, pdfHash, downloadUrl }`.
- [ ] T032 [US1] `GET /api/colegio/casos/[id]/informes/[hash]/pdf`: devuelve el PDF por hash (regenerar en caliente desde los datos actuales fallaría — el hash quedaría distinto; usar caché: regenerar del estado sembrado en la fila y verificar hash — si difiere marcar 500 con `estado_inconsistente`).
- [ ] T033 [US1] Test integración: 403 no-SCHOOL_ADMIN, 404 caso ajeno, 200 con `secciones=["hechos","actuacion"]`, la fila queda persistida con correlativo `INF-2026-0001`, el PDF baja con el hash correcto.
- [ ] T034 [US1] `PanelGenerarInforme.tsx` client: modal con checkboxes de secciones + botón Generar; on-success descarga y refresca `HistorialInformes`.
- [ ] T035 [US1] `HistorialInformes.tsx` client: lista con correlativo + fecha (TZ Bogota) + firma + botón Descargar.
- [ ] T036 [US1] Montar ambos en el detalle del caso (SPEC-350 · `CasoVivo.tsx`) con boundary de rol.

## Fase 4 · US2 · Historial inmutable (P1)
- [ ] T040 [US2] Test inmutabilidad: los exports de `informes-caso.ts` NO incluyen ningún mutador (`update|delete|borrar|editar|eliminar|marcar`).
- [ ] T041 [US2] Test carrera: 8 generaciones concurrentes del mismo caso → correlativos `INF-<año>-0001..INF-<año>-0008` sin colisión (patrón I-208).
- [ ] T042 [US2] Test rollover de año: sembrar un informe con `anio=2026` y luego generar con TZ ajustada a 2027 → primer informe 2027 es `INF-2027-0001`.

## Fase 5 · US3 · Verificación pública (P2)
- [ ] T050 [US3] Extender `GET /api/publico/verificar-pdf/[hash]`: si no lo resolvió `InformePadre` ni `InformeConsolidado`, buscar en `InformeCaso`. Devuelve `casoId`, `numeroCorrelativo`, `pdfGeneradoEn`, `firmadoPorNombre` (sin PII del sujeto).
- [ ] T051 [US3] Extender `/verificar/[codigo]/page.tsx`: si el código resuelve un `InformeCaso`, renderizar la rama con "Informe del colegio · rector <nombre>" y fecha, con la misma discreción de PII.
- [ ] T052 [US3] Test anónimo: `GET /api/publico/verificar-pdf/<hash-real-informe-caso>` responde 200 sin sesión; hash falso → 404.

## Fase 6 · Escudo del colegio (D1)
- [ ] T060 `EscudoColegioUploader.tsx` en Configuración: input file, preview, POST al helper de T010; muestra el escudo guardado.
- [ ] T061 Test de guard del upload: extensión no permitida → 400; > 500 KB → 400; PNG válido → 200 con la clave del asset guardada.
- [ ] T062 Sin escudo cargado, el PDF sale con membrete neutro y aviso en la descarga (FR-002).

## Fase 7 · Polish
- [ ] T090 Regen `docs/architecture/02-roles-capacidades.md` (nuevas rutas bajo `/api/colegio/casos/[id]/informes`).
- [ ] T091 `tokens:check` + `arch:check` + `locks:check` + `tsc --noEmit` + `specs-discipline` verdes.
- [ ] T092 `cierre.md` con hash + recorrido del CEO (upload escudo → escalar → generar → descargar → verificar anónimo).
- [ ] T093 Actualizar `specs/README.md` a 🟢 Implementada al cerrar.

## Dependencias

- Setup → Foundational → US1 → (US2 + US3 + escudo) en paralelo.
- Depende de SPEC-350 (C3) para montar el botón; no bloquea funcionalmente al implementar (Historial y verificación pueden ser probados con caso creado a mano).

## MVP

**US1 + escudo mínimo** entrega el flujo completo del brief D1+C5.
