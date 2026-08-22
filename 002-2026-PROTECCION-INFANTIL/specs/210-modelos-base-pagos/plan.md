# Plan de implementación: SPEC-210 — Modelos base Pagos (002-PI-110)

## Resumen

Depositar el modelo de datos del Módulo Pagos en `prisma/schema.prisma` de forma aditiva, crear la migración Prisma, sembrar planes base y parámetros `pagos.*` en `prisma/seed.ts`, e iniciar el repositorio DAL en `src/lib/dal/repositories/pagos-repository.ts`. Cero vistas, cero worker, cero motor de vigencia en esta SPEC.

## Contexto técnico

- **Framework**: Next.js 16.2.10 App Router.
- **Lenguaje**: TypeScript 5 con `strict: true`.
- **ORM**: Prisma 5.22.0 sobre PostgreSQL 16.
- **Timezone**: `America/Bogota` en servicio app (I-102 cerrada en este PR).
- **Patrón DAL**: repositorios en `src/lib/dal/repositories/**`; endpoints/servicios no importan `@/lib/prisma`.

## Constitution Check

- ✅ Sin multimedia (los comprobantes se almacenan como URL/mime/hash de texto; no se procesa imagen/video/audio).
- ✅ Presunción de inocencia no aplica en pagos.
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/210-modelos-base-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
prisma/schema.prisma              # modelos + enums de pagos (aditivo)
prisma/migrations/                # migración aditiva generada + ajustada manual si aplica
prisma/seed.ts                    # bloque de planes + parámetros pagos.*
src/lib/dal/repositories/pagos-repository.ts
src/lib/dal/repositories/pagos-repository.test.ts
```

## Cambios de código

### 1. Schema Prisma — modelos de pagos

Añadir enums:
- `TipoTitular`, `EstadoSuscripcion`, `DuracionPlan`, `EstadoPago`, `MetodoPago`, `TipoBono`, `FuenteTasa`.

Añadir/modelificar modelos:
- `Suscripcion` (nuevo; relaciones a `Colegio`, `Usuario`, `Plan`).
- `Plan` (enriquecer placeholder; añadir `tipoTitular`, `duracion`, `año`, `precioBaseUSD`, `descuentoAnualPct`, `activo`, `descripcion`, `creadoPorAdminId`, relaciones).
- `Pago` (nuevo; relaciones a `Suscripcion`, `Usuario`, `BonoAplicado`).
- `BonoPromocional` (nuevo).
- `BonoAplicado` (nuevo).
- `CodigoReferidoUso` (nuevo; relaciones dobles a `Suscripcion`).
- `TasaCambio` (nuevo).

Añadir relaciones inversas en `Colegio` y `Usuario`.

Mantener sin tocar:
- `Subscription` placeholder: se deja tal cual; `Suscripcion` es el modelo operativo.
- `BillingCycle` placeholder: se deja tal cual.
- Campos legacy de `Plan` (`precio`) se conservan.

### 2. Migración aditiva

Generar con `npx prisma migrate dev --name pagos_modelos_base`. Revisar el SQL producido: no debe contener `DROP TABLE`, `DROP COLUMN` ni renombres destructivos. Si Prisma propone renombrar columnas legacy, corregir la migración manualmente para que sea aditiva.

### 3. Seed idempotente

En `prisma/seed.ts`, crear funciones:
- `seedPlanesPagos(adminId: string)`: upsert de 20 planes (2 titulares × 5 duraciones × 2026) con `precioBaseUSD = 0` placeholder y comentario.
- `seedParametrosPagos()`: upsert de los 11 parámetros `pagos.*` del BRIEF §5.8.

Ambos usan `update: { ... }` explícito para propagar cambios estructurales (anti-I-100). El primer seed es INSERT limpio.

### 4. Repositorio DAL

Crear `src/lib/dal/repositories/pagos-repository.ts` con métodos base:
- `crearSuscripcion(data)`, `obtenerSuscripcionPorId(id)`, `obtenerSuscripcionPorColegio(colegioId)`, `obtenerSuscripcionPorUsuario(usuarioId)`, `actualizarSuscripcion(id, data)`.
- `crearPlan(data)`, `obtenerPlanPorId(id)`, `obtenerPlanesActivos(filtros)`, `actualizarPlan(id, data)`.
- `crearPago(data)`, `obtenerPagoPorId(id)`, `obtenerPagosPorSuscripcion(suscripcionId)`, `actualizarPago(id, data)`.
- `crearBonoPromocional(data)`, `obtenerBonoPorId(id)`, `listarBonosActivos()`.
- `crearBonoAplicado(data)`, `listarBonosAplicados(suscripcionId)`.
- `crearCodigoReferidoUso(data)`, `contarReferidosExitososPorAnio(referidorId, año)`.
- `crearTasaCambio(data)`, `obtenerTasaCambioMasReciente(monedaDestino)`.

Tipos de entrada/salida en `src/lib/dal/types/pagos.ts` si aplica.

### 5. Tests

- Test de integración del seed: verifica que corra dos veces sin duplicados y que `pagos.*` se actualicen con `update` explícito.
- Test unitario de `pagos-repository.ts`: CRUD básico sobre cada modelo usando la BD de test.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migración no es aditiva por modelos placeholder | Revisar SQL manualmente; usar `@map` o columnas nuevas sin renombrar |
| Conflictos de enum con instructivo | Señalar en compuerta §4; esperar ratificación de ZEUS |
| Seed duplica planes | `@@unique([tipoTitular, duracion, año])` + upsert |
| DAL expone Prisma | `arch:check` valida; no importar `@/lib/prisma` fuera del repo |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde.
- `npx prisma migrate dev` aplica sin destruir datos.
- `npx prisma db seed` idempotente.
- `pagos-repository.ts` cubre CRUD base de los 7 modelos.
