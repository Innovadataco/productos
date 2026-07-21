# Cierre: Módulo Colegios — Fase 0: Ubicación (País → Departamento → Ciudad) (Spec 073)

**Spec**: specs/073-ubicacion-departamentos/spec.md  
**Branch**: feature/001-scaffolding  
**Fecha de cierre**: 2026-07-21  
**Status**: CERRADA

---

## Resumen

Se agregó el modelo `Departamento` entre `Pais` y `Ciudad` de forma aditiva, se cargó la división territorial de Colombia (32 departamentos + Bogotá D.C.) y se vincularon las ciudades existentes sin tocar el modelo `Reporte`, los endpoints `/api/paises` y `/api/ciudades`, ni la UI de reportes. Todos los tests pasan y el build es exitoso.

---

## Commits

```
e2b513f feat(073): verificación de no regresión — endpoints y tests sin cambios
cef42d5 feat(073): seed idempotente de Colombia con 33 departamentos y ciudades principales
fd2e391 feat(073): modelo Departamento y migración aditiva add_departamento
95ded9b docs(073): plan Spec-Kit completo para ubicación país→departamento→ciudad
```

---

## Archivos tocados

- `prisma/schema.prisma`
- `prisma/migrations/20260721001700_add_departamento/migration.sql`
- `prisma/seed.ts`
- `specs/073-ubicacion-departamentos/spec.md`
- `specs/073-ubicacion-departamentos/tasks.md`
- `specs/073-ubicacion-departamentos/cierre.md` (este archivo)

---

## Validación

| Check | Comando | Resultado |
|-------|---------|-----------|
| Backup previo | `pg_dump ... > /tmp/backup-pre-073-20260720-201731.dump` | 4.9 MB, OK |
| Migración dev | `npx prisma migrate deploy` | Aplicada sin pérdida de datos |
| Migración test | `source .env.test; npx prisma migrate deploy` | Aplicada en BD de test |
| Seed idempotente | `npx tsx prisma/seed.ts` (2 veces) | Sin duplicados |
| Datos Colombia | 33 departamentos, 73 ciudades con `departamentoId` | OK |
| 10 ciudades existentes | Todas vinculadas a su departamento real | OK |
| Type check | `npx tsc --noEmit` | OK |
| Lint | `npm run lint` | OK |
| Tests | `npm run test` | 106 files, 605 tests passed |
| Build | `npm run build` | OK |
| Deploy limpio | `./scripts/dev-restart.sh` | OK (ver sección Deploy) |

---

## Pruebas funcionales (quickstart.md)

- Se verificó en BD que `Departamento` tiene 33 registros para Colombia.
- Se verificó que las ciudades existentes (Bogotá, Medellín, Cali, etc.) quedaron vinculadas a su departamento.
- Se ejecutó el seed dos veces sin duplicados.
- Se confirmó que `/api/paises` y `/api/ciudades?paisId=...` mantienen sus contratos.
- El flujo de reporte anónimo sigue guardando `pais`, `ciudad`, `paisId`, `ciudadId` sin requerir departamento.

---

## Deploy

```bash
./scripts/dev-restart.sh
```

Resultado: app levantada en `:5005`, healthcheck responde, un solo worker activo.

---

## Deuda técnica

- No se expone el selector de departamento en UI ni en endpoints en esta fase; queda para fases posteriores del módulo Colegios.
- No se normaliza `Reporte.departamentoId` en este spec; se mantiene el string plano para no alterar el flujo de reportes existente.

---

## Notas

- Migración estrictamente aditiva; no se usó `prisma migrate reset` ni `prisma migrate dev` en producción/despliegue.
- No se modificó el modelo `Reporte` ni los endpoints existentes.
