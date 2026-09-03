# SPEC-380 (PR A · C4) · Análisis del comité + recomendación de emitir informe

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-02 · **Dev**: PI-1 · **Origen**: C4 del brief A-69 (Jelkin, D-100 · 31-08).

## Problema

El comité de convivencia estudia el caso pero HOY no tiene dónde dejar su
análisis por escrito de forma persistente: `SolicitudComite.resolucion` solo
se llena AL CERRAR el caso (`/api/colegio/comite/solicitudes/[id]/resolver`)
y el informe del caso ya la lee (`informes-caso.ts:193`). Falta el eslabón
entre "el comité estudió" y "el rector firma": el análisis DURANTE la
deliberación y una señal explícita al rector para que sepa cuándo emitir.

## Requisitos

- **FR-001**: Nuevas columnas ADITIVAS en `SolicitudComite`:
  - `analisis` (Text, nullable) — editable por el comité mientras
    `estado='PENDIENTE'`.
  - `analisisActualizadoEn`, `analisisPorId` — trazabilidad.
  - `recomendacionInformeEn`, `recomendacionPorId` — marca al recomendar.
- **FR-002 (CANDADO)**: NO se cambia `resolucion` ni su semántica. Sigue
  siendo lo que el comité escribe al CERRAR y lo lee el informe del caso;
  el análisis es un campo separado.
- **FR-003**: `PUT /api/colegio/comite/solicitudes/[id]/analisis` guarda el
  texto (COMITE_CONVIVENCIA + módulo `colegios_comite_bandeja`); caso ya
  RESUELTO → 409 (el análisis queda tal cual para el informe).
- **FR-004**: `GET /api/colegio/comite/solicitudes/[id]/analisis` lo lee
  el comité Y el rector (SCHOOL_ADMIN) — el rector no puede editar.
- **FR-005**: `POST /api/colegio/comite/solicitudes/[id]/recomendar-informe`
  marca `recomendacionInformeEn` + `recomendacionPorId`. Rechaza si no
  hay análisis (400) o el caso ya está RESUELTO (409).
- **FR-006 (aviso al rector)**: usa el motor SPEC-201 con evento
  `colegio.comite.recomendacion_informe`. Dos reglas hermanas:
  - IN_APP · `obligatoria: true` — la señal siempre queda registrada.
  - EMAIL · `obligatoria: false` — respeta preferencias del rector +
    quiet hours (motor SPEC-201).
- **FR-007 (CANDADO CEO)**: el fallo del motor de notificaciones (Resend
  en cuota, etc.) NO rompe la recomendación. La marca queda; el warn se
  loguea en `logger.warn`.
- **FR-008 (voz)**: usted formal Colombia. Textos de recomendación, nunca
  de orden. El que firma es el rector.

## Impacto en arquitectura:

- Migración `20260902230000_spec_380_analisis_comite`: 5 columnas nullables
  y 2 FKs `SET NULL ON DELETE` a `Usuario`. Índice
  `(colegioId, recomendacionInformeEn)` para el listado de recomendaciones
  pendientes del rector. Dos valores nuevos en el enum `AccionAudit`
  (`ADD VALUE IF NOT EXISTS`).
- Dos endpoints nuevos + un helper `enviarRecomendacionInformeAlRector`
  en `email-colegio.ts`.
- Nueva plantilla IN_APP en `prisma/seed.ts` (patrón anti-I-100 con
  `update: {}`) + regla IN_APP asociada.
- UI: nueva sección "Análisis del comité" en `CasoDetalle.tsx` que el
  comité edita (textarea + Guardar + Recomendar) y el rector lee sin
  botones. La recomendación se muestra en tarjeta ámbar (nunca rojo).

## Fuera de alcance

- **PR B (SPEC-380b)**: `IdentificadorIntegranteComite` + 4º TipoSujeto
  (`INTEGRANTE_COMITE`) para monitorear las cuentas de los integrantes.
  Migración + matching + UI. Va aparte por tamaño e impacto en alertas.
- Inbox in-app propiamente dicho para el rector — hoy la `Notificacion`
  con `canal=IN_APP` queda en BD; una futura pantalla la va a listar,
  pero eso no es alcance de este PR.
