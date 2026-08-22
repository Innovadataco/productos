# SPEC-210 · Modelos base Pagos (002-PI-110)

> Status: `PLANEADO`
> PI: 002-PI-110
> Responsable: ODIN
> Rama: `work/002-PI-110`
> Base: `feature/001-scaffolding`

## Contexto

Primera SPEC del Módulo Pagos (SaaS · cobro manual por admin · sin pasarela v1). Deposita el modelo de datos completo del BRIEF-MODULO-PAGOS §5: `Suscripcion`, `Plan`, `Pago`, `BonoPromocional`, `BonoAplicado`, `CodigoReferidoUso`, `TasaCambio`, más los enums de estados, métodos, bonos y fuentes de tasa. También semilla los planes base (rol × duración × año actual) y los parámetros `pagos.*` de §5.8, e inicia el repositorio DAL `src/lib/dal/repositories/pagos-repository.ts`.

Esta SPEC es bloqueante para las 8 SPECs siguientes de la cola Pagos (211-218).

## User Stories

| ID | User Story | Priority |
|---|---|---|
| US-001 | Como sistema, quiero persistir el modelo de datos completo de pagos con tipado fuerte y timestamps tz, para que vigencias, montos, comprobantes y referidos sean consultables y auditables desde el inicio. | Must |
| US-002 | Como operador de deploy, quiero que el seed cree los planes iniciales y parámetros `pagos.*` de forma idempotente, para que cada entorno arranque con el catálogo base sin UPDATE manual. | Must |
| US-003 | Como desarrollador, quiero un repositorio DAL de pagos que aisle a Prisma, para que endpoints y servicios futuros no importen `@/lib/prisma` directamente. | Must |

## Acceptance Scenarios

### AS-001 · Schema completo
**Given** `prisma/schema.prisma`  
**When** se inspeccionan los modelos de pagos  
**Then** existen `Suscripcion`, `Plan`, `Pago`, `BonoPromocional`, `BonoAplicado`, `CodigoReferidoUso`, `TasaCambio`, con los enums del BRIEF §3/§5 y todos los `DateTime` usan `@db.Timestamptz(6)`.

### AS-002 · Migración aditiva
**Given** una base de datos con los modelos `Plan`, `Subscription`, `BillingCycle` placeholder  
**When** se aplica la migración de SPEC-210  
**Then** no se pierden datos, no hay `DROP COLUMN`/`DROP TABLE` y la migración termina con éxito.

### AS-003 · Seed idempotente de planes
**Given** un entorno limpio  
**When** corre `npx prisma db seed`  
**Then** se insertan planes para `COLEGIO` y `PADRE` × duraciones `MES_1`, `MES_2`, `MES_3`, `MES_6`, `MES_12` × año actual (2026), y un segundo seed no genera duplicados.

### AS-004 · Seed idempotente de parámetros
**Given** un entorno donde `pagos.*` ya existen  
**When** cambia la estructura o valor default de un parámetro del motor Pagos  
**Then** el seed usa `update: { ... }` explícito para propagar el cambio (patrón anti-I-100).

### AS-005 · Repositorio DAL
**Given** un endpoint futuro que necesite leer/escribir pagos  
**When** implementa su lógica  
**Then** importa métodos de `src/lib/dal/repositories/pagos-repository.ts`, nunca `@/lib/prisma`.

## Functional Requirements

- **FR-001**: El schema DEBE incluir los 7 modelos del BRIEF §5.1-§5.7.
- **FR-002**: Los enums DEBEN ser en español y alineados al BRIEF §3:
  - `TipoTitular`: `COLEGIO | PADRE`
  - `EstadoSuscripcion`: `ACTIVA | EN_GRACIA | SUSPENDIDA | CANCELADA`
  - `DuracionPlan`: `MES_1 | MES_2 | MES_3 | MES_6 | MES_12`
  - `EstadoPago`: `PENDIENTE_AUTORIZACION | AUTORIZADO | RECHAZADO | REEMBOLSADO`
  - `MetodoPago`: `TRANSFERENCIA | NEQUI | DAVIPLATA | PSE_MANUAL | EFECTIVO | CHEQUE | OTRO`
  - `TipoBono`: `DESCUENTO_PCT | DESCUENTO_FIJO_USD | MESES_GRATIS`
  - `FuenteTasa`: `API | ADMIN_MANUAL`
- **FR-003**: Todos los campos `DateTime` de los modelos de pagos DEBEN usar `@db.Timestamptz(6)`.
- **FR-004**: La migración DEBE ser aditiva: cero `DROP TABLE`, cero `DROP COLUMN`, cero renombre destructivo de columnas con datos.
- **FR-005**: El seed DEBE crear 20 planes iniciales (`2 tiposTitular × 5 duraciones × año 2026`) con `precioBaseUSD` placeholder documentado.
- **FR-006**: El seed DEBE sembrar los 11 parámetros `pagos.*` del BRIEF §5.8 con valores default.
- **FR-007**: El `upsert` de parámetros y planes del motor Pagos DEBE usar `update: { ...campos... }` explícito, con comentario justificativo (patrón anti-I-100).
- **FR-008**: Se DEBE crear `src/lib/dal/repositories/pagos-repository.ts` con métodos CRUD base sobre los 7 modelos.
- **FR-009**: Los modelos `Plan`, `Subscription` y `BillingCycle` placeholder existentes DEBEN mantenerse sin pérdida de datos; los nuevos campos se agregan aditivamente.
- **FR-010**: No se DEBE tocar `src/lib/ai/**` ni migraciones existentes de otros módulos.

## Non-Functional Requirements

- **NFR-001**: Gate local completo: `tsc --noEmit`, `lint --no-cache`, `arch:check`, `test`, `build`.
- **NFR-002**: Migración aplicable con `npx prisma migrate dev` sin destruir datos.
- **NFR-003**: Seed ejecutable dos veces sin errores ni duplicados.
- **NFR-004**: `arch:check` debe verde; el DAL de pagos no expone Prisma a endpoints/servicios.

## Success Criteria

- **SC-001**: Schema contiene 7 modelos de pagos + enums + `@db.Timestamptz(6)` en todos los `DateTime`.
- **SC-002**: Migración aditiva aplica sin destruir datos.
- **SC-003**: Seed inserta planes y parámetros `pagos.*` idempotentemente.
- **SC-004**: `pagos-repository.ts` expone CRUD base y no hay imports de `@/lib/prisma` desde endpoints/servicios de pagos.
- **SC-005**: Gate local completo verde.
- **SC-006**: CI 6/6 verde en el PR a `feature/001-scaffolding`.

## Assumptions

- El BRIEF-MODULO-PAGOS §5 es la fuente canónica del modelo de datos.
- Los modelos placeholder `Plan`, `Subscription`, `BillingCycle` no contienen datos de negocio en producción aún (feature/001-scaffolding).
- El Motor de Notificaciones (SPEC-201..204) ya existe; el catálogo de eventos §10 del BRIEF se sembrará cuando se toque SPEC-213/217.
- SPEC-210 no implementa vistas, worker de vigencia, multi-moneda activa, referidos, bonos ni freemium; solo deja los modelos y seed listos.

## Decisiones propuestas para compuerta §4

1. **Alineación con BRIEF para enums**: se usan los valores exactos del BRIEF §3 (`EstadoSuscripcion` sin `FREEMIUM`; `DuracionPlan` como `MES_1..MES_12`; `EstadoPago` como `PENDIENTE_AUTORIZACION..REEMBOLSADO`). El instructivo indica valores distintos; se señala en compuerta para ratificación de ZEUS.
2. **Campos `monedaLocal`/`monedaOrigen`/`monedaDestino` como `String`**, no enum, para permitir agregar monedas sin migración. Validación por Zod en capa de servicio.
3. **Migración aditiva sobre modelos placeholder**: se agregan columnas nuevas y relaciones; columnas legacy (`precio`, `tenantId`, `planId`) se conservan sin datos críticos, sin renombrar ni borrar.
4. **Seed anti-I-100**: planes y parámetros `pagos.*` usan `update: { ... }` explícito para permitir propagar cambios estructurales en versiones futuras.
5. **DAL único**: todo acceso a datos de pagos pasa por `src/lib/dal/repositories/pagos-repository.ts`.

## Impacto en arquitectura

Cambios en `prisma/schema.prisma` (aditivos), nueva migración Prisma, `prisma/seed.ts` (bloque de pagos), y `src/lib/dal/repositories/pagos-repository.ts`. No se toca el motor IA, el flujo de reportes ni el rate-limit. `BillingCycle` placeholder se deja intacto.

## Deuda Técnica

- Columnas legacy de los modelos placeholder (`Plan.precio`, `Subscription.tenantId`, `Subscription.planId`) quedan en BD. Se podrán limpiar en una SPEC posterior de consolidación cuando se confirme que no hay datos.
- `BillingCycle` no se usa en SPEC-210; se mantiene por compatibilidad con la constitución §2.4.
