# Cierre: Spec 076 — Colegios · Fase 3: Carga masiva por Excel/CSV

**Status**: CERRADA  
**Fecha de cierre**: 2026-07-21  
**Branch**: `feature/001-scaffolding`

---

## Resumen por User Story

| US | Descripción | Estado |
|----|-------------|--------|
| US1 | SCHOOL_ADMIN descarga plantilla CSV | Implementado |
| US2 | SCHOOL_ADMIN valida archivo fila por fila antes de cargar | Implementado |
| US3 | SCHOOL_ADMIN confirma carga masiva con upsert | Implementado |

---

## Archivos tocados

```
package.json
package-lock.json
prisma/schema.prisma
prisma/migrations/20260721070000_add_colegio_carga_masiva_audit_action/
src/lib/schemas/index.ts
src/lib/audit.ts
src/lib/colegio/carga/parser.ts
src/lib/colegio/carga/validator.ts
src/lib/colegio/carga/token.ts
src/lib/colegio/carga/importer.ts
src/lib/colegio/carga/parser.test.ts
src/lib/colegio/carga/validator.test.ts
src/lib/colegio/carga/importer.test.ts
src/app/api/colegio/carga/plantilla/route.ts
src/app/api/colegio/carga/validar/route.ts
src/app/api/colegio/carga/confirmar/route.ts
src/app/api/colegio/carga/route.test.ts
src/app/dashboard/colegio/cursos/carga/page.tsx
src/app/dashboard/colegio/page.tsx
src/components/modules/colegio/ColegioNav.tsx
specs/076-colegios-carga-excel/spec.md
specs/076-colegios-carga-excel/cierre.md
```

---

## Resultados de validación

- **Tests**: `npx vitest run` → 678 tests verdes (115 archivos).
- **Types**: `npx tsc --noEmit` → sin errores.
- **Lint**: `npm run lint` → sin errores.
- **Build**: `npm run build` → exitosa.
- **Deploy**: `./scripts/dev-restart.sh` → healthcheck ok, un worker.
- **Aislamiento**: tests confirman que SCHOOL_ADMIN no ve/afecta datos de otros colegios; ADMIN/OPERADOR/COMITE/PARENT reciben 403.
- **Idempotencia**: segunda confirmación del mismo archivo reutiliza curso/alumnos/identificadores sin duplicados.
- **Preservación de valores**: parser CSV manual conserva strings como `+573001234567`.

---

## Commits

1. `feat(076-US1): endpoint plantilla de carga masiva`.
2. `feat(076-US2): parser, validador y endpoint /validar`.
3. `feat(076-US3): importer, token y confirmar con upsert`.
4. `feat(076): UI de carga masiva y navegación del colegio`.
5. `docs(076): cierre e implementación del spec`.
6. `fix(076): parser CSV manual preserva signo + y tests de carga`.

---

## Deuda técnica documentada

- **Excel con celdas numéricas**: si el usuario guarda un teléfono como número en Excel, XLSX lo interpreta como número y puede perder el `+` o ceros iniciales. Se mitiga con el parser CSV manual y la plantilla de ejemplo; documentar para el usuario que guarde identificadores como texto.
- **Tamaño de archivo**: el límite de 500 filas es configurable vía `ParametroSistema` clave `colegio.carga.max_filas`; no se implementó UI de configuración.
- **Token JWT**: las filas válidas viajan en un token JWT firmado; archivos muy grandes podrían generar tokens de ~100 KB, aceptable para el límite actual.

---

## Backup

- No se requirió migración destructiva; se agregó una migración aditiva para el enum `AccionAudit`.

---

## Notas de seguridad

- No se persiste el archivo subido en disco.
- No se toca el modelo `Reporte` ni el modelo de IA.
- El aislamiento por colegio se mantiene en todos los endpoints de carga.
- Migración aditiva: solo se agregó el valor `COLEGIO_CARGA_MASIVA` al enum de `AccionAudit`.
