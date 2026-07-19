# Cierre — Spec 034: Configuración, guardado y mapa del Comité

**Rama**: `feature/001-scaffolding`  
**Spec**: `specs/034-config-guardado-mapa-comite/`  
**Fecha cierre**: 2026-07-19

## Resumen

Se implementaron las 3 User Stories del spec 034:

1. **US1 (P1)**: Redirect y protección del rol `COMITE_VALIDACION` post-login y en rutas de usuario final.
2. **US2 (P1)**: Guardado explícito con upsert en el editor de grupos de categoría y advertencia de cambios sin guardar en `ConfigPanel`.
3. **US3 (P2)**: Rediseño visual del mapa del dashboard público (centro LATAM, leyenda, burbujas con etiquetas, hover, popups, mapeo de nombres).

## Artefactos entregados

- `specs/034-config-guardado-mapa-comite/spec.md` (sección Implementación completada)
- `specs/034-config-guardado-mapa-comite/plan.md`
- `specs/034-config-guardado-mapa-comite/research.md`
- `specs/034-config-guardado-mapa-comite/data-model.md`
- `specs/034-config-guardado-mapa-comite/quickstart.md`
- `specs/034-config-guardado-mapa-comite/checklists/requirements.md` (validado)
- `specs/034-config-guardado-mapa-comite/tasks.md`
- `specs/034-config-guardado-mapa-comite/contracts/` (sin cambios de endpoint significativos; el PATCH ya existía, se extendió a upsert)
- `docs/cierre-034.md` (este archivo)

## Archivos modificados

- `src/app/login/page.tsx`
- `src/app/mis-reportes/page.tsx`
- `src/app/dashboard/circulo-confianza/page.tsx`
- `src/app/api/config/parametros/[clave]/route.ts`
- `src/app/api/config/parametros/[clave]/route.test.ts`
- `src/components/modules/CategoriaGruposEditor.tsx`
- `src/components/modules/ConfigPanel.tsx`
- `src/components/modules/MapaUbicaciones.tsx`
- `src/components/modules/PublicDashboard.tsx`

## Validación

| Comando | Resultado |
|---------|-----------|
| `npm run lint` | Sin errores (2 warnings preexistentes no relacionadas) |
| `npx tsc --noEmit` | Sin errores |
| `npm run test` | 409 tests pasan, 0 fallidos |
| `npm run build` | Compilación exitosa |
| `./scripts/dev-restart.sh` | Healthcheck OK; app en `:5005` con un solo worker |

## Pruebas manuales (quickstart.md)

- Login de `COMITE_VALIDACION`: la API devuelve el rol correcto; el código de redirect apunta a `/dashboard/admin/comite`.
- Acceso a `/mis-reportes` y `/dashboard/circulo-confianza` con rol interno: el código incluye guards de redirección.
- PATCH de `ui.grupos_categoria` inexistente: crea el parámetro y devuelve 200.
- `/dashboard-publico`: carga correctamente; `/api/estadisticas-publicas` devuelve datos por país y ciudad.
- Healthcheck: `{"status":"ok","workerAlive":true,"dbOk":true}`.

## Migraciones

Ninguna. Los cambios son aditivos y compatibles con el esquema actual.

## Deuda técnica registrada

Ninguna nueva. El diccionario de nombres de país español→inglés está en el componente y puede requerir ampliación si se reportan países fuera del mapa actual; se deja como mejora futura bajo el spec correspondiente.

## Commits

Se entregarán 4 commits: uno por US + uno de docs.
