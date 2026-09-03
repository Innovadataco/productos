# SPEC-388 (PR B de SPEC-380 · C4/D-100) · Integrantes del comité monitoreados

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: PI-1 · **Origen**: D-100 (Jelkin, 31-08),
segunda pata del brief A-69/C4.

## Problema

Las cuentas de estudiantes, profesores y acudientes se vigilan (SPEC-165):
si alguien reporta uno de esos identificadores en cualquier plataforma, el
colegio recibe la alerta. Los INTEGRANTES DEL COMITÉ DE CONVIVENCIA no
tenían esa vigilancia — son adultos, pero cumplen un rol crítico y sus
cuentas también pueden ser blanco. Jelkin lo decidió en D-100.

## Requisitos

- **FR-001**: Nuevo modelo `IdentificadorIntegranteComite` (mismo shape que
  `IdentificadorProfesor`: soft delete por estado, tenant por colegio, FK a
  `IntegranteComite` y `Plataforma`).
- **FR-002**: `AlertaColegio.identificadorIntegranteComiteId` (nullable) +
  FK + unique parcial `(colegioId, reporteId, identificadorIntegranteComiteId)`
  — misma red dura que los otros tres sujetos contra I-213.
- **FR-003 (CANDADO 22v5 · CEO)**: `TipoSujeto` sigue siendo union TypeScript
  (no enum Prisma), pero el candado **muerde en el compilador**:
  - `Record<TipoSujeto, X>` completo en el DAL (`contarPorTipoSujeto`) y en
    la UI (`TIPO_SUJETO_LABELS`, `TIPO_SUJETO_VARIANTS` de
    `AlertasColegioPageClient` y `CasoDetalleClient`).
  - `switch` con default `never` en `buscarExistente` y `crear` del repo.
  - Los fallbacks silenciosos `?? tipoSujeto` de la versión anterior se
    quitaron — un 5º sujeto sin cubrir hace fallar tsc.
- **FR-004**: `notificarColegioSiCorresponde` amplía a 4 fuentes: agrega el
  matching en `IdentificadorIntegranteComiteRepository.buscarActivosPorValor`
  y arma el candidato con `tipoSujeto: "INTEGRANTE_COMITE"`.
- **FR-005**: API CRUD `/api/colegio/comite/integrantes/[id]/identificadores`
  (GET + POST) y `/[identificadorId]` (PATCH estado). Acceso: SCHOOL_ADMIN o
  COMITE_CONVIVENCIA del colegio dueño; el repo valida que el integrante
  pertenezca al comité del colegio antes de crear.
- **FR-006 (privacidad · CANDADO CEO)**: el aviso va al COLEGIO — jamás a
  la persona vigilada. El propio `notificarColegioSiCorresponde` ya crea la
  alerta colegio-scoped y el motor de notificaciones (SPEC-201) hace el
  resto. Este PR NO abre ningún canal a la persona.
- **FR-007 (UI)**: nuevo panel en `/dashboard/colegio/comite/integrantes/[id]/identificadores`
  con alta y baja inline. Un link "Vigilar identificadores" por fila en la
  lista de integrantes.
- **FR-008 (PDF del caso)**: `pdf-informe-caso` mapea `tipoSujeto` a un
  texto legible ("integrante del comité de convivencia") — no puede decir
  `integrante_comite` en un documento que va a una autoridad.
- **FR-009 (BI)**: la réplica de BI (`005-2026-BI-INTELIGENCIA-NEGOCIO`) NO
  lee `tipoSujeto` (`seed-catalogo.ts` y `mv_fact_bi` solo consumen
  id/colegioId/tipo/resuelta/creadoEn). Confirmado con `grep` — nada que
  contemplar del lado de Kimi.

## Impacto en arquitectura:

- Migración `20260902233000_spec_380b_integrantes_monitor`: nueva tabla + FK
  + unique parcial en `AlertaColegio`. `tipoSujeto` sigue siendo `String`.
- Nuevo repo `IdentificadorIntegranteComiteRepository` (patrón profesor).
- 4ª rama en el matching de `notificarColegioSiCorresponde` y en el detalle
  del caso (`seguimiento.ts`, `alertas.ts`, `alerta-colegio-bandeja.ts`).
- 4º valor en el `z.enum(...)` del filtro `alertaQuerySchema`.
- UI: nueva página + client component; link en la lista de integrantes.

## Fuera de alcance

- Alerta enriquecida al integrante mismo (regla dura: aviso al colegio, no
  a la persona).
- Poblador demo con integrantes vigilados (`scripts/demo/poblar-demo.ts`
  queda igual; no rompe, solo no genera demo de integrantes).
