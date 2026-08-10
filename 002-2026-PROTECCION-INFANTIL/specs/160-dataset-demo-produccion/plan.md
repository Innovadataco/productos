# Plan: SPEC-160 — Dataset demo de producción (002-PI-059)

## Enfoque

No implementar hasta el **GO de ZEUS en la compuerta §4**. Este plan describe cómo sembrar un dataset demo realista en `pi.innovadataco.com`, con marcado inequívoco y purga quirúrgica, reutilizando scripts existentes.

## Decisiones de diseño pendientes de aprobación de ZEUS

### D1. Estrategia de marcado de demo

**Opción A (recomendada): tabla central `DemoMarcado`**
- Nueva tabla: `id`, `entidad` (enum/string), `entidadId`, `creadoEn`.
- Cada entidad demo se registra al crearse.
- La purga lee `DemoMarcado` y borra en orden inverso respetando FK.
- **Pros**: no toca schema de entidades existentes; marcado inequívoco; fácil auditar.
- **Cons**: requiere mantener sincronización; borrado manual ordenado.

**Opción B: campo `esDemo` en cada tabla**
- Migraciones aditivas en `Colegio`, `Curso`, `Estudiante`, `Profesor`, `AcudienteEstudiante`, `Usuario`, `ContactoConfianza`, `Reporte`, etc.
- **Pros**: purga con DELETE simples.
- **Cons**: muchas migraciones; relaciones sin cascade complican el orden de borrado.

**Opción C: convención por datos + whitelist**
- Emails `@innovadataco.com`, nombres prefijo `DEMO`, `numeroSeguimiento` `RPT-DEMO-`.
- **Pros**: sin cambios de schema.
- **Cons**: frágil; riesgo de borrar datos reales si alguien usa esas convenciones; purga compleja.

**Recomendación**: Opción A + convención de emails como defensa en profundidad.

### D2. Modo de ejecución del seed

- Script `scripts/demo-prod/sembrar-demo.ts` corre localmente (desde la Mac de desarrollo) con `DATABASE_URL` y `API_BASE` apuntando a producción.
- Usa `PrismaClient` para inserciones masivas y llama a endpoints internos (`/api/reportes`, `/api/reportes/procesar`) para ejercer flujos reales.
- Requiere `ADMIN_API_TOKEN` o login previo del admin de producción.

### D3. Modo de ejecución de la purga

- Script `scripts/demo-prod/purgar-demo.ts` (TypeScript) ejecuta borrados en orden determinístico dentro de transacciones, usando la tabla `DemoMarcado`.
- También se entrega SQL equivalente como respaldo.
- Antes de purgar: `verificar-purga.ts` imprime conteos; después los vuelve a imprimir para confirmar cero.

### D4. Asignación a operadores

- Reutilizar la lógica existente de asignación (cuando un reporte queda en `REVISION_MANUAL`, el worker/endpoint lo asigna según cupo y disponibilidad).
- Si el sistema no asigna automáticamente en todos los casos, el script de seed invocará el endpoint de asignación manual para los reportes que lo requieran.

## Fases

1. **Fase 0 — Preparación segura**
   - Crear scripts y migración de `DemoMarcado`.
   - Backup manual de la BD (fuera del flujo del script, documentado en quickstart).
   - Verificar conectividad a prod y Ollama por Tailscale.

2. **Fase 1 — Sembrar infraestructura institucional**
   - 5 tenants.
   - 5 colegios + 5 SCHOOL_ADMIN.
   - 10 profesores por colegio.
   - 10 cursos por colegio con profesor titular.

3. **Fase 2 — Sembrar estudiantes y acudientes**
   - 20 estudiantes por curso.
   - ≥5 identificadores por estudiante.
   - 1-2 acudientes por estudiante (algunos se convertirán en usuarios PARENT).

4. **Fase 3 — Sembrar usuarios de plataforma**
   - ≥10 OPERADOR + PerfilOperador.
   - 1 COMITE_VALIDACION + integrantes.
   - ≥50 PARENT (registrados vía API pública o creados directamente con email verificado).

5. **Fase 4 — Círculos de confianza**
   - ~20 de los 50 padres crean círculo con identificadores.
   - Algunos identificadores coinciden con identificadores de estudiantes para generar reportes del círculo.

6. **Fase 5 — Sembrar reportes**
   - Generar reportes con fechas escalonadas en 6 meses.
   - Mezcla anónimo/autenticado.
   - Usar banco curado + variaciones controladas.
   - Asociar reportes a identificadores de estudiantes.

7. **Fase 6 — Procesar con motor real**
   - Encolar/procesar reportes resumiblemente (`reanudar-demo.ts`).
   - Revisar estados y asignar manuales.

8. **Fase 7 — Credenciales y entrega**
   - Generar `hoja-credenciales.md`.

9. **Fase 8 — Purga y verificación**
   - Ejecutar `verificar-purga.ts` antes.
   - Ejecutar `purgar-demo.ts`.
   - Ejecutar `verificar-purga.ts` después.

## Gate de calidad

- `npx tsc --noEmit` ✅
- `npm run lint` ✅
- Script de purga probado en un clone de prod (o snapshot) antes de tocar producción.
- Comprobación manual: no existen filas demo tras la purga.
