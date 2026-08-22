# Research — SPEC-210

## Hallazgos verificados en fuente

### Schema actual
- `prisma/schema.prisma` contiene modelos placeholder `Plan`, `Subscription`, `BillingCycle` desde la constitución §2.4.
- `Plan` solo tiene `id`, `nombre`, `descripcion`, `precio`, `creadoEn`.
- `Subscription` solo tiene `id`, `tenantId`, `planId`, `estado` (String), `iniciaEn`, `terminaEn`, `creadoEn`.
- `BillingCycle` solo tiene `id`, `subscriptionId`, `monto`, `estado` (String), `periodoInicio`, `periodoFin`, `creadoEn`.
- No existen modelos `Pago`, `BonoPromocional`, `BonoAplicado`, `CodigoReferidoUso`, `TasaCambio` ni enums de pagos.
- `Colegio` y `Usuario` no tienen relaciones inversas a suscripciones/pagos.

### DAL
- `src/lib/dal/repositories/` existe con ~100 repositorios. No hay `pagos-repository.ts`.
- El patrón es un archivo por dominio con funciones puras que reciben `PrismaClient` o usan el singleton importado internamente.

### Seed
- `prisma/seed.ts` ya tiene patrón anti-I-100 aplicado en parámetros estructurales (ver SPEC-199).
- El admin inicial se crea en el seed; se puede reusar su `id` para `creadoPorAdminId`.

### Docker dev
- `docker-compose.yml` no tenía servicio `app`; se agregó `TZ: America/Bogota` como deuda inline I-102 heredada de SPEC-200.

## Decisiones tomadas

1. **Alineación con BRIEF §3/§5** para nombres y valores de enums, aunque el instructivo propone valores alternativos.
2. **Campos de moneda como `String`** para evitar migraciones por cada nueva moneda local.
3. **Migración aditiva sobre placeholders**: se conservan columnas legacy (`precio`, `tenantId`, `planId`) y se agregan columnas nuevas.
4. **Seed anti-I-100** para planes y parámetros `pagos.*`.
5. **Repositorio DAL nuevo** siguiendo el patrón existente del proyecto.

## Conflictos detectados vs instructivo

| Tema | Instructivo | BRIEF (fuente canónica) | Decisión propuesta |
|---|---|---|---|
| `EstadoSuscripcion` | `FREEMIUM\|ACTIVA\|EN_GRACIA\|SUSPENDIDA\|CANCELADA` | `ACTIVA\|EN_GRACIA\|SUSPENDIDA\|CANCELADA`; freemium = `ACTIVA + esFreemium=true` | Seguir BRIEF; señalar a ZEUS |
| `DuracionPlan` | `MENSUAL\|SEMESTRAL\|ANUAL` | `MES_1\|MES_2\|MES_3\|MES_6\|MES_12` | Seguir BRIEF; señalar a ZEUS |
| `EstadoPago` | `RECIBIDO\|AUTORIZADO\|RECHAZADO\|REEMBOLSADO` | `PENDIENTE_AUTORIZACION\|AUTORIZADO\|RECHAZADO` (+ `REEMBOLSADO` §7.6) | Seguir BRIEF (`PENDIENTE_AUTORIZACION`); señalar a ZEUS |
| `Moneda` | enum `COP\|USD\|EUR\|MXN\|...` | `String monedaLocal` / `monedaDestino` | `String`; señalar a ZEUS |

## Dependencias

- Motor de Notificaciones (SPEC-201..204) ya existe; el catálogo de eventos §10 del BRIEF se sembrará cuando se implementen SPEC-213/217.
- SPEC-210 no depende de vistas ni de worker de vigencia.
