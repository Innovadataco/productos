# Tareas: SPEC-160 — Dataset demo de producción (002-PI-059)

> Orden por dependencias. No pasar a implementación sin GO de ZEUS en compuerta §4.

## Fase 0 — Preparación segura

### T001 [P] Decidir estrategia de marcado con ZEUS
- Archivo: `specs/160-dataset-demo-produccion/data-model.md`.
- Documentar opciones A/B/C y la decisión final.

### T002 [P] Diseñar tabla `DemoMarcado` (si aplica Opción A)
- Archivo: `prisma/schema.prisma`.
- Migración aditiva con `npx prisma migrate dev --name demo_marcado`.

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

### T051 [P] Sembrar reportes
- Archivo: `scripts/demo-prod/sembrar-reportes.ts`.
- Fechas escalonadas en 6 meses.
- Mezcla anónimo/autenticado.
- Asociar a identificadores de estudiantes.
- Estados iniciales `PENDIENTE`.
- Registrar reportes en `DemoMarcado`.

### T052 [P] Sembrar reportes del círculo de confianza
- Archivo: `scripts/demo-prod/sembrar-reportes.ts`.
- Algunos reportes usan identificadores del círculo de padres.

## Fase 6 — Procesamiento

### T060 [P] Procesar reportes con motor real
- Archivo: `scripts/demo-prod/procesar-reportes-demo.ts` (reusa `reanudar-demo.ts`).
- Llamadas a `/api/reportes/procesar` con `WORKER_SECRET`.
- Resumible, con reintentos y timeout.

### T061 [P] Asignar reportes manuales
- Archivo: `scripts/demo-prod/asignar-reportes-demo.ts`.
- Para reportes en `REVISION_MANUAL`, asignar a operadores según lógica real.
- Ejercer escalamiento a comité para un subconjunto.

## Fase 7 — Entrega

### T070 [P] Generar hoja de credenciales
- Archivo: `scripts/demo-prod/hoja-credenciales.ts`.
- Salida: `docs/demo-prod/credenciales-002-PI-059.md` (fuera de git o en `.gitignore`).
- Incluye email, rol y contraseña común.

## Fase 8 — Purga

### T080 [P] Implementar purga quirúrgica
- Archivo: `scripts/demo-prod/purgar-demo.ts`.
- Lee `DemoMarcado`; borra en orden inverso.
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

## Documentación

### T090 [P] Actualizar README de specs
- Archivo: `specs/README.md`.
- Marcar SPEC-160 como Planeada en ambas tablas.

### T091 [P] Completar quickstart.md
- Archivo: `specs/160-dataset-demo-produccion/quickstart.md`.
- Pasos exactos para correr seed y purga en producción.
