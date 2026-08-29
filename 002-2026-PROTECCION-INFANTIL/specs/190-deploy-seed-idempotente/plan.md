# Plan de implementación: SPEC-190 — Deploy ejecuta seed idempotente (002-PI-085)

## Resumen

Dos cambios principales:
1. Invocar `prisma/seed.ts` desde `scripts/deploy-prod.sh` en el punto correcto.
2. Auditar `prisma/seed.ts` para garantizar idempotencia respecto a valores custom del CEO y documentar las excepciones.

## Cambios de código

### 1. `scripts/deploy-prod.sh`

Añadir entre `prisma migrate deploy` y `scripts/sync-modulos-grants.ts`:

```bash
echo "==> Seed idempotente (params + catálogos, respeta valor custom si existe)"
$COMPOSE exec -T app node --import tsx prisma/seed.ts
```

Motivo del orden:
- El seed necesita el schema al día (por eso va después de migraciones).
- El sync de módulos/grants es un paso separado de permisos; el seed no lo reemplaza.

### 2. Auditoría de `prisma/seed.ts`

Recorrido de secciones con `upsert`:

| Sección | Modelo | `update` actual | Acción | Justificación |
|---------|--------|-----------------|--------|---------------|
| Admin inicial | `Usuario` | N/A (find + create) | Ninguna | Ya respeta existencia; nunca pisa password. |
| `defaults` | `ParametroSistema` | `{}` | Ninguna | Parámetros base; ON CONFLICT DO NOTHING. |
| `monitoreoViejos` | `ParametroSistema` | `{}` | Ninguna | SPEC-187/I-69: respeta custom del CEO. |
| `monitoreoNuevos` | `ParametroSistema` | `{ valor, descripcion }` | Añadir comentario explícito | SPEC-186 decidió cambiar el default de `smoke.intervalo_min` de 5 a 30; los nuevos params deben aplicarse. |
| `reportesParams` | `ParametroSistema` | `{}` | Ninguna | Respeta custom. |
| `operadoresParams` | `ParametroSistema` | `{}` | Ninguna | Respeta custom. |
| `k_anonimato` | `ParametroSistema` | `{}` | Ninguna | Respeta custom. |
| Severidades | `ParametroSistema` | `{}` | Ninguna | Respeta custom. |
| Rúbrica | `ParametroSistema` | `{}` | Ninguna | Respeta custom; la rúbrica se edita por expertos. |
| Expediente | `ParametroSistema` | `{}` | Ninguna | Respeta custom. |
| Consulta vacía | `ParametroSistema` | `{}` | Ninguna | Respeta custom. |
| Plataformas | `Plataforma` | `{}` | Ninguna | Catálogo base. |
| Países/departamentos | `Pais`/`Departamento` | `{}` | Ninguna | Catálogo base. |
| Ciudades Colombia | `Ciudad` | `{ lat, lng, departamentoId, nombreNormalizado }` | Añadir comentario | Backfill canónico de coordenadas y normalización; no es valor custom del CEO. |
| Ciudades otros países | `Ciudad` | `{ lat, lng, nombreNormalizado }` | Añadir comentario | Backfill canónico de coordenadas y normalización. |
| Permisos | vía `syncModulosYGrants` | aditivo | Ninguna | Ya es aditivo por diseño. |

**Hallazgo esperado**: no se requieren cambios de comportamiento en el seed, solo reforzar comentarios en las dos excepciones (`monitoreoNuevos` y geografía) para que futuros mantenedores no las cambien accidentalmente.

### 3. Logs del seed

El seed ya imprime mensajes por sección. Se verifica que sean identificables:
- `"Parámetros por defecto creados"`
- `"Severidades scoring.severity.* listas"`
- `"Rúbrica de clasificación (spec 090) lista"`
- etc.

No se añaden logs nuevos salvo que la auditoría encuentre una sección silenciosa.

## Tareas

Ver [tasks.md](./tasks.md).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Seed lento en deploy | Es no-op cuando todo existe; solo upserts y logs. |
| Seed falla y rompe deploy | `set -e` ya está en el script; un fallo del seed detendrá el deploy, lo cual es correcto (fail-loud). |
| Confusión sobre qué secciones pueden pisar valor | Comentarios explícitos justo antes de cada `update: { ... }`. |
| Otra sesión de ODIN toca `prisma/seed.ts` | Rebase y conservar ambos bloques (aditivos). |

## Migración

Ninguna. Este SPEC es cambio de proceso y documentación.

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde (no cambian rutas ni permisos).
- Simular deploy dos veces y verificar idempotencia (documentar en `cierre.md`).
- No tocar `src/lib/ai/**`.
