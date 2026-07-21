# Quickstart: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Requisitos previos

- App corriendo en `:5005` (`./scripts/dev-restart.sh`).
- Usuario SCHOOL_ADMIN creado (Fase 1) con colegio vigente.

## Flujo de prueba

1. **Login como SCHOOL_ADMIN**
   - Acceder a `http://localhost:5005/login`.
   - Ingresar credenciales del SCHOOL_ADMIN.
   - Debe redirigir a `/dashboard/colegio`.

2. **Gestionar cursos**
   - En `/dashboard/colegio`, navegar a "Cursos".
   - Crear curso: nombre "6A", grado "Sexto", año lectivo "2026".
   - Verificar que aparece en el listado.
   - Crear curso "7B".
   - Editar "6A" a "6A - Matemáticas".
   - Desactivar "7B" y confirmar que no aparece en activos.

3. **Gestionar alumnos**
   - Entrar a curso "6A".
   - Crear alumno "María Gómez".
   - Crear alumno "Carlos Ruiz".
   - Verificar listado.
   - Desactivar "Carlos Ruiz" y confirmar que desaparece de activos.

4. **Gestionar identificadores**
   - Entrar al alumno "María Gómez".
   - Agregar identificador: tipo `telefono`, valor `+573001234567`, etiqueta `alumno`.
   - Agregar identificador: tipo `email`, valor `maria@example.com`, etiqueta `madre`.
   - Intentar agregar el mismo teléfono dos veces → debe rechazar duplicado.
   - Verificar listado.

5. **Aislamiento**
   - Con otro SCHOOL_ADMIN de otro colegio (o con ADMIN/OPERADOR), intentar acceder a `/api/colegio/cursos` o mutar un recurso ajeno.
   - Debe devolver 403 o 404.

## Endpoints

- `GET /api/colegio/cursos`
- `POST /api/colegio/cursos`
- `PATCH /api/colegio/cursos/[id]`
- `PATCH /api/colegio/cursos/[id]/estado`
- `GET /api/colegio/cursos/[id]/alumnos`
- `POST /api/colegio/cursos/[id]/alumnos`
- `PATCH /api/colegio/alumnos/[id]`
- `PATCH /api/colegio/alumnos/[id]/estado`
- `GET /api/colegio/alumnos/[id]/identificadores`
- `POST /api/colegio/alumnos/[id]/identificadores`
- `PATCH /api/colegio/identificadores/[id]`
- `PATCH /api/colegio/identificadores/[id]/estado`

## Verificación de tests

```bash
npx vitest run src/app/api/colegio
npx tsc --noEmit
npm run lint
npm run build
```
