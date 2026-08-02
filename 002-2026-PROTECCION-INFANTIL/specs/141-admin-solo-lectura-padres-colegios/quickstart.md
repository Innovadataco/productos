# Quickstart: SPEC-141 — admin solo lectura (círculo + estructura colegio)

## Qué se entrega

El ADMIN de plataforma gana visibilidad de apoyo, estrictamente de solo lectura:

- **Círculo de confianza de un padre**: desde el listado de padres
  (`/dashboard/admin/padres`), enlace "Ver círculo (solo lectura)" → contactos,
  identificadores y estados derivados, idénticos a lo que ve el padre. Sin
  botones de edición: el círculo lo gestiona el padre.
- **Cursos y alumnos de un colegio**: desde el listado de colegios
  (`/dashboard/admin/colegios`), enlace "Ver cursos y alumnos (solo lectura)" →
  cursos con conteo, y por curso los alumnos con identificadores (paginado). Sin
  botones de edición: el roster lo gestiona el SCHOOL_ADMIN.

Cada consulta que expone identificadores deja una fila en `AuditLog`
(`CIRCULO_CONFIANZA_ACCESO_ADMIN` / `COLEGIO_ROSTER_ACCESO_ADMIN`) con el admin y
el recurso — nunca los identificadores en metadatos.

## Probar

```bash
# tests de los endpoints nuevos
node --env-file=.env.test --import tsx ./node_modules/vitest/vitest.mjs run \
  src/app/api/admin/padres/\[id\]/circulo-confianza/route.test.ts \
  src/app/api/admin/colegios/\[id\]/cursos/route.test.ts \
  src/app/api/admin/colegios/\[id\]/cursos/\[cursoId\]/alumnos/route.test.ts
```

Verificación manual (app en :5005, sesión ADMIN):

1. `/dashboard/admin/padres` → "Ver círculo (solo lectura)" de un padre con
   contactos → se ven contactos + identificadores + estados; no hay controles de
   edición (los verbos de escritura no existen para ADMIN).
2. `/dashboard/admin/colegios` → "Ver cursos y alumnos (solo lectura)" → cursos;
   expandir un curso → alumnos paginados con identificadores.
3. `/dashboard/admin/audit-logs` (o BD): cada consulta de los pasos 1-2 dejó su
   fila con la acción de acceso correspondiente.
4. Con sesión PARENT/SCHOOL_ADMIN/OPERADOR: los endpoints `/api/admin/...`
   responden 401/403.
