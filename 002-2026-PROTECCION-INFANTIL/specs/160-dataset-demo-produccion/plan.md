# Plan: SPEC-160 — Dataset demo de producción (002-PI-059)

## Enfoque

No implementar hasta el **GO de ZEUS en la compuerta §4**. Este plan describe cómo sembrar un dataset demo realista en `pi.innovadataco.com`, con marcado inequívoco y purga quirúrgica, reutilizando scripts existentes.

## Decisiones de diseño aprobadas por ZEUS

### D1. Estrategia de marcado de demo

**Aprobada: Opción A — tabla central `DemoMarcado`**
- Nueva tabla aditiva: `id`, `entidad`, `entidadId`, `metadata`, `creadoEn`.
- Cada entidad demo se registra al crearse.
- La purga lee `DemoMarcado` y borra en orden inverso respetando FK.
- Los prefijos `DEMO-` / `RPT-DEMO-` y los emails `@innovadataco.com` son **defensa en profundidad**, no la llave de borrado.

### D2. Modo de ejecución del seed

- Script `scripts/demo-prod/sembrar-demo.ts` corre localmente con `DATABASE_URL` y `API_BASE` apuntando a producción.
- Usa `PrismaClient` para inserciones masivas y llama a endpoints internos para ejercer flujos reales.
- Requiere credenciales de admin de producción.

### D3. Modo de ejecución de la purga

- Script `scripts/demo-prod/purgar-demo.ts` ejecuta borrados **exclusivamente** por `DemoMarcado.id`.
- SQL equivalente como respaldo.
- `verificar-purga.ts` antes/después.

### D4. Asignación a operadores

- Reutilizar lógica real del sistema; si no asigna automáticamente, el seed invoca asignación manual.

### D5. Ventana temporal y backdating (condición ZEUS D1)

- Los reportes se distribuyen en una ventana de **6 meses terminando hoy** (≈ 2026-02-10 … 2026-08-10).
- Las entidades derivadas (`AlertaColegio`, `TransicionReporte`, `ClasificacionIA`, `PasoProcesamiento`) reciben `creadoEn` igual a la fecha histórica del reporte.
- Esto evita picos artificiales en dashboards (ritmo mensual, reloj 24h, embudo, franja "última señal").

### D6. Supresión de avisos históricos (condición ZEUS D2)

- Reportes con fecha histórica > 7 días antes de hoy se siembran en estado final **sin disparar avisos por email**.
- Solo los reportes "frescos" (≤ 7 días) pueden generar avisos reales a `soporte+…@innovadataco.com`.

### D7. Purga de AuditLog (condición ZEUS D3)

- `AuditLog` demo se marca en `DemoMarcado` y se purga.
- "Idéntica a antes del seed" incluye logs de auditoría.

### D8. Migración aditiva DemoMarcado (condición ZEUS D4)

- Migración `prisma/migrations/..._demo_marcado`: solo `CREATE TABLE` + índices.
- Sin `DROP`; candado I-49: verificar supervivencia de índices.

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
   - Generar reportes con fechas escalonadas en la ventana de 6 meses terminando hoy.
   - Mezcla anónimo/autenticado.
   - Usar banco curado + variaciones controladas.
   - Asociar reportes a identificadores de estudiantes.
   - Reportes históricos (> 7 días) se insertan en estado final sin enviar avisos.
   - Reportes frescos (≤ 7 días) se procesan con el flujo real y pueden enviar avisos.

7. **Fase 6 — Procesar con motor real y backdatear derivados**
   - Procesar reportes frescos resumiblemente (`reanudar-demo.ts`).
   - Para reportes históricos, insertar directamente estados finales y entidades derivadas con `creadoEn` histórico.
   - Backdatear `AlertaColegio`, `TransicionReporte`, `ClasificacionIA`, `PasoProcesamiento` a la fecha del caso.
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
