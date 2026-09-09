# Plan · SPEC-604 — Modelo EXPEDIENTE (cimientos)

**Status**: IMPLEMENTADO · **Spec**: [spec.md](./spec.md) · **Rama**: `work/pi-SPEC-604-expediente-unico`

## Contexto

El diseño final aprobado (`design/expediente-final-mockup.html`) fija el modelo «EXPEDIENTE como módulo único»: un expediente = ficha de UNA cuenta que toca a UN menor; los reportes son eventos dentro. Sobre `main` ya existen: el paso 0 del wizard con selector de fichas activas (SPEC-591), `Reporte.hijoId` con FK e índice (migración `20260908005736`), la cadena plana `Reporte.reportePrincipalId` (SPEC-340) y el `ExpedienteRepository` con idempotencia por `reporteId`. Esta spec conecta esas piezas: el expediente deja de ser manual (botón de SPEC-340, derogado) y nace solo desde el evento 1; el paso 0 gana el alta «solo nombre»; la edad se deriva de la ficha. El anónimo no se toca.

## Decisiones

1. **Sin migración nueva.** El brief pedía la columna `Reporte.hijoId`: ya existe por SPEC-591 (nullable + FK SetNull + índice). Se declara en «Impacto en arquitectura» y no se duplica DDL.
2. **Auto-creación en la MISMA transacción del alta** (opción del brief), no en el procesamiento asíncrono: el padre ve «Ver expediente» desde el instante del 201. La carrera ya la cierra el advisory lock (usuario+identificador) de SPEC-137 tomado antes en la misma tx.
3. **Servicio DAL único** `asegurarExpedienteParaReporte(tx, reporteId)` usado por el alta y por «Agregar otro evento»: lee el identificador CANÓNICO guardado en el reporte (normalizado por el embudo único de SPEC-325), busca el último expediente por (padre, identificador), crea si no hay vigente (CERRADO abre ciclo nuevo) y agrega el evento (idempotente por `reporteId` en el repositorio). `origenCreacion = AUTOMATICO` (default de columna) — el valor `PADRE` queda para backfills del endpoint legado.
4. **Endpoint legado conservado.** `POST /api/padre/expedientes` sigue vivo como backfill idempotente de cadenas pre-SPEC-604; solo desaparece el botón.
5. **Alta «solo nombre» al ENVIAR**, no al teclear en el paso 0: un wizard abandonado no deja fichas huérfanas. Exige relajar `apellidos` a opcional en `POST /api/padre/hijos` (deroga parcialmente SPEC-339 FR-019, documentado; la columna tiene default `""`).
6. **Edad derivada al seleccionar la ficha** (`año en curso − anioNacimiento`), guardada en el estado del wizard y enviada como siempre; el campo del paso 2 se oculta con la prop `ocultarEdad` (default `false` → anónimo intacto).

## Pasos (ver tasks.md)

1. DAL `expediente-automatico.ts` + integración en `POST /api/reportes` (UoW + `expedienteId` en respuesta) y en `POST /api/reportes/[id]/evento` (hereda `hijoId`).
2. Frontend wizard: `ReporteStepHijo` (edad + alta inline), `ReporteWizard` (selección, validación, alta al enviar), `ReporteStepDetalle` (`ocultarEdad`), `ReporteStepConfirmar` (fila y nota).
3. Mis reportes sin botón «Crear expediente»; barrido de comentarios (route, service, schema, cadenas-padre).
4. API hijos: apellidos opcional (route + tipos + servicio).
5. Tests: reescritura de los que afirmaban el modelo viejo + nuevos del paso 0, edad y auto-expediente.
6. Artefactos + gate + `arch:check`.

## Riesgos y mitigaciones

- **Dos altas concurrentes mismo padre+identificador** → el advisory lock de SPEC-137 serializa; la segunda recibe oferta o ve el expediente commitado. Idempotencia extra por `reporteId` en `agregarEvento`.
- **Expediente CERRADO** → `agregarEvento` lanza 409 por regla del repositorio; el servicio abre ciclo nuevo en vez de bloquear el reporte (reportar nunca se bloquea, regla dura SPEC-356).
- **Tests que afirmaban «sin expediente en el alta»** (SPEC-340) → reescritos para afirmar el modelo nuevo; el resto de la suite no cuenta expedientes (verificado por grep).
- **Derogación de FR-019 (apellidos)** → acotada al alta: el formulario completo sigue enviándolos; test actualizado afirma el 201 «solo nombre».
