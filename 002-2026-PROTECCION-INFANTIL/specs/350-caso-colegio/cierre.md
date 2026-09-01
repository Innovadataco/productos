# Cierre · SPEC-350 · El caso del colegio estilo expediente (A-69 · C3)

**Rama**: `work/pi-SPEC-350-caso-colegio` · **Fecha**: 2026-09-01 · **Autor**: Dev PI-1
**Estado**: Implementada — pendiente recorrido en vivo del CEO

## Qué quedó

- **Migración aditiva** `20260901090000_spec_350_analisis_caso_colegio`:
  `AnalisisExpediente.expedienteId` a nullable + `seguimientoCasoId` (FK Cascade)
  + **CHECK XOR** (`dueno_xor_check`, cinturón pedido por el CEO — smoke-test
  verificado: crear sin dueño es rechazado por Postgres) + unique e índices
  espejo del lado caso.
- **`src/lib/caso/hechos-caso.ts`**: hechos visibles del colegio (fecha/lugar/
  clasificación/plataforma + lat/lng del catálogo) + agregados anónimos por
  (curso, plataforma, franja BOGOTÁ, categoría). El SELECT jamás pide texto ni
  identidad del denunciante — la valla vive en la consulta.
- **Ejecutor dual dueño** (`ejecutar-analisis.ts`): mismo pipeline
  modelo→validación→persistencia; `DuenoAnalisis` acepta el expedienteId plano
  (compatibilidad SPEC-341, tests intactos) o `{seguimientoCasoId}`.
  Worker pasa `seguimientoCasoId` del payload sin ramas nuevas.
- **`sendAnalisisExpediente`**: job acepta cualquiera de los dos dueños;
  singletonKey por dueño+hash; misma cola/prioridad/tope.
- **DAL `analisis-caso.ts`**: espejo del padre con boundary
  SCHOOL_ADMIN/COMITE_CONVIVENCIA del colegio del caso, hash de cadena derivado
  de (última fecha, cantidad, conteos por categoría), economía completa
  (TTL, cool-down, huérfanos, agotamiento SPEC-348 con escape manual) y el
  candado extra: **caso cerrado no gasta modelo**.
- **Ruta `GET/POST /api/colegio/casos/[id]/analisis`** con la misma forma del
  padre + `caso` + `hechos` para pintar la pantalla en una llamada.
- **`CasoVivoColegio.tsx`** (voz USTED): mapa (`MapaUbicaciones` reusado · D6),
  capa 1 "En vivo" (cifras calculadas client-side de los hechos), capa 2 con
  sello/guía/Actualizar/tarjeta ámbar de agotamiento; montado en
  `CasoDetalleClient` cuando la alerta ya tiene `SeguimientoCaso`.
- `obtenerDetalleCaso` expone `seguimiento.id` (una línea aditiva).

## Evidencia

- **49/49 tests verdes en la BD de TEST** (corridos con `--env-file=.env.test`
  tras el incidente de env): ruta caso 7 + hechos-caso 4 (incluye blindaje PII
  con grep exacto y franja nocturna Bogotá 21:15 COT → "18-24") + suite completa
  del análisis del padre 22 + DAL padre 5 + ruta padre 11 — regresión limpia.
- CHECK XOR verificado con smoke-test real contra Postgres.
- Compuertas: arch:check (3 docs regenerados), locks:check, tokens:check,
  tsc --noEmit, lint (solo warnings de complexity).

## Recorrido esperado (CEO)

1. Escalar una alerta a caso → abrir el detalle → aparecen mapa + "Lo que
   muestra este caso" (En vivo) + "Análisis detallado" con banner de espera.
2. Esperar ~90 s → análisis publicado con sello y guía, voz USTED.
3. Reabrir sin cambios → instantáneo (sin gasto de modelo).
4. Pulsar Actualizar en cool-down → mensaje "Podrá actualizar en N minutos".
5. Verificar el blindaje: el texto del análisis no menciona nombres, nicks ni
   contenido de reportes (payload = agregados anónimos).
6. Cerrar el caso → el botón queda deshabilitado con la nota de consulta.
