# Tareas: SPEC-160 — Dataset demo de producción (002-PI-059)

> Orden por dependencias. No pasar a implementación sin GO de ZEUS en compuerta §4.

## Fase 0 — Preparación segura

### T001 [P] Documentar decisiones D1-D4 aprobadas por ZEUS
- Archivo: `specs/160-dataset-demo-produccion/plan.md`.
- Incluir DemoMarcado, backdating, supresión de avisos históricos, purga de AuditLog, purga solo por id.

### T002 [P] Crear migración aditiva `DemoMarcado`
- Archivo: `prisma/schema.prisma` + `prisma/migrations/..._demo_marcado`.
- Solo `CREATE TABLE` + índices; sin `DROP` (candado I-49).
- Verificar supervivencia de índices.

### T003 [P] Crear estructura de scripts demo-prod
- Directorio: `scripts/demo-prod/`.
- Archivos base: `types.ts`, `config.ts`, `logger.ts`.

### T004 [P] Script de verificación antes/después
- Archivo: `scripts/demo-prod/verificar-purga.ts`.
- Imprime conteos por entidad demo y totales.

## Fase 1 — Infraestructura institucional

### T010 [P] Sembrar tenants y colegios
- Archivo: `scripts/demo-prod/sembrar-colegios.ts`.
- 5 colegios con datos realistas, vigencia futura, representante legal.
- Registrar cada entidad en `DemoMarcado`.

### T011 [P] Sembrar SCHOOL_ADMIN por colegio
- Archivo: `scripts/demo-prod/sembrar-colegios.ts` (misma unidad de trabajo).
- Emails `soporte+colegio01@innovadataco.com` … `soporte+colegio05@`.
- Contraseña común hasheada.

### T012 [P] Sembrar profesores
- Archivo: `scripts/demo-prod/sembrar-colegios.ts`.
- 10 profesores por colegio; asignar titulares a cursos.

### T013 [P] Sembrar cursos
- Archivo: `scripts/demo-prod/sembrar-colegios.ts`.
- 10 cursos por colegio (grados 6°-11°, años lectivos).

## Fase 2 — Estudiantes y acudientes

### T020 [P] Sembrar estudiantes
- Archivo: `scripts/demo-prod/sembrar-estudiantes.ts`.
- 20 estudiantes por curso; nombres realistas.
- Registrar en `DemoMarcado`.

### T021 [P] Sembrar identificadores de estudiantes
- Archivo: `scripts/demo-prod/sembrar-estudiantes.ts`.
- ≥5 identificadores por estudiante (tel, nick, email, plataformas variadas).
- Normalizar valores con lógica existente.

### T022 [P] Sembrar acudientes
- Archivo: `scripts/demo-prod/sembrar-estudiantes.ts`.
- 1-2 acudientes por estudiante con nombres, relación y teléfono.

## Fase 3 — Usuarios de plataforma

### T030 [P] Sembrar OPERADOR
- Archivo: `scripts/demo-prod/sembrar-usuarios.ts`.
- ≥10 operadores con PerfilOperador; emails `soporte+operador01@` … `soporte+operador10@`.

### T031 [P] Sembrar COMITE_VALIDACION
- Archivo: `scripts/demo-prod/sembrar-usuarios.ts`.
- 1 usuario comité + ≥3 integrantes.
- Email `soporte+comite01@innovadataco.com`.

### T032 [P] Sembrar PARENT
- Archivo: `scripts/demo-prod/sembrar-padres.ts`.
- ≥50 padres; algunos vinculados a acudientes de estudiantes.
- Emails `soporte+padre01@` … `soporte+padre50@`.
- Estado `activo` y email verificado para evitar fricción.

## Fase 4 — Círculos de confianza

### T040 [P] Sembrar círculos de confianza
- Archivo: `scripts/demo-prod/sembrar-circulos.ts`.
- ~20 padres crean contactos con identificadores.
- Algunos identificadores solapan con identificadores de estudiantes.

## Fase 5 — Reportes

### T050 [P] Preparar banco ampliado de reportes demo
- Archivo: `scripts/demo-prod/banco-reportes-demo.json`.
- Reusa `scripts/simulacion/simulacion-200-antes-curaduria.json` y añade variaciones controladas.
- Cada entrada: texto, categoría esperada, gravedad sugerida.

### T051 [P] Sembrar reportes con ventana temporal
- Archivo: `scripts/demo-prod/sembrar-reportes.ts`.
- Fechas escalonadas en 6 meses terminando hoy (≈ 2026-02-10 … 2026-08-10).
- Mezcla anónimo/autenticado.
- Asociar a identificadores de estudiantes.
- Registrar reportes en `DemoMarcado`.

### T052 [P] Sembrar reportes del círculo de confianza
- Archivo: `scripts/demo-prod/sembrar-reportes.ts`.
- Algunos reportes usan identificadores del círculo de padres.

### T053 [P] Sembrar reportes históricos en estado final sin avisos
- Archivo: `scripts/demo-prod/sembrar-reportes.ts`.
- Reportes > 7 días de antigüedad se insertan con estados finales (`CLASIFICADO`, `REVISION_MANUAL`, etc.) y `creadoEn` histórico.
- No se encolan avisos por email para estos reportes.

### T054 [P] Suprimir avisos de reportes históricos
- Archivo: `scripts/demo-prod/sembrar-reportes.ts`.
- Validar que solo reportes ≤ 7 días disparen `AlertaColegio` y emails.

## Fase 6 — Procesamiento

### T060 [P] Procesar reportes con motor real
- Archivo: `scripts/demo-prod/procesar-reportes-demo.ts` (reusa `reanudar-demo.ts`).
- Procesar reportes frescos (≤ 7 días) con `/api/reportes/procesar` y `WORKER_SECRET`.
- Resumible, con reintentos y timeout.

### T061 [P] Asignar reportes manuales
- Archivo: `scripts/demo-prod/asignar-reportes-demo.ts`.
- Para reportes en `REVISION_MANUAL`, asignar a operadores según lógica real.
- Ejercer escalamiento a comité para un subconjunto.

### T062 [P] Backdatear entidades derivadas
- Archivo: `scripts/demo-prod/procesar-reportes-demo.ts`.
- Ajustar `creadoEn` de `AlertaColegio`, `TransicionReporte`, `ClasificacionIA`, `PasoProcesamiento`, `ReintentoReporte`, `EventoMatch` a la fecha histórica del reporte.
- Validar que dashboards no muestren pico en fecha de seed.

## Fase 7 — Entrega

### T070 [P] Generar hoja de credenciales
- Archivo: `scripts/demo-prod/hoja-credenciales.ts`.
- Salida: `docs/demo-prod/credenciales-002-PI-059.md` (fuera de git o en `.gitignore`).
- Incluye email, rol y contraseña común.

## Fase 8 — Purga

### T080 [P] Implementar purga quirúrgica por DemoMarcado
- Archivo: `scripts/demo-prod/purgar-demo.ts`.
- Lee `DemoMarcado` por `id`; borra en orden inverso.
- Nunca usa prefijos, nombres ni heurísticas como llave de borrado.
- Recalcula/borra `IdentificadorReportado` afectados.
- Limpia cola pg-boss de jobs demo.
- Idempotente.

### T081 [P] SQL de respaldo para purga
- Archivo: `scripts/demo-prod/purgar-demo.sql`.
- Equivalente al script TypeScript para ejecución directa en BD.

### T082 [P] Verificar purga en snapshot
- Archivo: `scripts/demo-prod/verificar-purga.ts`.
- Antes y después: conteos de todas las entidades demo.
- Gate: todo demo a cero; datos reales intactos.

### T083 [P] Marcar y purgar AuditLog demo
- Archivo: `scripts/demo-prod/sembrar-demo.ts` y `scripts/demo-prod/purgar-demo.ts`.
- Cada mutación demo genera `AuditLog` marcado en `DemoMarcado`.
- La purga borra `AuditLog` demo como parte del árbol.

## Documentación

### T090 [P] Actualizar README de specs
- Archivo: `specs/README.md`.
- Marcar SPEC-160 como Planeada en ambas tablas.

### T091 [P] Completar quickstart.md
- Archivo: `specs/160-dataset-demo-produccion/quickstart.md`.
- Pasos exactos para correr seed y purga en producción.
