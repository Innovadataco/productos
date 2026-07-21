# Quickstart: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Requisitos previos

- App corriendo en `:5005` (`./scripts/dev-restart.sh`).
- Fase 2 cerrada con modelos y endpoints.
- Usuario SCHOOL_ADMIN con colegio vigente.

## Flujo de prueba

1. **Descargar plantilla**
   - Ir a `/dashboard/colegio/cursos/carga`.
   - Hacer clic en "Descargar plantilla".
   - Verificar que el archivo tiene las columnas: `nombre_curso`, `grado`, `anio_lectivo`, `nombre_alumno`, `tipo_identificador`, `valor_identificador`, `etiqueta_relacion`, `plataforma`.

2. **Preparar archivo de prueba**
   - Crear CSV/Excel con 2-3 alumnos, uno con 2 identificadores (teléfono y email).
   - Incluir una fila con nombre de alumno vacío (para probar validación).

3. **Validar archivo**
   - Subir el archivo.
   - El sistema debe mostrar resumen: X filas válidas, 1 fila con error.
   - El error debe indicar fila y motivo ("nombre_alumno vacío").

4. **Confirmar carga**
   - Corregir el archivo (llenar nombre).
   - Validar nuevamente → 0 errores.
   - Confirmar.
   - Verificar que se creó el curso, alumnos e identificadores.
   - Ir a `/dashboard/colegio/cursos` y confirmar el curso nuevo con los alumnos.

5. **Idempotencia**
   - Subir el mismo archivo de nuevo.
   - Confirmar.
   - Verificar que no se duplicaron alumnos ni identificadores.

6. **Aislamiento**
   - Intentar usar el endpoint con ADMIN/OPERADOR → 403.

## Endpoints

- `POST /api/colegio/carga/validar` — recibe `FormData` con campo `archivo`; devuelve filas válidas + errores.
- `POST /api/colegio/carga/confirmar` — recibe `{ tokenConfirmacion }` y ejecuta la carga.
- `GET /api/colegio/carga/plantilla` — descarga plantilla CSV.

## Verificación de tests

```bash
npx vitest run src/app/api/colegio/carga
npx tsc --noEmit
npm run lint
npm run build
```
