# Feature Specification: Validación uniforme (zod)

**Feature Branch**: `[feature/001-scaffolding]`

**Created**: 2026-07-20

**Status**: CERRADA

**Input**: PROGRAMA DE SANEAMIENTO — Fase 3: estandarizar la validación de entradas en todas las rutas de mutación usando zod, eliminando validaciones manuales dispersas y reduciendo la superficie de error de tipo/validación. No se modifica lógica de negocio ni se tocan SPEC-050 ni SPEC-060.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Validación uniforme con zod en rutas de mutación admin (Priority: P1)

El sistema tiene rutas de mutación admin que aún usan validación manual o no validan su entrada. Esto produce mensajes de error inconsistentes, riesgo de datos inesperados y duplicación de lógica. Se requiere una capa única de validación basada en zod con esquemas reutilizables y un helper `withValidation` que se aplique a todas las rutas de mutación admin sin esquema.

**Why this priority**: Una entrada malformada o inyectada en una ruta admin puede propagarse a la base de datos, auditoría o modelos de IA. La validación uniforme es prerequisito para cualquier saneamiento posterior de la API.

**Independent Test**: Ejecutar `npm run test` y ver que los tests de `src/lib/validation.test.ts` y `src/lib/schemas/index.test.ts` pasan, y que las rutas admin de mutación afectadas rechazan entradas inválidas con `VALIDATION_ERROR` (400).

**Acceptance Scenarios**:

1. **Given** una ruta admin de mutación sin esquema, **When** se le envía un body JSON inválido, **Then** el sistema responde `400` con código `VALIDATION_ERROR` y detalles estructurados antes de ejecutar lógica de negocio.
2. **Given** `src/app/api/admin/ia/evals/route.ts` (POST), **When** se le envía un body no vacío, **Then** responde `400` porque no espera parámetros.
3. **Given** `src/app/api/admin/ia/ollama/probar/route.ts` (POST), **When** se omite el campo `url` o no es string, **Then** responde `400` sin llamar a Ollama.
4. **Given** `src/app/api/admin/ia/sandbox/route.ts` (POST), **When** se envía `texto` vacío o mayor a 4000 caracteres, **Then** responde `400`.
5. **Given** `src/app/api/config/parametros/[clave]/route.ts` (PATCH), **When** se envía `valor` vacío o un `tipo` no permitido, **Then** responde `400`.
6. **Given** `src/app/api/admin/operadores/[id]/reactivar`, `reenviar-email` y `regenerar-password` (POST), **When** el parámetro `id` no es un cuid válido, **Then** responde `400`.
7. **Given** `src/app/api/admin/ia/experimentos/[id]/preparar-activacion` (POST) y `src/app/api/admin/ia/evals/casos/[id]/desactivar` (PATCH), **When** el parámetro `id` no es un cuid válido, **Then** responde `400`.
8. **Given** `src/app/api/admin/apelaciones/vencer/route.ts` (POST), **When** el header `x-worker-secret` es incorrecto o se envía un body inesperado, **Then** se rechaza con `403` o `400` respectivamente.
9. **Given** una entrada válida en cualquiera de las rutas anteriores, **When** se supera la validación, **Then** la lógica de negocio existente se ejecuta sin cambios.

---

## Edge Cases

- **US1**: ¿Qué ocurre si el body no es JSON? `withValidation` debe capturar el parse error y devolver `400` con `VALIDATION_ERROR`.
- **US1**: ¿Qué pasa si una ruta ya usa zod inline con otro patrón? No se modifica; el helper se aplica solo a rutas sin esquema o con validación manual.
- **US1**: ¿Qué pasa si un parámetro de ruta es numérico (por ejemplo, fixtureVersion)? Se deja la conversión numérica dentro del handler; el schema valida string con formato adecuado.
- **US1**: ¿Qué pasa si una ruta admin futura no valida? Los tests de cobertura del helper no la cubrirán, pero el patrón queda documentado en `src/lib/schemas` para que el desarrollador lo apliqué.

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE crear un módulo central `src/lib/schemas` con esquemas zod reutilizables para identificadores (`cuid`), emails, claves de parámetros y payloads admin recurrentes.
- **FR-002**: El sistema DEBE crear un helper `withValidation` en `src/lib/validation.ts` que valide body y parámetros de ruta con zod y devuelva errores estructurados con código `VALIDATION_ERROR` (400).
- **FR-003**: El sistema DEBE aplicar `withValidation` a las rutas admin de mutación sin esquema: IA (`evals`, `experimentos/[id]/preparar-activacion`, `ollama/probar`, `sandbox`), operadores (`[id]/reactivar`, `[id]/reenviar-email`, `[id]/regenerar-password`), configuración (`config/parametros/[clave]`) y apelaciones (`vencer`).
- **FR-004**: El sistema DEBE conservar la lógica de negocio existente; solo se añade o sustituye la validación de entrada.
- **FR-005**: El sistema DEBE añadir tests unitarios para los esquemas reutilizables y el helper `withValidation`.
- **FR-006**: El sistema DEBE mantener el mensaje de error canónico `VALIDATION_ERROR` y formato `{ error: { message, code, details? } }`.
- **FR-007**: El sistema DEBE documentar el uso de `withValidation` y los esquemas en `quickstart.md` para desarrolladores futuros.

### Key Entities

- **Esquema zod**: Definición declarativa de tipos y reglas de validación.
- **Ruta de mutación**: Endpoint HTTP que modifica estado (POST, PATCH, PUT, DELETE).
- **Helper `withValidation`**: Función utilitaria que parsea y valida body/params contra un esquema zod.
- **`src/lib/schemas`**: Biblioteca de esquemas reutilizables por módulo.
- **`ValidationError`**: Error de negocio con código `VALIDATION_ERROR` y detalles de zod.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100% de las rutas admin de mutación listadas en FR-003 usan zod para validar body y/o params.
- **SC-002**: Todos los tests de `src/lib/validation.test.ts` y `src/lib/schemas/index.test.ts` pasan en `npm run test`.
- **SC-003**: `npx tsc --noEmit`, `npm run lint` y `npm run test` pasan sin errores introducidos por este spec.
- **SC-004**: El helper `withValidation` produce respuestas `400` con `VALIDATION_ERROR` y detalles estructurados para body/params inválidos.
- **SC-005**: El spec 048 se cierra con `cierre.md` y sección de Implementación en `spec.md`.

---

## Assumptions

- zod v4 ya está instalado en el proyecto (`"zod": "^4.4.3"`).
- No se requieren migraciones de base de datos: solo cambios de validación de entrada.
- La lógica de negocio actual de las rutas afectadas es correcta; este spec no la altera.
- Los tests de integración existentes de `operadores` y `parametros` se mantienen; los nuevos tests son unitarios.
- El despliegue local usa `./scripts/dev-restart.sh` con un solo worker.
- SPEC-050 y SPEC-060 no se modifican ni se bloquean.

---

## Implementación (documentado el 2026-07-20)

### Objetivo alcanzado

Se entregó una capa única de validación zod para rutas de mutación admin, eliminando validaciones manuales dispersas y estandarizando respuestas `400` con `VALIDATION_ERROR`.

### Decisiones de diseño derivadas del código

- **Esquemas centralizados**: se creó `src/lib/schemas/index.ts` con esquemas reutilizables por dominio (IA, operadores, parámetros, identificadores). Esto reduce duplicación y facilita mantener reglas como `max 4000 caracteres`, `cuid` y enums de Prisma en un solo lugar.
- **Helper `withValidation`**: se creó `src/lib/validation.ts` con `withValidation.body(schema)` y `withValidation.params(schema)`. Ambos lanzan `ValidationError` (extiende `AppError`) con código `VALIDATION_ERROR` y detalles estructurados de zod.
- **Rutas afectadas**: se aplicó validación a las rutas admin de mutación sin esquema:
  - `admin/ia/evals` (POST), `admin/ia/evals/casos/[id]/desactivar` (PATCH), `admin/ia/experimentos/[id]/preparar-activacion` (POST), `admin/ia/ollama/probar` (POST), `admin/ia/sandbox` (POST).
  - `admin/operadores/[id]/reactivar`, `admin/operadores/[id]/reenviar-email`, `admin/operadores/[id]/regenerar-password` (POST).
  - `config/parametros/[clave]` (PATCH y DELETE).
  - `admin/apelaciones/vencer` (POST).
- **Manejo de errores**: las rutas `operadores/[id]/{reactivar,reenviar-email,regenerar-password}` tenían un catch genérico que convertía cualquier error con `code` a `403`. Se actualizaron para usar `error instanceof AppError` y respetar `statusCode`, alineándose con el saneamiento de errores del Spec 046.
- **Sin cambios de lógica**: la lógica de negocio de cada handler se conservó intacta; solo se sustituyó la validación de entrada manual por zod.

### Endpoints y componentes afectados

- `src/lib/schemas/index.ts` (nuevo) y `src/lib/schemas/index.test.ts`.
- `src/lib/validation.ts` (nuevo) y `src/lib/validation.test.ts`.
- Rutas admin modificadas:
  - `src/app/api/admin/ia/evals/route.ts`
  - `src/app/api/admin/ia/evals/casos/[id]/desactivar/route.ts`
  - `src/app/api/admin/ia/experimentos/[id]/preparar-activacion/route.ts`
  - `src/app/api/admin/ia/ollama/probar/route.ts`
  - `src/app/api/admin/ia/sandbox/route.ts`
  - `src/app/api/admin/operadores/[id]/reactivar/route.ts`
  - `src/app/api/admin/operadores/[id]/reenviar-email/route.ts`
  - `src/app/api/admin/operadores/[id]/regenerar-password/route.ts`
  - `src/app/api/config/parametros/[clave]/route.ts`
  - `src/app/api/admin/apelaciones/vencer/route.ts`

### Tests

- `src/lib/validation.test.ts`: 11 tests, todos pasan.
- `src/lib/schemas/index.test.ts`: 24 tests, todos pasan.
- Suite completa: 531 tests en 92 archivos, todos pasan.
- `npx tsc --noEmit`: OK.
- `npm run lint`: OK (1 warning preexistente en `GestionPageClient.tsx`).
- Quickstart validado con curl: todas las rutas afectadas devuelven `400` ante entradas inválidas.

### Migraciones

Ninguna. No se modifica el modelo de datos.

### Deuda técnica

- Quedan rutas de mutación fuera del alcance de este spec (autenticación, reportes, alertas) que aún no usan zod. Se documentó el patrón en `src/lib/schemas` y `quickstart.md` para futuros specs de saneamiento.
- `ValidationError` requiere `Object.setPrototypeOf(this, ValidationError.prototype)` porque `AppError` redefine el prototype. Si en el futuro se refactoriza `AppError` para no necesitarlo, este workaround puede eliminarse.
