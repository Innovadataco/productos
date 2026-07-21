# Plan: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Constitution Check

- **Solo-texto**: todos los artefactos son texto plano Markdown/TS/Prisma.
- **IA local sin terceros**: se usa Ollama local; no se envía PII a servicios externos.
- **Lenguaje sin veredictos**: la UI del colegio no emite juicios de culpabilidad.
- **Migraciones aditivas**: nuevas tablas/columnas, nunca `migrate reset`.
- **Un solo worker**: el deploy mantiene un solo worker.
- **Cobertura Vitest**: todo endpoint nuevo con su `.test.ts`.

Constitution Check: **PASADO**.

## Technical Context

- **Base**: Fase 1 (spec 074) cerrada con `Colegio`, `Usuario.colegioId`, `Tenant`, `SCHOOL_ADMIN` aislado, tema verde `.theme-colegio`.
- **Patrón a reutilizar**: `IdentificadorContacto` del Círculo de Confianza (`valor`, `tipo`, `plataformaId`, `@@unique([parentId, valor, plataformaId])`).
- **Anonimización**: aún NO se conecta en Fase 2; se preparan identificadores normalizados para Fase 4.
- **Aislamiento**: todos los queries de SCHOOL_ADMIN filtran por `colegioId` del usuario autenticado; validar propiedad en mutaciones con `404`.
- **Stack**: Next.js 16 + Prisma + PostgreSQL + Tailwind + shadcn-style UI components.

## Complexity Tracking

| Nivel | Descripción | Justificación |
|-------|-------------|---------------|
| Complejidad | Media-Alta | ABM triple con aislamiento, auditoría, normalización de identificadores y tests de seguridad. |
| Riesgo | Medio | El aislamiento por colegio es crítico; se mitiga con tests exhaustivos. |
| Dependencias | Baja | Depende de la Fase 1 ya cerrada; no toca Reporte ni IA. |

## Decisiones de diseño

- `Alumno` duplica `colegioId` para facilitar validaciones de aislamiento sin joins innecesarios.
- `IdentificadorAlumno` no tiene `colegioId` propio porque se valida vía `alumno.colegioId`.
- Estado: `activo`/`inactivo` (soft delete) en todas las entidades.
- Etiqueta de relación canónica en schema Prisma como enum para evitar valores arbitrarios.
- Plataforma opcional para soportar identificadores genéricos (teléfono, email) sin plataforma.
