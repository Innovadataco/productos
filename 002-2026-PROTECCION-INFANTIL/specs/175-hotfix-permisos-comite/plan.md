# Implementation Plan: SPEC-175 — Hotfix I-57 (permiso padre del comité)

**Branch**: `work/002-pi-072` | **Date**: 2026-08-18 | **Spec**: [spec.md](./spec.md)

---

## Summary

Una línea de grant + tests que fijan el candado + comando de aplicación en prod. Cero migraciones, cero cambios de proxy/endpoints/catálogo.

---

## Cambios exactos

### 1. `prisma/seed-modulos-grants.ts` (línea 49)

```ts
// Antes:
COMITE_CONVIVENCIA: ["colegios_comite_bandeja"],
// Después (I-57): la jerarquía AND exige el padre activo.
COMITE_CONVIVENCIA: ["colegios", "colegios_comite_bandeja"],
```

### 2. Aplicación en prod (sin re-desplegar)

El sync es aditivo/idempotente (upsert por `rol_moduloId`). Comando (en el VPS, dentro del contenedor de la app donde vive `.env.production`):

```bash
docker exec -it <contenedor-app> node --import tsx scripts/sync-modulos-grants.ts
# o desde el repo con la DATABASE_URL de prod cargada:
node --env-file=.env.production --import tsx scripts/sync-modulos-grants.ts
```

Efecto: crea el `PermisoModulo` (COMITE_CONVIVENCIA, colegios, activo=true) que falta; no toca ningún otro grant.

### 3. Tests (candado)

- `src/lib/permisos-modulos.test.ts` (o el test existente del área): con grants sembrados como en prod, `modulosPermitidosParaRol("COMITE_CONVIVENCIA")` incluye `colegios_comite_bandeja` (antes del fix: ausente).
- `src/lib/proxy.test.ts`: tras conceder `colegios`, el predicado del comité sigue negando rutas del rector (`/dashboard/colegio`, `/dashboard/colegio/cursos`, `/dashboard/colegio/profesores`, `/dashboard/colegio/configuracion`, `/dashboard/colegio/estadisticas`, `/dashboard/colegio/alertas`, `/dashboard/colegio/auditoria`) y permite su subárbol (`/dashboard/colegio/comite/**`).
- Grep de verificación (documentado en cierre): ningún `assertModulo(..., "colegios")` a secas en `src/app/api/**` ni `verificarAccesoPagina("colegios")` en páginas.

## Fuera de alcance

- No se toca `permisos-catalogo.ts` (la jerarquía está bien; el que estaba mal era el grant).
- No se toca el proxy ni endpoints.
- No se re-despliega la app para aplicar el fix de datos (el sync basta); el PR deja el fix permanente para futuros seeds.

## Verificación

- Gate local: tsc + lint + arch:check + test:unit + test:integration + journeys + build.
- CI del PR verde.
- Prod: tras el sync, el CEO valida que el comité ve su menú/bandeja (SC-001).
