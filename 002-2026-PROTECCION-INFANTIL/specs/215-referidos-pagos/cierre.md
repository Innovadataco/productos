# Cierre — SPEC-215 · Código de referido (002-PI-115)

> Fecha: 2026-08-24 · Responsable: ODIN (subagente, mega-lote) · Rama: `work/002-PI-mega-cola-restante`

## Alcance implementado

- **Generación de códigos (FR-001..FR-003)**: `src/lib/utils/referido-codigo.ts` (generador puro `PI-<TIPO>-<HASH8>` sin O/0/I/1) + auto-generación con reintento anti-colisión en `PagosRepository.crearSuscripcion` cuando `codigoReferidoPropio` no viene.
- **Aplicación de códigos (FR-004..FR-006, FR-009)**: `src/lib/pagos/referido.service.ts` (`aplicarCodigoReferido`) + endpoint `POST /api/pagos/aplicar-referido` (SCHOOL_ADMIN/PARENT, titularidad, Zod, rate limit `pagos_write`). Validaciones: código activo (ACTIVA/EN_GRACIA), anti-autorreferido (suscripción/colegio/usuario/email), duplicado (referidor, referida), tope anual de exitosos en año Bogotá. Crea `CodigoReferidoUso`, emite `referido.registrado` y audita `REFERIDO_REGISTRADO`.
- **Recompensas (FR-007, FR-008)**: `procesarRecompensasPagoAutorizado` invocado como hook fail-open desde la autorización admin de pagos (evento interno `pago.autorizado`). Activa el uso, aplica el descuento del parámetro al pago si aún no se calculó, otorga 1 mes gratis al referidor como extensión de `fechaFin` (Decisión 3), emite `referido.recompensa.otorgada`, y al N-ésimo uso (`pagos.referidos.notificar_admin_al`, default 4) marca `requiereRevisionAdmin` y emite `referido.tope_anual` al referidor y a los admins. Audita `REFERIDO_RECOMPENSA_OTORGADA`.
- **DAL (FR-011)**: consultas nuevas en `src/lib/dal/repositories/pagos-referidos-repository.ts` (ver desviación 1).
- **Schema/seed**: `AccionAudit` + `REFERIDO_REGISTRADO`/`REFERIDO_RECOMPENSA_OTORGADA` (migración aditiva `20260824090000_spec_215_referidos_accion_audit`); seed del parámetro `pagos.referidos.descuento_referido_pct` (15) y de plantillas + reglas de los eventos `referido.registrado`, `referido.recompensa.otorgada`, `referido.tope_anual`.

## Desviaciones de la spec

1. **FR-011 (PagosRepository único)**: las consultas de referidos viven en el nuevo `PagosReferidosRepository`. `PagosRepository` ya rozaba el techo de 500 líneas del lint (`max-lines`) y agregarlas ahí rompía el gate; se siguió el precedente de SPEC-211 (`PagosClienteRepository`). La frontera DAL se mantiene.
2. **Tope anual en la aplicación**: ante la contradicción AS-005 ("se registra el uso pero no se otorga recompensa") vs contrato (409 `referido_tope_anual`), se eligió rechazar con 409 en la aplicación (FR-005 + contrato; SC-002 admite ambas). La semántica de AS-005 queda cubierta en la activación: si el tope se alcanza entre registro y autorización, el uso se activa sin recompensa y queda `requiereRevisionAdmin`.
3. **Anti-autorreferido por email**: el modelo `Usuario` no tiene `documento`; se compara email (más colegio/usuario/suscripción), como prevé la Decisión 2.
4. **"Mes gratis"**: se materializa como extensión inmediata de `fechaFin` del referidor si está ACTIVA/EN_GRACIA (FR-007 "extensión de vigencia si aplica"); si no, queda `requiereRevisionAdmin`. La Decisión 3 original (aplicarlo en la próxima renovación) requeriría un campo de crédito que no existe — queda como deuda.
5. **T004**: no existe aún un servicio de creación de suscripciones (llega con SPEC-217); la generación automática se integró en `PagosRepository.crearSuscripcion`, hoy único punto de creación, por lo que cubre todos los flujos presentes y futuros.

## Verificación

- `npx tsc --noEmit`: 0 errores en archivos de la spec (errores ajenos en progreso de otros subagentes: `analisis/recomendaciones/resolver`, `KpiPagosCards.tsx`, `ComiteBandeja.tsx`, `analitica.service.ts`).
- `npm run test:unit -- src/lib/utils/referido-codigo.test.ts`: 8/8 verde.
- Tests de integración escritos (no corridos — BD compartida, los corre el coordinador): `src/app/api/pagos/aplicar-referido/route.test.ts` (10 casos), `src/lib/pagos/referido.service.test.ts` (8 casos).
- ESLint limpio en todos los archivos nuevos de la spec.
- Hallazgo transversal: `pagos-repository.ts` supera `max-lines` (568) por adiciones paralelas de otros subagentes; la contribución de SPEC-215 ahí son ~35 líneas (auto-generación del código). Requiere decisión del coordinador (extraer métodos a otro repositorio).

## Deuda técnica

- Recompensa del referidor como crédito aplicado en la próxima renovación (Decisión 3 original) en vez de extensión inmediata.
- El flujo de renovación (SPEC-211) aplica el descuento por código sin crear `CodigoReferidoUso`; el programa formal se registra vía `POST /api/pagos/aplicar-referido`. Unificar cuando exista el servicio de creación de suscripciones (SPEC-217).
- `referido.tope_anual` al 4º uso depende del seed de reglas/plantillas incluido en este cierre.
