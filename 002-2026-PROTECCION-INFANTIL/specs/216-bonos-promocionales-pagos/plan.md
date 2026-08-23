# Plan de implementación: SPEC-216 — Bonos promocionales (002-PI-116)

## Resumen

Implementar el backend de aplicación de bonos promocionales: endpoint `POST /api/pagos/aplicar-bono`, servicio de validación y cálculo, registro en `BonoAplicado`, integración con Motor de Notificaciones y `AuditLog`. El CRUD admin del bono es responsabilidad de SPEC-212; aquí solo se consume.

## Contexto técnico

- **Framework**: Next.js 16.2.10 App Router.
- **Lenguaje**: TypeScript 5 con `strict: true`.
- **ORM**: Prisma 5.22.0 sobre PostgreSQL 16.
- **Timezone**: `America/Bogota` en toda aritmética de vigencia (`date-fns-tz`).
- **Patrón DAL**: `src/lib/dal/repositories/pagos-repository.ts`; endpoints no importan `@/lib/prisma`.

## Constitution Check

- ✅ Sin multimedia (los comprobantes siguen siendo URL/mime/hash; no se procesa imagen/video/audio).
- ✅ Presunción de inocencia no aplica en pagos.
- ✅ IA local no se toca.
- ✅ Canales oficiales no afectados.
- ✅ Disputas no afectadas.
- ✅ No se modifica texto original de reportes.

## Estructura del proyecto

### Documentación
```text
specs/216-bonos-promocionales-pagos/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── tasks.md
├── contracts/
│   └── 216-bonos-promocionales.md
└── checklists/
    └── requirements.md
```

### Código (preliminar)
```text
src/app/api/pagos/aplicar-bono/route.ts
src/app/api/pagos/aplicar-bono/route.test.ts
src/lib/pagos/bono-aplicacion.service.ts
src/lib/pagos/bono-aplicacion.service.test.ts
src/lib/pagos/pagos-calculos.service.ts        # combinabilidad descuentos
src/lib/dal/repositories/pagos-repository.ts     # métodos adicionales (modificado)
```

## Cambios de código

### 1. Endpoint `POST /api/pagos/aplicar-bono`

Crear `src/app/api/pagos/aplicar-bono/route.ts`:
- Autenticar con `verifyAuth`.
- Validar rol `SCHOOL_ADMIN` o `PARENT`.
- Leer body `{ codigoBono: string, suscripcionId: string, esNuevaSuscripcion?: boolean }` vía Zod.
- Delegar a `bono-aplicacion.service.ts`.
- Retornar 200 con el descuento calculado o 409 con código canónico.

### 2. Servicio `bono-aplicacion.service.ts`

Responsabilidades:
- Buscar bono por `nombre` (código único) usando `PagosRepository`.
- Validar vigencia con `date-fns-tz` en `America/Bogota`.
- Contar usos globales y por cliente.
- Verificar `aplicaSoloA`, `aplicaANuevos`/`aplicaARenovaciones`.
- Verificar idempotencia: existe `BonoAplicado` para la misma `(bonoId, suscripcionId, pagoId?)`.
- Calcular descuento según tipo.
- Resolver combinabilidad con código referido usando `pagos-calculos.service.ts`.
- Crear `BonoAplicado`.
- Emitir `motor.programar('bono.aplicado', ...)` (opt-out).
- Registrar `AuditLog`.

### 3. Servicio `pagos-calculos.service.ts`

Funciones reutilizables:
- `aplicarMayorDescuento({ baseUSD, descuentoReferidoUSD, descuentoBonoUSD, sonCombinables })`.
- `calcularDescuentoBono({ tipo, valor, baseUSD })`.
- Garantiza `montoNetoUSD >= 0`.

### 4. Repositorio DAL

Extender `pagos-repository.ts` con:
- `obtenerBonoPorNombre(nombre)`.
- `contarUsosBono(bonoId)`.
- `contarUsosBonoPorSuscripcion(bonoId, suscripcionId)`.
- `crearBonoAplicado(data)`.
- `existeBonoAplicado(bonoId, suscripcionId, pagoId?)`.

### 5. Tests

- `route.test.ts`: éxito, bono inexistente, vigencia vencida, tope global, tope cliente, tipo titular, idempotencia, monto negativo.
- `bono-aplicacion.service.test.ts`: combinabilidad con referido, cálculo de descuentos.

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| SPEC-212 aún no mergea el CRUD admin | Consumir `BonoPromocional` por `nombre`; el endpoint no depende de la UI admin, solo del modelo. |
| Motor notif no tiene regla `bono.aplicado` | Verificar en seed; si falta, documentar dependencia y hacer stub con log. |
| Cálculo de descuentos diverge de SPEC-215 | Centralizar en `pagos-calculos.service.ts` compartido. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde: sin imports de `@/lib/prisma` fuera del repositorio.
- Tests de integración del endpoint 100% pasan.
- Evento `bono.aplicado` encolado correctamente (o stub documentado si falta motor).
