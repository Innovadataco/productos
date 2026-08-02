# Implementation Plan: SPEC-141 — Admin solo lectura: círculo de padres + estructura de colegios (N-1)

**Branch**: `feature/001-scaffolding` | **Date**: 2026-08-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `specs/141-admin-solo-lectura-padres-colegios/spec.md` (002-PI-056, N-1)

## Summary

Visibilidad de apoyo para el ADMIN de plataforma, estrictamente de solo lectura:
(a) el círculo de confianza de un padre (contactos + identificadores + estados
derivados), reutilizando el servicio `listarContactos(usuarioId)` que hoy solo
sirve al dueño; (b) los cursos y alumnos de un colegio (con identificadores),
leyendo por los repositorios del DAL con `colegioId` obligatorio. Cero escritura:
las mutaciones siguen exclusivas del padre y del SCHOOL_ADMIN. Cada lectura que
expone identificadores deja fila en `AuditLog` con acciones nuevas del enum
(migración aditiva).

## Technical Context

**Language/Version**: TypeScript 5 (strict), Node.js >= 22
**Primary Dependencies**: `src/lib/dal/services/circulo-confianza/contactos.ts`
(`listarContactos`), `src/lib/dal/repositories/curso.ts` + `alumno.ts` +
`identificador-alumno.ts`, `src/lib/permisos-modulos.ts` (`assertModulo`),
`src/lib/audit.ts` (`logAudit`). Nada nuevo.
**Storage**: PostgreSQL — único cambio: valores nuevos en enum `AccionAudit`
(migración aditiva, sin datos)
**Testing**: Vitest — tests de ruta por endpoint (patrón del repo) + red existente
**Project Type**: feature de soporte/operación (visibilidad de solo lectura)
**Constraints**: FR-003 — cero verbos de escritura para ADMIN sobre estos
recursos; FR-004 — auditoría sin PII en metadatos; §1.3 — lenguaje estadístico
**Scale/Scope**: 3 route.ts nuevos + 2 páginas admin + enum + tests

## Constitution Check

- **Presunción de inocencia (§1.3)**: OK — las vistas muestran estados derivados
  con el predicado y lenguaje estadístico existentes (`whereReportesCirculo`,
  spec 093-US1); ningún veredicto nuevo. No se toca la consulta pública.
- **Solo texto**: OK — no se sube ni procesa multimedia.
- **IA local**: N/A — la feature no usa IA.
- **Canales oficiales**: N/A — no es interfaz de reporte; las vistas admin de
  soporte no alteran los avisos visibles de Línea 141/CAI/Te Protejo.
- **Disputas / Ley 1581**: REFORZADA — el acceso de soporte a identificadores
  queda auditado (FR-004), trazable ante el titular.
- **No modificar texto original de reportes**: OK — las vistas no muestran ni
  tocan textos de reportes (los servicios leen metadatos y conteos).
- **Migraciones aditivas**: OK — solo valores nuevos en un enum.

Sin violaciones que justificar.

## Diseño

### 1. Círculo de confianza del padre (FR-001/FR-004)

Nuevo `src/app/api/admin/padres/[id]/circulo-confianza/route.ts`, SOLO `GET`:

1. `verifyAuth("ADMIN")` + `assertModulo(admin, "padres")` + `checkRateLimit(request, "admin_read")` (patrón de `api/admin/padres/route.ts`).
2. Resolver el padre (`UsuarioRepository.findPadreById`, que ya filtra rol
   PARENT); si no existe → 404 genérico.
3. `listarContactos(padre.id)` — el servicio ya está parametrizado por
   `usuarioId` (SPEC-135; 2 queries constantes, sin N+1) y devuelve contactos +
   identificadores + estados derivados. Opcional: incluir `obtenerVistaAgregada`
   solo si la UI la necesita (decisión en implementación; por defecto NO — el
   agregado del mapa es del dashboard del padre).
4. `logAudit` con la acción nueva de acceso al círculo, `usuarioId` = admin,
   `recursoId` = id del padre, IP vía `getClientInfo` (ya hasheada por
   `protegerIp`), metadatos: `{ contactos: <conteo> }` (sin valores).

UI: enlace "Ver círculo (solo lectura)" desde
`dashboard/admin/padres/PadresPageClient.tsx` → página nueva
`dashboard/admin/padres/[id]/circulo/page.tsx` (client component de lectura,
badge "Solo lectura", sin formularios).

### 2. Cursos y alumnos del colegio (FR-002/FR-004)

Dos route.ts nuevos, SOLO `GET`, guard `verifyAuth("ADMIN")` +
`assertModulo(admin, "colegios_gestion")` + `admin_read`:

- `src/app/api/admin/colegios/[id]/cursos/route.ts`: cursos del colegio vía
  `CursoRepository` (mismo repo que usa el SCHOOL_ADMIN; `listarActivos(colegioId)`
  + conteo de alumnos por curso vía `AlumnoRepository.contarPorCursoIds`). Sin
  auditoría obligatoria (nombres de curso, sin menores) — se registra igual si el
  costo es cero (decisión en implementación; documentar).
- `src/app/api/admin/colegios/[id]/cursos/[cursoId]/alumnos/route.ts`: verifica
  que el curso pertenece al colegio de la ruta (404 si no — aislamiento por
  tenant del DAL) y devuelve alumnos paginados (`page`/`pageSize`, default 25,
  máx 100) con sus identificadores (tipo, valor, plataforma, etiquetaRelacion)
  vía `AlumnoRepository`/`IdentificadorAlumnoRepository`. `logAudit` con la
  acción de acceso al roster, `recursoId` = colegio, metadatos:
  `{ cursoId, page }` (sin nombres ni valores).

Nota de vigencia: NO se llama `verificarVigenciaColegio` (esa guarda es para el
SCHOOL_ADMIN; el ADMIN consulta histórico — Assumption de la spec).

UI: enlace "Ver cursos y alumnos (solo lectura)" desde
`dashboard/admin/colegios/ColegiosPageClient.tsx` → página nueva
`dashboard/admin/colegios/[id]/estructura/page.tsx` (cursos expandibles →
alumnos paginados; badge "Solo lectura"; sin acciones).

### 3. Auditoría de acceso (FR-004)

Migración aditiva: dos valores nuevos en `enum AccionAudit` (estilo del enum:
`CIRCULO_CONFIANZA_ACCESO_ADMIN`, `COLEGIO_ROSTER_ACCESO_ADMIN`). Precedente de
auditoría de lectura sensible: `APELACION_DOCUMENTO_ACCESO`. Solo se audita la
lectura exitosa (200) de los endpoints que exponen identificadores; los 403/404
no generan fila.

## Data Model

Sin entidades nuevas. Único cambio de schema (migración aditiva, reversible por
nueva migración, sin datos):

```prisma
enum AccionAudit {
  // ... existentes ...
  CIRCULO_CONFIANZA_ACCESO_ADMIN
  COLEGIO_ROSTER_ACCESO_ADMIN
}
```

Modelos leídos (sin cambios): `ContactoConfianza`/`IdentificadorContacto`
(schema.prisma:877/893), `Curso`/`Alumno`/`IdentificadorAlumno`
(schema.prisma:458/475/492).

## Contracts

Sí hay endpoints nuevos: ver [contracts/admin-solo-lectura.md](contracts/admin-solo-lectura.md).

## Fases de implementación (resumen para tasks)

1. **Migración de enum** + endpoint círculo + test (FR-001/FR-004).
2. **Endpoints colegio** (cursos + alumnos) + tests (FR-002/FR-004).
3. **UI admin**: enlaces + 2 vistas de solo lectura (FR-005).
4. **Gates + cierre**: suite, tsc, lint, build, regenerar línea base de
   arquitectura (rutas/navegación nuevas) + `arch:check` verde.
