# Plan: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Constitution Check

- **Solo-texto**: todos los artefactos son texto plano.
- **IA local sin terceros**: parseo local de archivos; no envía datos a servicios externos.
- **Lenguaje sin veredictos**: la carga es administrativa, no emite juicios.
- **Migraciones aditivas**: si se agrega librería de Excel, no hay cambios de BD; si se persiste carga, es tabla nueva aditiva. No `migrate reset`.
- **Un solo worker**: el deploy mantiene un solo worker.
- **Cobertura Vitest**: parser, validador, endpoints y flujo completo con tests.

Constitution Check: **PASADO**.

## Technical Context

- **Base**: Fase 2 (spec 075) cerrada con modelos `Curso`, `Alumno`, `IdentificadorAlumno` y endpoints de ABM.
- **Formatos**: CSV y Excel (.xlsx) vía librería `xlsx` (SheetJS). Upload vía `FormData` nativo de Next.js App Router (`request.formData()`).
- **Validación**: reutiliza schemas de Fase 2 y validación de plataforma existente.
- **Transacción**: la confirmación envuelve curso + alumnos + identificadores en una transacción Prisma.
- **Estado de validación**: se puede usar un token JWT firmado con el payload de filas válidas para evitar re-parsear en confirmación. Alternativa: guardar en tabla `CargaMasivaAlumno`. Se usará token JWT por simplicidad y no ensuciar BD.

## Complexity Tracking

| Nivel | Descripción | Justificación |
|-------|-------------|---------------|
| Complejidad | Media | Parseo de archivos, validación por fila, transacción de confirmación, upsert. |
| Riesgo | Medio | Manejo de archivos binarios, validación robusta, prevención de duplicados. |
| Dependencias | Alta | Depende de la Fase 2 ya cerrada. |

## Decisiones de diseño

- Librería: `xlsx` para Excel; CSV parseado manualmente.
- Flujo de dos pasos: validar → confirmar (con token JWT que almacena filas válidas).
- Upsert por curso (nombre + grado + año + colegio) y por alumno (nombre + cursoId + colegio) dentro del colegio.
- Tope de filas: 500 por defecto, configurable por `ParametroSistema` clave `colegio.carga.max_filas`.
- Normalización de identificadores igual a Fase 2.
