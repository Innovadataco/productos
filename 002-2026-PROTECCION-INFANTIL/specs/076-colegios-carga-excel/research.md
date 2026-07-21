# Research: Colegios · Fase 3 — Carga masiva por Excel/CSV

## Hallazgos verificados

### Modelos y endpoints de Fase 2

- `Curso`, `Alumno`, `IdentificadorAlumno` existen con índices y unicidades adecuadas.
- Endpoints bajo `/api/colegio/*` usan `verifyAuth("SCHOOL_ADMIN")`, `verificarVigenciaColegio`, `withValidation`, `checkRateLimit`.
- Aislamiento por `colegioId` del usuario autenticado.

### Librerías disponibles

- No hay librerías para Excel/CSV en `package.json`.
- Se agregará `xlsx` (SheetJS) para parsear `.xlsx` y `.csv` (también la parsea).
- Alternativa manual para CSV si se prefiere no depender de `xlsx` para CSV.

### Patrones de validación reutilizables

- Schemas de Fase 2: `cursoBodySchema`, `alumnoBodySchema`, `identificadorAlumnoBodySchema`.
- Validación de plataforma: consultar `Plataforma` por nombre o id.
- Normalización de identificadores: `trim` + `toLowerCase()`.

### Patrones de archivos

- `src/app/api/admin/ia/simulaciones/[id]/export/route.ts` genera CSV manualmente con escape de comillas/comas.
- No hay endpoints de upload multipart en el proyecto; Next.js App Router soporta `request.formData()` nativamente para recibir archivos `File`.
- Se usará `FormData` para subir el archivo (campo `archivo`) y parsear su `ArrayBuffer` con `xlsx`.

## Decisiones técnicas

- Recibir archivo vía `FormData` (`request.formData()`) usando `File` y `ArrayBuffer`.
- Usar `xlsx` para parsear tanto `.csv` como `.xlsx` (unificado).
- Flujo: validar → devolver filas válidas + errores → confirmar con token JWT que contiene las filas válidas.
- Token JWT firmado con `JWT_SECRET` con corta duración (15 min).
- Upsert por curso y alumno dentro del colegio.

## Riesgos

- **Archivos maliciosos**: se parsean localmente, sin ejecución; no se guardan en disco.
- **Memoria**: tope de 500 filas limita tamaño.
- **Base64**: aumenta tamaño ~33%, aceptable para hasta 500 filas.
- **Duplicados**: validar tanto dentro del archivo como contra BD.
