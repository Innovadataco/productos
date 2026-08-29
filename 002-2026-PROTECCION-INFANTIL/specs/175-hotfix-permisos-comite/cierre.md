# Cierre: SPEC-175 — Hotfix I-57 (permiso padre del comité de convivencia)

**Fecha**: 2026-08-18 · **Rama**: `work/002-pi-072` · **Compuerta §4**: APROBADA por ZEUS antes de implementar (zona permisos).

## Qué se implementó

1. **`prisma/seed-modulos-grants.ts`** (fuente única, usada por seed y por `scripts/sync-modulos-grants.ts`):
   - `COMITE_CONVIVENCIA: ["colegios", "colegios_comite_bandeja"]` (era solo el hijo → la jerarquía AND lo dejaba sin nada).
   - `COMITE_VALIDACION: ["comite", "comite_bandeja", "bandeja_reportes", "denuncia_formal"]` (ver Hallazgo).
2. **Tests**:
   - `src/lib/permisos-modulos.test.ts`: regresión I-57 — con los grants REALES del seed (no el "todo a todos" de la suite), el comité de convivencia obtiene `colegios_comite_bandeja` y NO gana ningún módulo del rector.
   - `prisma/seed-security.test.ts`: guard estructural nuevo — **todo rol que recibe un módulo hijo recibe también su padre** (cualquier rol, cualquier módulo). Este guard es el que habría impedido I-57 en origen. Además: el archivo quedó registrado en `vitest.unit.includes.ts` — **no estaba en ninguna config de vitest: nunca corría en el gate** (hallazgo aparte, corregido).
   - El candado de rutas del comité en `proxy.test.ts` ya existía (SPEC-173) y sigue verde.
3. **`docs/architecture/02-roles-capacidades.md`** regenerado (los grants cambiaron; la aserción B del menú sigue verde: la puerta niega las rutas del rector aunque el módulo padre quede concedido).

## HALLAZGO (a la atención de ZEUS) — segunda instancia del mismo bug

El guard estructural atrapó que **`COMITE_VALIDACION`** (comité de plataforma) recibía `comite_bandeja` sin su padre `comite` → su bandeja también estaba inoperante en prod. Misma clase de bug (I-57), mismo fix, mismo candado verificado en fuente: las rutas del módulo `comite` son `ADMIN_ONLY` en el proxy, y los endpoints que lo exigen (`/api/admin/comite/integrantes/**`) verifican `verifyAuth("ADMIN")` antes de `assertModulo`. Conceder el padre no abre nada al comité de plataforma. El test D-43 de `seed-security.test.ts` se actualizó con la razón documentada.

## Aplicación en PROD (sin re-desplegar)

El sync es aditivo/idempotente (upsert; crea los grants faltantes, no revoca nada). En el VPS:

```bash
docker exec -it <contenedor-app> node --import tsx scripts/sync-modulos-grants.ts
# o con la URL de prod cargada:
node --env-file=.env.production --import tsx scripts/sync-modulos-grants.ts
```

Efecto: crea los `PermisoModulo` faltantes (COMITE_CONVIVENCIA→colegios; COMITE_VALIDACION→comite). Los usuarios comité ven su bandeja al siguiente login/refresh.

## Evidencia

- `permisos-modulos.test.ts` 8/8 · `seed-security.test.ts` 7/7 (incl. el guard que ahora fija I-57).
- Gate: tsc ✅ · eslint --no-cache ✅ (0 errores) · arch:check ✅ · tokens ✅ · test:unit 818/818 ✅ · integration full y resto del gate anexos en el PR.

## Nota

- Sin migración, sin cambios de proxy/endpoints/catálogo. Solo grants + tests.
- Independiente de SPEC-173 (ya mergeada en PR #54): el menú de 3 ítems del comité depende de estos grants para pintarse.
