# Checklist: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Modelo y migración

- [ ] Migración aditiva crea `Curso`, `Alumno`, `IdentificadorAlumno` y enum `EtiquetaRelacionAlumno`.
- [ ] No se borra ni modifica datos existentes.
- [ ] Índices por `colegioId`, `cursoId`, `alumnoId` y estado.
- [ ] Restricciones de unicidad correctas.

## Endpoints

- [ ] `GET /api/colegio/cursos` filtra por colegio del SCHOOL_ADMIN autenticado.
- [ ] `POST /api/colegio/cursos` valida nombre y unicidad por colegio.
- [ ] `PATCH /api/colegio/cursos/[id]` valida propiedad del colegio.
- [ ] `PATCH /api/colegio/cursos/[id]/estado` permite activar/desactivar.
- [ ] `GET /api/colegio/cursos/[id]/alumnos` filtra por curso y colegio.
- [ ] `POST /api/colegio/cursos/[id]/alumnos` valida curso propio y nombre.
- [ ] `PATCH /api/colegio/alumnos/[id]` y `/estado` validan propiedad.
- [ ] `GET /api/colegio/alumnos/[id]/identificadores` filtra por alumno propio.
- [ ] `POST /api/colegio/alumnos/[id]/identificadores` valida tipo, valor, plataforma y etiqueta.
- [ ] `PATCH /api/colegio/identificadores/[id]` y `/estado` validan propiedad.
- [ ] Todos los endpoints usan `verifyAuth("SCHOOL_ADMIN")` y `verificarVigenciaColegio`.

## UI

- [ ] Vista de cursos en `/dashboard/colegio/cursos` con tema verde.
- [ ] Vista de alumnos por curso.
- [ ] Vista de identificadores por alumno.
- [ ] Formularios con validación y feedback de errores.
- [ ] Navegación desde el panel del colegio.

## Seguridad y aislamiento

- [ ] ADMIN/OPERADOR/COMITE/PARENT reciben 403 en `/api/colegio/*`.
- [ ] SCHOOL_ADMIN no ve cursos/alumnos/identificadores de otro colegio.
- [ ] SCHOOL_ADMIN con colegio vencido/inactivo recibe 403.
- [ ] No se expone información de otros colegios en errores.

## Tests

- [ ] Tests para ABM de cursos con aislamiento.
- [ ] Tests para ABM de alumnos con aislamiento.
- [ ] Tests para ABM de identificadores con aislamiento y duplicados.
- [ ] Tests de permisos para roles no SCHOOL_ADMIN.
- [ ] Tests de colegio vencido/inactivo.
- [ ] `npx vitest run` pasa (≥611 tests).
- [ ] `npx tsc --noEmit` y `npm run lint` pasan.

## Deploy y cierre

- [ ] `npm run build` exitoso.
- [ ] `./scripts/dev-restart.sh` con healthcheck ok.
- [ ] Commit por US + docs.
- [ ] Push a `feature/001-scaffolding`.
- [ ] `cierre.md` y sección Implementación en `spec.md`.
- [ ] Status CERRADA.
