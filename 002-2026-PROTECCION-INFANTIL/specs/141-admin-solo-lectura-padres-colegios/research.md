# Research: SPEC-141 — reverificación en fuente (2026-08-02)

## La carencia verificada (archivo:línea)

- El admin gestiona padres con privacidad explícita:
  `src/app/api/admin/padres/route.ts:14-17` — comentario: "Privacidad: solo
  metadatos de cuenta y conteo agregado de reportes; nunca textos,
  identificadores ni menores"; guard `verifyAuth("ADMIN")` +
  `assertModulo(admin, "padres")` + `admin_read` (`:19-23`).
- `src/app/api/admin/padres/[id]/route.ts` solo tiene mutaciones (`DELETE` en
  `:27`, más `reactivar/`, `restablecer-password/`, `vigencia/`) — NO hay GET de
  detalle ni del círculo.
- El círculo solo se sirve al dueño: `src/app/api/circulo-confianza/route.ts:28-33`
  (`GET` → `verifyAuth("PARENT")` → `listarContactos(usuario.id)`); idem el
  agregado (`src/app/api/circulo-confianza/agregado/route.ts:6-10`).
- El admin gestiona colegios: `src/app/api/admin/colegios/route.ts:64`
  (`assertModulo(admin, "colegios_gestion")`), pero cursos/alumnos solo se sirven
  al SCHOOL_ADMIN del tenant: `src/app/api/colegio/cursos/route.ts:20-22`,
  `src/app/api/colegio/alumnos/[id]/route.ts:21-23`.

## Materia prima para el reuso (sin lógica nueva)

- `listarContactos(usuarioId, client?)` —
  `src/lib/dal/services/circulo-confianza/contactos.ts:28`: ya parametrizado por
  usuario (cualquier `usuarioId`, no el del JWT); sin N+1 desde SPEC-135 (2
  queries constantes: contactos+identificadores, luego UNA de reportes).
  `obtenerDetalleContacto(id, usuarioId)` en `:106`.
- Predicado de estados del círculo (spec 093-US1):
  `src/lib/dal/services/circulo-confianza/estado.ts:12` — `whereReportesCirculo`:
  solo aprobados (`whereReporteAprobado`) + en revisión humana; SPAM/DUPLICADO no
  cuentan. Lenguaje estadístico heredado (§1.3).
- DAL colegio con tenant obligatorio (SPEC-134):
  `src/lib/dal/repositories/curso.ts:38` (`listarActivos(colegioId)`),
  `src/lib/dal/repositories/alumno.ts:36` (`contarPorCursoIds(colegioId, ids)`),
  `src/lib/dal/repositories/identificador-alumno.ts:34`
  (`IdentificadorAlumnoRepository`). La ruta de cursos del SCHOOL_ADMIN ya no
  toca prisma (`src/app/api/colegio/cursos/route.ts:45`).
- Aislamiento entre tenants verificable: `verificarPropiedadAlumno`
  (`src/app/api/colegio/alumnos/[id]/route.ts:42`) — el patrón equivalente para
  admin es comprobar `curso.colegioId === :id` de la ruta (404, no oráculo).

## Auditoría de lectura sensible: precedente y mecanismo

- `logAudit` en `src/lib/audit.ts:18`; la IP se persiste hasheada
  (`protegerIp`, `:12` — sha256+HMAC con ANTI_ABUSO_SALT, E-6).
- El enum `AccionAudit` (`prisma/schema.prisma:45`) ya tiene acciones de LECTURA
  sensible auditada: `APELACION_DOCUMENTO_ACCESO` (`:66`) y
  `TEXTO_ORIGINAL_REVELADO` (`:95`). No existe acción genérica de lectura admin →
  se añaden dos valores (migración aditiva de enum, sin datos).
- Modelos leídos: `ContactoConfianza` (`:877`), `IdentificadorContacto` (`:893`),
  `Curso` (`:458`), `Alumno` (`:475`), `IdentificadorAlumno` (`:492`) — sin
  cambios.

## UI de admin hoy

- Listados sin enlace a círculo/estructura:
  `src/app/dashboard/admin/padres/PadresPageClient.tsx`,
  `src/app/dashboard/admin/colegios/ColegiosPageClient.tsx`. El layout
  `src/app/dashboard/admin/layout.tsx` ya verifica rol antes de renderizar; las
  páginas nuevas heredan esa guarda.

## Decisiones de diseño (y por qué)

1. **Reuso del servicio del dueño, no vista paralela**: `listarContactos` ya toma
   `usuarioId`; una vista admin distinta inventaría una segunda fuente de verdad
   del estado del círculo. Mismo predicado = mismo lenguaje estadístico (§1.3).
2. **Endpoints nuevos bajo `api/admin/**`, no guard ADMIN en las rutas del
   dueño**: las rutas del padre y del colegio quedan intactas (cero riesgo de
   regresión para PARENT/SCHOOL_ADMIN); el guard ADMIN vive en rutas propias.
3. **Dos endpoints para el roster (cursos; alumnos por curso)**: devolver el
   roster completo de una vez no pagina bien (colegios grandes); el detalle por
   curso usa la paginación estándar.
4. **Auditoría solo en lo que expone identificadores**: círculo (siempre lleva
   identificadores) y alumnos (lleva nombres de menores + identificadores). La
   lista de cursos (sin menores) queda fuera de la obligación; se documenta la
   decisión en implementación si se audita igual.
5. **Sin `verificarVigenciaColegio` para admin**: esa guarda protege el servicio
   contratado del colegio; el soporte de plataforma necesita leer histórico aun
   con el servicio vencido (Assumption de la spec).

## Límite conocido

- El agregado del mapa del padre (`obtenerVistaAgregada`,
  `src/lib/dal/services/circulo-confianza/agregado.ts:87`) NO se expone al admin
  por defecto: es una vista de dashboard, no de soporte. Si ZEUS la quiere, es un
  include aditivo sobre el mismo endpoint.
