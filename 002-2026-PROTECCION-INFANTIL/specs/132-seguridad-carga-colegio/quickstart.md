# Quickstart: SPEC-132 — Seguridad de la carga masiva del colegio

Validación guiada tras implementar (dev).

## S-3 — Parser con exceljs (fidelidad y límites)

```bash
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run src/lib/colegio/carga
```

- Los fixtures de `parser.test.ts` pasan SIN cambiar expectativas (fechas, encoding,
  columnas, errores por fila).
- Un archivo > `carga.max_archivo_bytes` o con más de `carga.max_filas` se rechaza con
  mensaje claro (tests incluidos).
- `package.json` ya no lista `xlsx`; el build de producción no lo empaqueta.

## S-4 — Roster fuera del token

1. Sube un Excel válido en `/dashboard/colegio/cursos/carga` y valida: la respuesta trae
   `tokenConfirmacion`.
2. Decodifica el JWT (payload): contiene SOLO `{ sesionId, colegioId }` — SIN nombres ni
   identificadores de alumnos.
3. Confirma: la importación se ejecuta igual que antes (alumnos creados).
4. Re-valida con el mismo token tras 15 min (o borrando la sesión): rechazo claro
   ("la validación expiró, vuelve a validar").
5. Un token de otra sesión/colegio: rechazado.

## Limpieza TTL

```bash
# Las sesiones vencidas no se usan y el job del worker las borra:
docker exec 002-2026-proteccion-infantil-db-1 psql -U proteccion -d proteccion_infantil \
  -c 'SELECT count(*) FROM "CargaRosterSesion" WHERE "expiraEn" < now();'
```

## Gates

```bash
npx tsc --noEmit && npm run lint && npm run test && npm run build && npm run arch:check
```

Todo verde; `01-modelo-datos.md` regenerado por la tabla nueva.
