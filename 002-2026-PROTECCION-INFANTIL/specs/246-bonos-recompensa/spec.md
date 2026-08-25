# Feature Specification: Extensión `BonoPromocional` recompensa + cupones transferibles + MisCuponesCard

**Feature Branch**: `work/002-PI-mega-cobros` (SPEC-246 dentro del mega-lote 2)  
**SPEC**: 246  
**Created**: 2026-08-25  
**Status**: PLANEADO  
**Input**: INSTRUCTIVO-002-PI-149 · BRIEF-ACTIVACION-Y-COBROS §3/§6.1/§6.3/§8/§10/§11 Lote 2 #7 · D-52/D-69/D-72/D-74

Impacto en arquitectura: extiende el modelo `BonoPromocional` existente (SPEC-216) con `origen OrigenBono`, `beneficiarioUsuarioId String?` y `transferible Boolean`; crea enum `OrigenBono { PROMOCION_ADMIN, RECOMPENSA_PAGO }`; agrega servicio `entregarCuponesRecompensa` disparado desde la autorización de SPEC-245 (evento `suscripcion.activada` o callback directo); genera códigos `CUP-XXXXXX`; agrega componente `MisCuponesCard` en `/dashboard/padre/suscripcion`; permite aplicar cupones transferibles en checkout (`AplicarBonoCard` de SPEC-211); emite evento `bono.entregado_recompensa` (EMAIL+IN_APP). Sin crear módulo Cupones nuevo ni rutas paralelas.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Padre recibe cupones tras primer pago pagado (Priority: P1)

Cuando un admin autoriza una suscripción pagada de un padre (origen `ACTIVADA_MANUAL_ADMIN` o `SOLICITADA_CLIENTE` sobre plan no freemium), el sistema genera 5 cupones de recompensa (`CUP-XXXXXX`) con 20% de descuento, vigencia 90 días y los entrega al padre.

**Why this priority**: Incentiva recompra y referidos; cierra la promesa de recompensa del brief.

**Independent Test**: Al autorizar una suscripción pagada de padre, se generan 5 bonos `RECOMPENSA_PAGO` y se emite `bono.entregado_recompensa`.

**Acceptance Scenarios**:

1. **Given** una suscripción padre pagada autorizada, **When** el flujo de SPEC-245 confirma, **Then** se ejecuta `entregarCuponesRecompensa` y se crean 5 códigos únicos.
2. **Given** un padre que ya recibió recompensa, **When** se autoriza otra suscripción pagada, **Then** no se generan nuevos cupones (idempotencia dura).
3. **Given** una activación freemium, **When** ocurre, **Then** NO se generan cupones de recompensa.
4. **Given** un colegio como titular, **When** se autoriza, **Then** NO se generan cupones (solo padres).

### User Story 2 — Padre ve y comparte sus cupones (Priority: P1)

En `/dashboard/padre/suscripcion` el padre ve una tarjeta `MisCuponesCard` con sus códigos, % descuento, vigencia y estado. Puede copiar el código para compartirlo.

**Why this priority**: Completa la experiencia del programa de recompensas.

**Independent Test**: `MisCuponesCard` renderiza solo cupones `RECOMPENSA_PAGO` del padre autenticado.

**Acceptance Scenarios**:

1. **Given** un padre con cupones activos, **When** accede a suscripción, **Then** ve `MisCuponesCard` con códigos copiables.
2. **Given** un cupón usado, **Then** se muestra como "Usado".
3. **Given** un cupón vencido, **Then** se muestra como "Vencido".

### User Story 3 — Cupón transferible en checkout (Priority: P1)

Un colegio puede aplicar en su checkout un cupón `RECOMPENSA_PAGO` que un padre le compartió. El sistema acepta el código si es válido, activo y `transferible=true`.

**Why this priority**: Habilita viralidad B2B2C.

**Independent Test**: Colegio aplica cupón de padre y obtiene descuento.

**Acceptance Scenarios**:

1. **Given** un cupón `transferible=true`, **When** cualquier usuario con el código lo aplica, **Then** se aplica el descuento.
2. **Given** un cupón `transferible=false`, **When** un usuario distinto al beneficiario lo aplica, **Then** se rechaza.

---

## Edge Cases

- **Colisión de código**: generación con retry hasta obtener 5 códigos únicos.
- **Tope máximo COP**: si `pagos.recompensa.tope_max_cop` está configurado, se aplica al bono.
- **Un solo uso**: cada código es canjeable una sola vez (`usosMaximosPorCliente=1`, `usosMaximosTotales=1`).
- **Aplicación de cupón vencido**: el servicio de aplicación existente rechaza.
- **Admin no crea recompensas manuales**: filtro de solo lectura en admin `/dashboard/admin/bonos`.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE extender `BonoPromocional` con `origen OrigenBono @default(PROMOCION_ADMIN)`, `beneficiarioUsuarioId String?` y `transferible Boolean @default(true)`.
- **FR-002**: El sistema DEBE crear enum `OrigenBono { PROMOCION_ADMIN, RECOMPENSA_PAGO }`.
- **FR-003**: El sistema DEBE crear servicio `entregarCuponesRecompensa(padreUsuarioId, contexto)` idempotente (una entrega por padre por vida).
- **FR-004**: El sistema DEBE generar `pagos.recompensa.cupones_por_pago` códigos con formato `CUP-XXXXXX`, vigencia `now(Bogotá)+pagos.recompensa.vigencia_dias`, porcentaje `pagos.recompensa.porcentaje_descuento`.
- **FR-005**: El sistema DEBE disparar la entrega desde la autorización de SPEC-245 (evento `suscripcion.activada` o callback) para planes pagados de padres.
- **FR-006**: El sistema DEBE emitir evento `bono.entregado_recompensa` con payload `{padreUsuarioId, codigos: string[], porcentaje, vigencia}`.
- **FR-007**: El sistema DEBE crear `MisCuponesCard` en `/dashboard/padre/suscripcion` (rol PARENT).
- **FR-008**: El sistema DEBE permitir aplicar cupón `transferible=true` por cualquier usuario con el código en `AplicarBonoCard`.
- **FR-009**: El sistema DEBE sembrar parámetros `pagos.recompensa.*` y plantilla/regla de `bono.entregado_recompensa` idempotentemente.
- **FR-010**: El sistema DEBE registrar `AuditLog` de entrega de recompensa.

### Key Entities

- `BonoPromocional`: extensión con origen, beneficiario, transferible.
- `Suscripcion`: trigger de entrega.
- `Usuario`: beneficiario padre.
- `AplicarBonoCard`: aplicación en checkout.

---

## Success Criteria *(mandatory)*

- **SC-001**: Autorización de suscripción pagada padre genera exactamente 5 códigos `CUP-XXXXXX` únicos.
- **SC-002**: Segunda autorización del mismo padre no genera más cupones.
- **SC-003**: Freemium y colegios no disparan entrega de recompensa.
- **SC-004**: `MisCuponesCard` muestra cupones con estado, vigencia Bogotá y botón copiar.
- **SC-005**: Cupón transferible aplica a usuario distinto al beneficiario; no transferible rechaza.
- **SC-006**: CI verde 11/11.

---

## Assumptions

- SPEC-245 ya implementa la autorización y emite `suscripcion.activada`.
- `BonoPromocional` y `AplicarBonoCard` de SPEC-216/211 ya están en prod.
- Los parámetros `pagos.recompensa.*` se siembran en este SPEC.
