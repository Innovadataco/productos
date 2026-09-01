# Cierre · SPEC-351 · El informe firmado del rector (A-69 · C5)

**Rama**: `work/pi-SPEC-351-informe-firmado-rector` (apilada sobre SPEC-350)
**Fecha**: 2026-09-01 · **Autor**: Dev PI-1
**Estado**: Implementada — pendiente merge de 350 + recorrido en vivo del CEO

## Qué quedó

- **Migración aditiva** `20260901100000_spec_351_informe_caso`:
  `Colegio.escudoAssetKey` + tabla `InformeCaso` (pdfHash/codigo únicos,
  unique `(casoId, anio, numeroCorrelativo)`, FK Cascade al caso).
- **Escudo (D1)**: `escudo-storage.ts` valida por MAGIA DE BYTES — SOLO
  PNG/JPG (SVG prohibido, candado CEO, aunque venga renombrado), ≤ 500 KB.
  Upload/preview en Configuración (`EscudoColegioUploader` + ruta
  `POST/GET /api/colegio/configuracion/escudo`).
- **PDF** (`pdf-informe-caso.ts`): membrete (escudo + nombre + NIT +
  correlativo + fecha Bogotá), secciones seleccionables, firma del rector,
  código de verificación al pie. `HechoInforme` NO tiene campo de texto POR
  CONSTRUCCIÓN (FR-004-bis). Determinista (creationDate fija).
- **Correlativo `INF-AAAA-NNNN`**: se decide bajo `pg_advisory_xact_lock`
  DENTRO de la transacción que registra, y el PDF se renderiza con ese
  correlativo EN LA MISMA transacción — el impreso y el registrado no pueden
  divergir. Rollover por año Bogotá.
- **Historial INMUTABLE**: DAL sin exports mutadores (test al estilo
  informes-padre); sin PATCH/DELETE en ninguna ruta.
- **Verificación pública**: `/api/publico/verificar-pdf/[hash]` y
  `/verificar/[codigo]` resuelven también `InformeCaso` (metadata segura:
  fecha, correlativo, nombre del firmante — cero PII del sujeto).
- **Q-3**: cero prisma en rutas — todo en `informes-caso.ts` +
  `escudo-colegio.ts` (separado porque el primero es inmutable por contrato).
- **UI**: `InformesCasoPanel` (selección de secciones + generar+descargar +
  historial) montado en el detalle del caso junto al CasoVivo de 350. Voz USTED.

## Evidencia · 19/19 tests verdes (BD de TEST, `--env-file=.env.test`)

- Ruta informes (6): 403/404, 201 con PDF válido `%PDF-` + correlativo 0001 +
  aviso sin-escudo + hash coincide con la fila, **FR-004-bis por intercepción
  del input** (texto del reporte y email del denunciante = 0 hits; la bitácora
  propia SÍ va), 400 sin documento del rector, historial descendente.
- DAL (4): carrera 8 concurrentes → 0001..0008, rollover de año, inmutabilidad
  de exports, búsqueda por hash/código.
- Escudo (5): PNG ✓, JPG ✓, SVG rechazado por magia, vacío rechazado, >500 KB
  rechazado.
- Verificador público (4): InformeCaso por hash y por código, sin PII.

## Compuertas

arch:check (4 docs regen) · locks:check · tokens:check · tsc · lint limpio
(solo warning complexity heredado del CasoVivo).

## Recorrido esperado (CEO)

1. Configuración → cargar escudo PNG → preview aparece.
2. Detalle de un caso → panel "Informe firmado" → marcar hechos+actuación →
   Generar → el PDF baja como `INF-2026-0001.pdf` con membrete y escudo.
3. Abrir el PDF: correlativo + firma del rector + código al pie.
4. `/verificar/<codigo>` en incógnito → "Informe del colegio verificado" con
   fecha y firmante.
5. Generar un segundo informe → historial lista 0001 y 0002; nada se puede
   borrar ni editar.
6. Probar subir un SVG → rechazo con mensaje claro.
