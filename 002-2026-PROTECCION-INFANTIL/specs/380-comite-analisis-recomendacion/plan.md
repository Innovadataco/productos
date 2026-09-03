# SPEC-380 (PR A) · Plan

1. **Diagnóstico 15v5**: leer `SolicitudComite` y `informes-caso.ts:193`
   (`resolucion` ya la usa el informe → NO tocar), `CasoDetalle.tsx`, y las
   rutas del comité (`notas`, `resolver`).
2. **Migración aditiva** en `SolicitudComite` (5 columnas + 2 FKs SET NULL
   + índice tenant-scoped) + `ALTER TYPE AccionAudit ADD VALUE` idempotente.
3. **Endpoints**:
   - `PUT/GET /analisis` — comité edita, rector lee.
   - `POST /recomendar-informe` — marca y avisa; requiere análisis previo.
4. **Motor de notificaciones (SPEC-201)**: plantillas EMAIL + IN_APP,
   reglas hermanas (in_app obligatoria, email opcional). El helper
   `enviarRecomendacionInformeAlRector` en `email-colegio.ts` llama
   `programar` con `usuarioId: rector` — el motor respeta preferencias +
   quiet hours por canal.
5. **UI en `CasoDetalle`**: nueva sección "Análisis del comité" con textarea
   + botón "Guardar" + botón "Recomendar generar informe al rector".
   Tarjeta ámbar (nunca rojo) muestra la recomendación cuando existe.
6. **Robustez**: el POST recomendar envuelve la llamada al motor en
   try/catch — un fallo del correo (Resend en cuota) NO rompe la marca.
7. **Tests integración**: 6 casos para análisis + 4 para recomendar,
   incluyendo el candado "motor caído no rompe la acción".
8. **Gate**: `tsc --noEmit` limpio, integration verde, regen baseline
   arquitectura (aparecen las 2 rutas nuevas), specs-discipline verde.
