# SPEC-266 — Hotfix grants COMITE_VALIDACION

**Radicado**: 002-PI-169  
**Tipo**: Hotfix  
**Estado**: ESPECIFICADO  
**Fecha**: 2026-08-26  

---

## Contexto

I-128: `COMITE_VALIDACION` tiene `bandeja_reportes` y `denuncia_formal` como grants indebidos desde 002-PI-056. Esos módulos pertenecen a la jerarquía del OPERADOR y exponen al comité rutas de anonimización, escalado, baja y transiciones que no le corresponden.

```
bandeja_reportes  →  anonimizar, baja, escalar, transiciones, reactivar, correcciones…
denuncia_formal   →  forense, forense/pdf, denuncia-formal (hijo de bandeja_reportes)
```

### Conflicto heredado de SPEC-263

SPEC-263 añadió `expediente_revelar_original` al comité. En el catálogo ese módulo tiene `padre: "bandeja_reportes"` y el endpoint `revelar-original/route.ts` revisa **ambos** módulos en cadena (línea 21: `bandeja_reportes`; línea 24: `expediente_revelar_original`). Por eso el comité recibió `bandeja_reportes` en SPEC-263 como padre forzado.

La solución limpia es:

1. Convertir `expediente_revelar_original` en módulo **standalone** (sin `padre` en el catálogo).  
2. Eliminar la verificación redundante de `bandeja_reportes` en `revelar-original/route.ts` (solo conservar `expediente_revelar_original`).

Con eso el comité puede tener `expediente_revelar_original` sin necesitar `bandeja_reportes`, y el test de jerarquía AND sigue siendo correcto.

---

## Cambios

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/lib/permisos-catalogo.ts` | Quitar `, padre: "bandeja_reportes"` de la entrada `expediente_revelar_original` |
| 2 | `src/app/api/admin/reportes/[id]/revelar-original/route.ts` | Eliminar línea 21 (`assertModulo(user, "bandeja_reportes")`) |
| 3 | `prisma/seed-modulos-grants.ts` | `COMITE_VALIDACION`: quitar `bandeja_reportes` y `denuncia_formal` |
| 4 | `scripts/revocar-grants-pagos-operador.ts` | Extender con `revocarGrantsComiteIndebidos()` (SPEC-128 pattern) |
| 5 | `prisma/seed-security.test.ts` | Actualizar expect a 4 claves COMITE |
| 6 | `docs/architecture/02-roles-capacidades.md` | Regenerar |
| 7 | `specs/266-hotfix-grants-comite/tasks.md` | CI guard |
| 8 | `specs/README.md` | Entrada SPEC-266 |

---

## Estado final de COMITE_VALIDACION

```
["comite", "comite_bandeja", "comite_guias_accion", "expediente_revelar_original"]
```

OPERADOR no cambia. ADMIN no cambia.

---

## Invariantes

- **CANDADO §5.5**: `sync-modulos-grants.ts` NUNCA revoca. Las BD vivas requieren el script de revocación.  
- **SPEC-128 pattern**: `updateMany({ where: { rol, moduloId: { in: ids }, activo: true }, data: { activo: false } })` — idempotente, no destructivo.  
- **Anti-I-100**: seed usa upsert sin `update:`.  
- Sin migración de schema — solo grants en `PermisoModulo` y edición del catálogo TS en memoria.

---

## Orden de deploy en producción

```
1. prisma migrate deploy          (si hay migraciones; aquí no hay)
2. npx tsx prisma/sync-modulos-grants.ts
3. npx tsx scripts/revocar-grants-pagos-operador.ts   (ahora incluye revocarGrantsComiteIndebidos)
```
