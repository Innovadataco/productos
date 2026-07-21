# Research: Colegios · Fase 2 — Cursos, Alumnos e Identificadores

## Hallazgos verificados

### Modelo Colegio / Usuario (Fase 1)

- `Colegio` tiene `tenantId` único y relación `admin: Usuario?`.
- `Usuario` tiene `colegioId` único y `tenantId`; al crear un colegio se vinculan transaccionalmente.
- SCHOOL_ADMIN está aislado de admin/operador/comité/reportes en `src/lib/proxy.ts` y `src/lib/auth.ts`.

### Patrón de identificadores reutilizable

- `IdentificadorContacto` del Círculo de Confianza (`src/lib/circulo-confianza.ts`) usa `valor`, `tipo`, `plataformaId` y `@@unique([contactoId, valor, plataformaId])`.
- Normalización: se asume minúsculas + trim para matching; se aplicará el mismo criterio en `IdentificadorAlumno`.
- La tabla `Plataforma` existe y se puede referenciar opcionalmente.

### Endpoints y autenticación

- `verifyAuth("SCHOOL_ADMIN")` en `src/lib/auth.ts` verifica el rol.
- `verificarVigenciaColegio(usuarioId)` en `src/lib/colegio/vigencia.ts` asegura que el colegio esté activo y vigente.
- `withValidation` en `src/lib/validation.ts` facilita validación zod en endpoints.
- `checkRateLimit` en `src/lib/rate-limit.ts` se aplica a escrituras.

### UI

- Tema verde `.theme-colegio` definido en `src/app/globals.css`.
- Componentes reutilizables en `src/components/ui/`.
- `src/app/dashboard/colegio/layout.tsx` y `page.tsx` son el punto de partida.

### Tests

- `src/app/api/admin/colegios/route.test.ts` es el patrón a seguir para aislamiento y mocks.
- `src/lib/circulo-confianza.test.ts` cubre lógica de identificadores/contactos.

## Decisiones técnicas

- Reutilizar `plataformaId` de `Plataforma`; `tipo` como string libre para teléfono/email/nick/usuario.
- Etiqueta de relación como enum en Prisma para integridad referencial.
- `Alumno` incluye `colegioId` denormalizado para queries rápidos de aislamiento.
- No se conecta a matching ni alertas en esta fase (Fase 4).

## Riesgos

- **Aislamiento**: el riesgo principal es que un SCHOOL_ADMIN vea datos de otro colegio. Se mitiga con tests de propiedad en cada endpoint y filtro por `colegioId` en todos los SELECT.
- **PII**: se almacena solo el nombre del alumno; los identificadores se requieren para la funcionalidad de alerta futura.
- **Normalización**: se debe mantener coherencia con el Círculo de Confianza para que el matching futuro funcione.
