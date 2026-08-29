# SPEC-285 — Borrar 3 módulos muertos + revocación explícita

**Radicado**: 002-PI-185 · cierra I-135  
**Tipo**: Higiene  
**Estado**: IMPLEMENTADO  
**Fecha**: 2026-08-26  
**Impacto en arquitectura:** 1 entrada eliminada del catálogo (`padre`) + script de revocación explícita (patrón §5.5). Sin migraciones. Sin cambios de proxy.

---

## Verificación previa del CEO (candado D-002 §3.3)

### Hallazgo 1 — El catálogo ya no tiene `ia_eval` ni `apelaciones`

Verificación en `src/lib/permisos-catalogo.ts` sobre `origin/feature/001-scaffolding@7d856c3b`:

```
grep -n '"ia_eval"\|"apelaciones"\|"padre"' src/lib/permisos-catalogo.ts
24:    { clave: "padre", nombre: "Área del padre", categoria: "padre", orden: 40 },
```

Historial de git confirma:
- `apelaciones` retirado del catálogo en commit `50c85c8b` (SPEC-109, eliminación del módulo de apelación).
- `ia_eval` retirado en commits `76351f8f` / `bca2d842` (SPEC-068 fase 2, retiro Experimentos).

**Único cambio de catálogo en scope: quitar `padre` (línea 24).**

### Hallazgo 2 — El candado `apelaciones` es moot en el catálogo, pero relevante en el script

Las 3 superficies del INSTRUCTIVO se verificaron:

| Superficie | Protección real | Módulo `comite`? |
|-----------|----------------|-----------------|
| `/dashboard/apelaciones/page.tsx` | Ninguna adicional (renderiza `ApelacionesClient`) | No — es surface del ciudadano/PARENT para radicar su propia apelación. Por diseño, cualquier usuario autenticado apela; no es admin. |
| `/api/apelaciones/route.ts` (POST) | `verifyAuth()` | No — mismo motivo: user-scoped, cualquier usuario autenticado puede radicar. |
| `/api/apelaciones/mias/route.ts` (GET) | `verifyAuth()` | No — devuelve solo las apelaciones del usuario autenticado (user-scoped por diseño). |
| `/dashboard/admin/comite/apelaciones/page.tsx` | `puedeAccederAModulo(rol, "comite_bandeja")` | ✓ Sí (`comite_bandeja`, hijo de `comite`) |
| `/api/admin/comite/apelaciones/**` | `assertModulo(user, "comite_bandeja")` | ✓ Sí (`comite_bandeja`, hijo de `comite`) |

Las superficies de admin/comité YA están protegidas por `comite_bandeja` (que a su vez requiere `comite` por jerarquía AND, I-57/SPEC-175). Las superficies de usuario están correctamente sin candado de módulo (radicar apelación no es admin).

`assertModulo("apelaciones")` **no existe en ningún endpoint** — verificado por grep:
```
$ grep -rn "assertModulo.*apelaciones" src/ → 0 resultados
```

**Conclusión candado 1 (CEO): PASA.** El módulo `apelaciones` nunca fue candado activo; su remoción del catálogo (ya hecha en SPEC-109) no abre agujeros. La revocación explícita en BD viva sólo desactiva grants que no protegen nada.

### Hallazgo 3 — `padre` es etiqueta de rol/granularidad, no candado

`grep "assertModulo.*padre\|puedeAccederAModulo.*padre"` → 0 resultados.

Aparece 10+ veces como `categoria: "padre"`, tipos `Granularidad = "padre"`, variantes `NotificacionesVariant = "padre"`, params de queries — nunca como candado de acceso a módulo.

**Conclusión candado 2 (CEO): PASA.** Quitar `padre` del catálogo no rompe ningún candado.

---

## Cambios

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/lib/permisos-catalogo.ts:24` | Eliminar entrada `{ clave: "padre", ... }` |
| 2 | `scripts/revocar-grants-modulos-muertos.ts` | Nuevo script — desactiva `PermisoModulo.activo=false` para `ia_eval`, `apelaciones`, `padre` en todos los roles |
| 3 | `docs/architecture/02-roles-capacidades.md` | Regenerar |
| 4 | `prisma/seed-security.test.ts` | Actualizar si aserta sobre `padre` en el catálogo (verificar) |
| 5 | `specs/285-borrar-modulos-muertos/{spec,plan,tasks}.md` + `specs/README.md` | CI guards + entrada |

---

## Estado final del catálogo (líneas removidas)

Antes (línea 24):
```ts
{ clave: "padre", nombre: "Área del padre", categoria: "padre", orden: 40 },
```

Después: línea removida. `padres` (línea 21, gestión de padres desde admin) permanece.

---

## Script de revocación

Sigue exactamente el patrón §5.5 usado en `revocar-grants-pagos-operador.ts` y `revocar-grants-comite-indebidos.ts`:

- Query: `PermisoModulo` filtrado por `moduloId` cuyo `clave IN ('ia_eval','apelaciones','padre')` y `activo=true`.
- `updateMany({ data: { activo: false } })` — idempotente, no destructivo (no borra filas de `PermisoModulo` ni de `ModuloPermisible`).
- **NO borra las filas de `ModuloPermisible`** (candado del INSTRUCTIVO) — si prod BD tiene módulos que no están en el catálogo, quedan como filas huérfanas del catálogo pero con grants desactivados.
- AuditLog: `accion=LOGS_MANTENIMIENTO_PURGA` + `metadatos.tipo="revocacion_modulos_muertos"` + `metadatos.modulos=["ia_eval","apelaciones","padre"]` + `metadatos.filasRevocadas`.

## Invariantes

- CANDADO §5.5: `sync-modulos-grants.ts` NUNCA revoca. Prod requiere el script post-deploy.
- CERO cambios en `src/lib/ai/**`.
- CERO migraciones.
- CERO cambios en `src/lib/proxy.ts`.
- Alcance mínimo: solo los archivos listados.

---

## Orden de deploy en producción

```
1. git merge (Fábrica)
2. Deploy (CEO)
3. docker compose --env-file .env.production -f docker-compose.prod.yml exec -T app \
     node --import tsx scripts/revocar-grants-modulos-muertos.ts
```

## Verificación en vivo

```sql
SELECT COUNT(*) FROM "PermisoModulo" pm
JOIN "ModuloPermisible" m ON m.id = pm."moduloId"
WHERE m.clave IN ('ia_eval','apelaciones','padre') AND pm.activo;
-- Esperado: 0
```
