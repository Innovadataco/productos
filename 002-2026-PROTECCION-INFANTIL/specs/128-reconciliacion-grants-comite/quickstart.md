# Quickstart: SPEC-128 — Reconciliación de grants del comité

Verificación de los criterios de aceptación del instructivo 002-PI-043 que aplican a esta
spec. Ejecutar desde `002-2026-PROTECCION-INFANTIL/` tras implementar.

## Criterio 3 — BD fresca: comité solo con comite_bandeja; ADMIN conserva todo

```bash
# Seed sobre la PostgreSQL de pruebas (misma del .env.test), luego verificar:
npx prisma db seed   # o el test de verificación del seed incluido en la spec
```

Consulta de verificación (Prisma Studio o SQL):

```sql
SELECT m.clave FROM "PermisoModulo" pm
JOIN "Modulo" m ON m.id = pm."moduloId"
WHERE pm.rol = 'COMITE_VALIDACION' AND pm.activo = true;
-- Esperado: exactamente una fila: comite_bandeja
```

Y ADMIN:

```sql
SELECT count(*) FROM "PermisoModulo" pm
WHERE pm.rol = 'ADMIN' AND pm.activo = true;
-- Esperado: total de módulos del catálogo (incluye comite y comite_auditoria)
```

Catálogo intacto:

```sql
SELECT clave FROM "Modulo" WHERE clave IN ('comite', 'comite_auditoria');
-- Esperado: ambas filas presentes
```

## Criterio 2 — Suite completa + tsc + build verdes

```bash
npm run test && npx tsc --noEmit && npm run build
```

Incluye `src/lib/e2e/journeys/aislamiento.test.ts` ("el comité no se autogestiona") verde y
SIN modificaciones.

## Criterio 4 — arch:check verde con artefactos regenerados

```bash
npx tsx scripts/arch/generar-roles-capacidades.ts   # regenera 02-roles-capacidades.md
npm run arch:check
```

- `docs/architecture/02-roles-capacidades.md` ya no lista `comite`/`comite_auditoria` para
  COMITE_VALIDACION en la tabla módulo → rol.
- `arch:check` VERDE (drift cero, huérfanos, aserción A, aserción B).

## Criterio 5 — Aserciones A y B verdes, sin allowlist nueva

Cubiertas por `arch:check`. Verificar en la salida: aserción A VERDE, aserción B VERDE,
`scripts/arch/excepciones.json` sin cambios y ninguna allowlist nueva en las aserciones.

## Verificación de los candados

```bash
git diff pre-cola-043 -- prisma/seed.ts src/lib/nav-items.ts src/lib/permisos-catalogo.ts
```

- El diff de `seed.ts` DEBE limitarse a la entrada `COMITE_VALIDACION` de `clavesPorRol`
  (y su comentario).
- `nav-items.ts` y `permisos-catalogo.ts` DEBEN salir sin diff.

## BD existentes (producción incluida) — Opción A APROBADA por ZEUS

El mecanismo decidido en la compuerta es la **Opción A**: script puntual de revocación
`scripts/revocar-grants-comite-muertos.ts` (idempotente, no destructivo: `activo=false`,
no borra módulos ni filas). Ya probado en la BD de desarrollo (2 grants desactivados;
segunda corrida: 0 cambios) y cubierto por `scripts/revocar-grants-comite-muertos.test.ts`
en CI.

**Paso de despliegue para el CEO (producción — NO lo corre ODIN):**

```bash
# En el VPS, con el .env de producción cargado:
cd 002-2026-PROTECCION-INFANTIL
node --env-file=.env --import tsx scripts/revocar-grants-comite-muertos.ts
# Salida esperada: "Revocación: completada — 2 grants desactivados (comite, comite_auditoria)"
# Verificación: los grants activos del comité NO incluyen comite ni comite_auditoria;
# comite_bandeja sigue activo. Re-correrlo es seguro (idempotente).
```

Momento: junto al próximo despliegue a producción. Hasta entonces, producción conserva
los grants muertos como dato inerte (D-41 ya oculta las tabs; la puerta ya niega las rutas).
