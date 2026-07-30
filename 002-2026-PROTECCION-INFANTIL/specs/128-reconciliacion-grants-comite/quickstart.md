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

## BD existentes (producción incluida)

Pendiente de la decisión de ZEUS en la compuerta (FR-004, Opciones A/B/C del plan).
Hasta esa decisión: ninguna ejecución contra BD viva. El cierre de la spec documentará la
decisión y, si aplica, la evidencia de la revocación por entorno.
