# SPEC-010 · CLI catálogo BI

## Metadatos

| Campo | Valor |
|---|---|
| **SPEC** | 010 |
| **Nombre** | cli-catalogo |
| **Origen** | BI · INSTRUCTIVO-006 · F3C 2026-08-28 COT |
| **Brief** | BI · A-04 §3.4 |
| **Estado** | ⏳ spec+plan listo · implementación pendiente (REVISO) |
| **Depende de** | SPEC-007 CUMPLE (schema Prisma existe) · SPEC-008 CUMPLE (datos sembrados) |

---

## Objetivo

Crear `scripts/catalogo-cli.mjs` (ESM · Node.js) con 6 comandos que permiten a Fábrica BI-2 gestionar el catálogo sin acceder al código. Tests unitarios para add, list y aprobar-cache.

---

## Los 6 comandos

| Comando | Acción |
|---|---|
| `list-tablas` | Lista tablas activas del catálogo |
| `add-tabla <nombre> --legible "X" --descripcion "Y" --roles ADMIN,SCHOOL_ADMIN` | Crea o actualiza tabla (upsert) |
| `add-ejemplo --pregunta "X" --sql "Y" --categoria reportes` | Añade ejemplo NL→SQL |
| `list-consultas --usuario X --dias 7` | Muestra traza de consultas (candado 12) |
| `aprobar-cache <consulta_id>` | Mueve consulta buena a `bi_cache_semantico` (candado 7) |
| `list-metricas` | Lista métricas de negocio activas |

### Uso

```bash
node scripts/catalogo-cli.mjs list-tablas
node scripts/catalogo-cli.mjs add-tabla Reporte --legible "Reportes de riesgo" \
  --descripcion "Reportes de conducta PI" --roles ADMIN,SCHOOL_ADMIN
node scripts/catalogo-cli.mjs aprobar-cache abc123def
```

### Dependencias

- `@prisma/client` (ya instalado en SPEC-007)
- Sin dependencias externas adicionales — solo Node.js built-ins + Prisma

### Conexión BD

Lee `BI_ADMIN_DATABASE_URL` de `.env.bi.production` (o variable de entorno). Si no existe → error claro.

### Documentación

`scripts/README.md` con ejemplos de cada comando y flujo de trabajo Fábrica → catálogo.

---

## Tests unitarios (tests/unit/catalogo-cli.test.ts)

```typescript
describe("catalogo-cli", () => {
  it("list-tablas devuelve array con nombreFuente", ...)
  it("add-tabla hace upsert idempotente", ...)
  it("list-consultas filtra por usuario y dias", ...)
  it("aprobar-cache mueve a bi_cache_semantico", ...)
})
```

Tests usan BD de test (`BI_ADMIN_DATABASE_URL` del `.env.test` local) · no BD prod.

---

## Fuera de alcance

- UI web para gestión catálogo (BRIEF-A-08)
- Comandos de refresh de vistas (eso es SPEC-009)
- Autenticación web / JWT

---

## Candados aplicables

| Candado | Aplicación |
|---|---|
| 7 · Cache semántico de veredictos humanos | `aprobar-cache` implementa el flujo de aprobación |
| 12 · Traza completa por consulta | `list-consultas` expone la traza |
| Payload real en tests | Tests usan misma BD que seed |

---

## 📋 Control

| Campo | Valor |
|---|---|
| **Versión** | v1.0 |
| **F3C** | 2026-08-28 COT |
| **Autor** | bi-dev-2 (Desarrollo BI) |
| **Estado** | ⏳ spec+plan · REVISO pendiente |
