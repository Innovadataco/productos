# Quickstart: Colegios · Fase 4 — Alertas y Consulta anonimizada

## Requisitos previos

- Fases 2 y 3 cerradas.
- App corriendo en `:5005`.
- Colegio con alumnos e identificadores registrados.

## Flujo de prueba

1. **Registrar identificador**
   - Como SCHOOL_ADMIN, crear un alumno en un curso con identificador `+573001234567` (relación alumno).

2. **Crear reporte que dispare alerta**
   - Desde el formulario anónimo, crear un reporte con identificador `+573001234567`.
   - Esperar a que el worker procese el reporte (o forzar procesamiento).

3. **Ver alerta en el colegio**
   - Ingresar como SCHOOL_ADMIN a `/dashboard/colegio/alertas`.
   - Verificar que aparece la alerta con: identificador, relación, categoría, estado, fecha.
   - Verificar que NO aparece: texto del reporte, ciudad, país, edad, plataforma, identificador del denunciante.

4. **Gestionar alerta**
   - Marcar la alerta como "vista" y luego "gestionada".
   - Verificar que el estado cambia y se registra auditoría.

5. **Aislamiento y privacidad**
   - Con otro SCHOOL_ADMIN, verificar que no ve la alerta.
   - Con ADMIN/OPERADOR/COMITE/PARENT, verificar que reciben 403 en `/api/colegio/alertas`.
   - Con el reporte dado de baja, verificar que la alerta desaparece del listado.

## Endpoints

- `GET /api/colegio/alertas`
- `PATCH /api/colegio/alertas/[id]/estado`

## Verificación de tests

```bash
npx vitest run src/app/api/colegio/alertas
npx tsc --noEmit
npm run lint
npm run build
```
