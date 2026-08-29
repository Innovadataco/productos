# Quickstart: SPEC-152 — Duplicar curso al año siguiente

## Cómo probar manualmente

### 1. Pre-requisitos

- Base de datos de test levantada: `docker compose up -d db`
- Migraciones aplicadas: `npm run db:migrate`
- Seed: `npm run db:seed` (crea admin inicial)
- App corriendo: `npm run dev`

### 2. Crear un colegio y un curso

1. Login como `ADMIN`.
2. Crear un colegio en `/dashboard/admin/colegios/nuevo`.
3. Crear un SCHOOL_ADMIN para ese colegio (la contraseña temporal se muestra si el email falla).
4. Login como SCHOOL_ADMIN.
5. Ir al wizard `/dashboard/colegio/cursos/unificado` y crear un curso con al menos 2 estudiantes y 1 identificador.

### 3. Duplicar el curso

1. Ir a `/dashboard/colegio/cursos/[id]`.
2. Hacer clic en "Duplicar al año siguiente".
3. Confirmar en el diálogo.
4. Verificar que:
   - Se navega al nuevo curso.
   - El nuevo curso tiene el `anioLectivo` incrementado.
   - Los estudiantes e identificadores aparecen en el nuevo curso.
   - El curso origen sigue intacto.

### 4. Verificar duplicado

1. Volver a la ficha del curso origen.
2. Intentar duplicar de nuevo.
3. Debe mostrar error 409 ("Ya existe un curso con ese nombre para el periodo siguiente").

### 5. Verificar atomicidad

Forzar un fallo (solo en test): si se intenta duplicar un curso ajeno con un SCHOOL_ADMIN de otro colegio, debe devolver 404 y no crear nada.
