# Feature Specification: SPEC-293 — Fix seed freemium PADRE+COLEGIO (I-156)

**Feature Branch**: `work/002-PI-194`

**Created**: 2026-08-27

**Status**: `PLANEADO`

Impacto en arquitectura: sin cambio de schema. Se corrige la **rama `update` del upsert** de `seedPlanesPagos()` en `prisma/seed.ts` para que los planes freemium (PADRE MES_1 + COLEGIO MES_1 del año actual) queden en el estado correcto (`esFreemium=true`, `activo=true`, `precioBaseCOP=0`, `usosMaximosPorCliente=1`, `nombre` canónico) **aunque las filas ya existan** con estado heredado incorrecto. Se agrega un test de integración `seed-freemium.test.ts` que corre el seed y afirma que quedan exactamente 2 filas freemium activas del año actual.

**Input** (BRIEF-A-43 §1, INSTRUCTIVO §2.1): en prod, `freemium-activacion.service.ts` responde 404 a todo padre nuevo porque no existe `Plan{PADRE, activo=true, esFreemium=true, anio=2026}`. Verificado en BD prod: 11 planes activos, **cero con `esFreemium=true`**.

## Causa raíz (encontrada por reproducción y consulta a prod)

Consulta prod al arranque del ticket:

```
tipoTitular | duracion | anio | activo | esFreemium | precioBaseCOP | nombre
PADRE       | MES_1    | 2026 | f      | f          | (null)        | PADRE · MES_1 · 2026
COLEGIO     | MES_1    | 2026 | t      | f          | 50000         | COLEGIO · MES_1 · 2026
```

- El schema tiene `@@unique([tipoTitular, duracion, anio])`. Las filas para `(PADRE, MES_1, 2026)` y `(COLEGIO, MES_1, 2026)` **ya existen** en prod, sembradas por un seed anterior con el rename cosmético `"<TITULAR> · <DURACION> · <ANIO>"` (probable SPEC-289 o script manual) — pero con `esFreemium=false`.
- `prisma/seed.ts:seedPlanesPagos()` (líneas 665-716) hace `plan.upsert({ where: {tipoTitular_duracion_anio}, update: {}, create: {…esFreemium:true…} })`.
- Como `update` es literal `{}`, el upsert **NO actualiza nada** cuando la fila ya existe (anti-I-100 puro). Los planes MES_1 quedan con el estado heredado incorrecto (`esFreemium=false`, `activo=false` para PADRE, precio no nulo para COLEGIO) para siempre.
- La rama `create` con `esFreemium=true` nunca se ejecuta porque las filas ya existen.
- Consumidor `freemium-activacion.service.ts:78-95` busca `esFreemium=true` → 0 filas → 404.

Repro en dev: BD test limpia + `npx tsx prisma/seed.ts` → 0 planes (porque `seedPlanesPagos` se salta si no hay admin en BD, línea 1803). Con un admin sembrado + un `Plan{PADRE, MES_1, 2026, esFreemium:false}` preexistente + segunda corrida del seed → sigue con `esFreemium=false`. Idéntico a prod.

## Dependencias

- `prisma/seed.ts` (target).
- `src/lib/pagos/freemium-activacion.service.ts` (consumidor, SIN cambio).
- `prisma/schema.prisma` (SIN cambio, D-81: cero migraciones).

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Un padre nuevo puede activar freemium en prod (Priority: P1)

Como padre nuevo quiero completar el registro y activar mi prueba gratis sin recibir 404.

**Independent Test**: en prod, tras deploy: `SELECT COUNT(*) FROM "Plan" WHERE "esFreemium"=true AND activo=true AND anio=2026;` = **2**. `POST /api/pagos/freemium/activar` como padre nuevo devuelve `201` con la suscripción, no `404`.

**Acceptance Scenarios**:
1. **Given** BD con las filas `(PADRE, MES_1, 2026, esFreemium=false, activo=false)` y `(COLEGIO, MES_1, 2026, esFreemium=false, activo=true, precioBaseCOP=50000)` (estado heredado de prod), **When** se corre `prisma db seed`, **Then** ambas filas quedan con `esFreemium=true`, `activo=true`, `precioBaseCOP=0`, `usosMaximosPorCliente=1`, nombre canónico `"Prueba gratis 30 días"` / `"Colegio · Prueba gratis 30 días"`.
2. **Given** BD limpia (sin filas), **When** corre el seed con admin sembrado, **Then** se crean las mismas 2 filas freemium con el mismo estado.
3. **Given** los planes freemium sembrados, **When** el service busca `Plan{PADRE, esFreemium:true, activo:true, anio:2026}`, **Then** devuelve exactamente 1 plan y la activación termina en `201`.

### User Story 2 — Los 11 planes pagos existentes NO se pisan (Priority: P1 · SC-4 brief)

Como admin quiero que mis ediciones a precios de planes pagos (`MES_3`, `MES_6`, `MES_12`) no se pisen por el seed.

**Independent Test**: en dev, editar `Plan{PADRE, MES_3, 2026}.precioBaseCOP = 42999` a mano; correr el seed; verificar que sigue `42999`, no vuelve al default.

**Acceptance Scenarios**:
1. **Given** `Plan{PADRE, MES_3, 2026}` con `precioBaseCOP` editado por el admin, **When** corre el seed, **Then** el precio permanece igual.
2. **Given** BD prod post-fix, **When** se compara con la BD pre-fix, **Then** los 9 planes NO freemium (MES_2/MES_3/MES_6/MES_12 de ambos titulares, más el plan test `SC006-COP-only-lzeu4qs5`) mantienen sus valores.

### User Story 3 — Ratchet CI protege contra regresión (Priority: P1)

Como Fábrica quiero que un cambio futuro del seed que rompa el freemium falle el CI antes de mergear.

**Independent Test**: correr `tests/integration/seed-freemium.test.ts` en el CI: pasa. Introducir un bug (por ejemplo remover el bloque freemium del seed) y correr el test: falla con mensaje legible.

### Edge Cases

- ¿Y si el año cambia (2026 → 2027) sin correr el seed? — el seed usa `new Date().getFullYear()` en zona `America/Bogota` (código actual, no se cambia). Tras el próximo deploy, se crean las 2 filas del año nuevo. Los del año pasado quedan intactos (siguen `activo=true`).
- ¿Y si `pagos.freemium.activo=false` en `ParametroSistema`? — el service ya lo respeta (SPEC-217). El seed no toca ese parámetro (sigue con `update:{}` en `seedParametrosPagos`).
- ¿Y si un admin activa/desactiva el freemium desde el panel? — el update del seed **sí** reescribe `activo=true` y `esFreemium=true` en cada corrida. Se documenta explícitamente que estos dos campos son **canónicos** para el freemium; no se pueden desactivar sembrando: hay que borrar el plan o cambiar el parámetro global. Trade-off consciente para curar el estado heredado roto de prod (el admin puede aún ajustar `precioBaseCOP` de otros planes; en el freemium siempre es 0).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `seedPlanesPagos()` DEBE seguir haciendo `upsert` por clave `[tipoTitular, duracion, anio]` — cero cambio de schema, cero migración.
- **FR-002**: Para las 2 filas freemium (PADRE MES_1 + COLEGIO MES_1 del año actual), la rama `update` del upsert DEBE reescribir estos 5 campos canónicos: `esFreemium=true`, `activo=true`, `precioBaseCOP=0`, `usosMaximosPorCliente=1`, `nombre` canónico. Los demás campos (`descripcion`, `precioBaseUSD`, `creadoPorAdminId`) NO se reescriben.
- **FR-003**: Para las 6 filas de planes **pagos** (MES_3/MES_6/MES_12 de ambos titulares), la rama `update` sigue siendo `{}` (anti-I-100) — el admin puede editar `precioBaseCOP` sin que el seed lo pise.
- **FR-004**: El seed DEBE ser idempotente: dos corridas seguidas dejan el mismo estado que una sola.
- **FR-005**: El seed NO debe crear planes freemium para roles distintos de PADRE y COLEGIO (COMITE, OPERADOR, ADMIN quedan fuera).
- **FR-006**: DEBE existir `tests/integration/seed-freemium.test.ts` (o `src/lib/seed-freemium.test.ts` en la ubicación estándar del proyecto) que corre el seed y afirma:
  - Se pueden encontrar exactamente 2 filas `esFreemium=true, activo=true, anio=<currentYear>`.
  - Los `tipoTitular` de esas 2 filas ordenados son `["COLEGIO", "PADRE"]`.
  - Ambas tienen `precioBaseCOP=0` y `usosMaximosPorCliente=1`.
- **FR-007**: NO se toca `src/lib/pagos/freemium-activacion.service.ts` ni ninguna otra ruta consumidora.
- **FR-008**: NO se toca `prisma/schema.prisma`.
- **FR-009**: NO se retiran planes test residuales (`SC006-COP-only-lzeu4qs5`, MES_2 rotos) — brief de higiene aparte.

### Key Entities

- `prisma/seed.ts:665-716` — `seedPlanesPagos()`, rama `update` del upsert.
- `src/lib/seed-freemium.test.ts` (nuevo) — ratchet CI.

## Success Criteria *(mandatory)*

- **SC-A43-1 (brief §6.1)**: `SELECT COUNT(*) FROM "Plan" WHERE "esFreemium"=true AND activo=true AND anio=<actual>` = **2** en prod post-deploy.
- **SC-A43-2 (brief §6.2)**: `seed-freemium.test.ts` verde en CI.
- **SC-A43-3 (brief §6.3)**: verificación en vivo — padre nuevo registra + activa freemium → `Suscripcion{esFreemium=true, estado=ACTIVA}` en BD.
- **SC-A43-4 (brief §6.4)**: cero regresión — los 9 planes pagos + 1 test residual mantienen su estado (verificado por diff SQL antes/después).
- **SC-A43-5 (brief §6.5)**: `cierre.md` documenta causa raíz + fix aplicado.

## Assumptions

- El `admin` del ID en `creadoPorAdminId` de las filas heredadas sigue existiendo en prod. Si no, no importa: el `update` no reescribe ese campo.
- `pagos.freemium.activo=true` sigue siendo la configuración de prod (verificado en `ParametroSistema` de prod al arranque).
- El nombre canónico del freemium es el que ya está en `planesPorRol` del seed actual: `"Prueba gratis 30 días"` (PADRE) y `"Colegio · Prueba gratis 30 días"` (COLEGIO). El brief sugiere `"PADRE · FREEMIUM · 2026"` pero el seed ya usa la forma actual desde SPEC-243; se conserva por continuidad.
