# Checklist: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Dependencias

- [ ] Fase 2 (spec 075) cerrada y desplegada.
- [ ] Modelos `Curso`, `Alumno`, `IdentificadorAlumno` disponibles.

## Librería y configuración

- [ ] Agregar `xlsx` a `package.json` y `package-lock.json`.
- [ ] Instalar dependencia (`npm install xlsx`).
- [ ] No agregar librerías innecesarias para multipart.

## Parser y validador

- [ ] `src/lib/colegio/carga/parser.ts`: parsea CSV y XLSX a estructura de filas.
- [ ] `src/lib/colegio/carga/validator.ts`: valida filas y devuelve errores con número de fila.
- [ ] `src/lib/colegio/carga/importer.ts`: ejecuta transacción de confirmación con upsert.
- [ ] `src/lib/colegio/carga/token.ts`: genera y verifica token JWT de confirmación.
- [ ] Tests para parser, validator, importer y token.

## Endpoints

- [ ] `GET /api/colegio/carga/plantilla` devuelve plantilla CSV.
- [ ] `POST /api/colegio/carga/validar` recibe `FormData`, parsea, valida y devuelve token.
- [ ] `POST /api/colegio/carga/confirmar` recibe token, ejecuta transacción, registra auditoría.
- [ ] Aislamiento por colegio en todos los endpoints.
- [ ] Rate-limit en escrituras.

## UI

- [ ] `src/app/dashboard/colegio/cursos/carga/page.tsx`: vista de carga masiva.
- [ ] Botón descargar plantilla.
- [ ] Input de archivo con drag & drop simple.
- [ ] Mostrar resumen de validación (filas válidas, errores).
- [ ] Botón confirmar carga.
- [ ] Tema verde `.theme-colegio`.

## Seguridad y aislamiento

- [ ] SCHOOL_ADMIN no afecta datos de otros colegios.
- [ ] ADMIN/OPERADOR/COMITE/PARENT reciben 403.
- [ ] Colegio vencido/inactivo: 403.
- [ ] Tope de filas (default 500).
- [ ] No se persiste archivo en disco.

## Tests

- [ ] Tests de parser con CSV y XLSX válidos e inválidos.
- [ ] Tests de validator con errores por fila.
- [ ] Tests de carga confirmada (endpoint completo).
- [ ] Tests de idempotencia (segunda carga no duplica).
- [ ] Tests de aislamiento entre colegios.
- [ ] Tests de permisos para roles no SCHOOL_ADMIN.
- [ ] `npx vitest run` pasa (≥643 tests).
- [ ] `npx tsc --noEmit` y `npm run lint` pasan.

## Deploy y cierre

- [ ] `npm run build` exitoso.
- [ ] `./scripts/dev-restart.sh` con healthcheck ok.
- [ ] Commit por US + docs.
- [ ] Push a `feature/001-scaffolding`.
- [ ] `cierre.md` y sección Implementación en `spec.md`.
- [ ] Status CERRADA.
