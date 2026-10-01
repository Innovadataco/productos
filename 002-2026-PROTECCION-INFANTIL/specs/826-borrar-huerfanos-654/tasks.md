# Tasks · SPEC-826

- [x] **T1** · Verificar los 10 huérfanos (0 importadores de producción) contra `origin/main`; descartar
  2 falsos positivos por basename ambiguo (estado-efectivo, importer).
- [x] **T2** · Confirmar «superseded» leyendo el reemplazo: lectura-capa1 (armar-payload — código muerto, no
  superseded estricto), usuarios-query (DAL where propio), carga-profesores/importer (confirmar route INLINE),
  admin-service (notificacion-admin.ts existe). Todos seguros de borrar (0 importadores).
- [x] **T3** · Borrar los 10 módulos + 2 tests propios (SemaforoItem, lectura-capa1).
- [x] **T4** · Barrido de candados FUENTE-reader: voz-cuenta (−LandingFeatures), forms-publicos
  (−Registro/VerificacionForm de CLAVE), url-privacy (−ExpedienteDetalleClient de EXENTOS), colegio-inicio-color
  (−contraprueba SemaforoItem + imports huérfanos). Comentario de armar-payload actualizado.
- [x] **T5** · Allowlist: −10 entradas; 11 re-clasificada a `fuente-de-invariante` (sin salida exigida);
  nota de 13 = pregunta abierta; `descripcion` documenta la clase nueva.
- [x] **T5-bis** · CASCADA (un borrado barre más de lo que parece): borrar `ExpedienteDetalleClient` dejó
  huérfanos a `AgregarEventoForm.tsx` y `TimelineEventos.tsx` (eran su subárbol muerto, #555; 0 otros
  importadores). Ambos borrados; la deuda de `AgregarEventoForm` sale de `BASE` en `boton-frontera.candado.test.ts`.
  No cascada más allá (importaban solo UI compartida / nada). arch:check (i) VERDE.
- [ ] **T6** · Gate COMPLETO por exit code (tsc + lint + arch:check + test:unit).
- [ ] **T7** · Push + PR (con luz verde de cola del CEO).

## Nota
- Las 3 del trío de 752 (17/19 → SPEC-819 por Dev-1; 18 → SPEC-823) y las 2 🚩 (14/20, decisión de Jelkin)
  NO se tocan acá — son de otros dueños/decisiones.
- `registro-columnas-sensibles` es la ÚNICA re-clasificada a `fuente-de-invariante`; el resto de hueco-funcional
  tiene un consumidor pendiente (772) o una decisión en curso (14/20), así que se quedan.
