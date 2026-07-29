# Feature Specification: SPEC-121 — Sobre de error único (R2) + timeout de Ollama

**Feature Branch**: `feature/001-scaffolding`

**Created**: 2026-07-29

**Status**: FINALIZADO (ver `cierre.md`)

**Input**: Cola nocturna 002-PI-041, bloque B7 (ZEUS). Dos problemas:
1. **R2 (sobre de error único)**: 18 rutas API colapsan cualquier error con
   propiedad `code` a HTTP 403 (patrón `if (error instanceof Error && "code" in
   error && typeof error.code === "string") { return ...403 }`). Un error
   interno de Prisma (p.ej. `P2002`) sale al cliente como 403 con el código
   interno expuesto, enmascarando fallos reales y confundiendo al cliente.
2. **Timeout de Ollama**: los dos `fetch` a `/api/generate` de
   `src/lib/ai/ollama-client.ts` no tienen timeout: un modelo colgado bloquea
   el worker indefinidamente.

## User Stories

### US1 — Sobre de error único en rutas API (Priority: P1)

Como mantenedor de la plataforma, quiero que la conversión de errores a
respuesta HTTP viva en una pieza central (`src/lib/api-handler.ts`), para que
un error interno jamás vuelva a salir como 403 ni filtre códigos internos, y
para que el contrato `{ error: { message, code } }` sea uniforme.

**Acceptance Scenarios**

1. **Dado** un `AppError` con status 400/401/403/404/409/429/500, **cuando**
   una ruta migrada lo atrapa, **entonces** responde el mismo status y el mismo
   cuerpo `{ error: { message, code } }` que producía el código anterior.
2. **Dado** un error de Zod (`ZodError` o `ValidationError`), **cuando** una
   ruta migrada lo atrapa, **entonces** responde 400 con
   `code: VALIDATION_ERROR` y detalles `{ message, path }`.
3. **Dado** un `Error` con propiedad `code` string (p.ej. Prisma `P2002`),
   **cuando** una ruta migrada lo atrapa, **entonces** responde 500 genérico
   (`INTERNAL_ERROR`, mensaje "Error interno"): ya NO sale como 403 ni expone
   el código interno.
4. **Dado** cualquier otro error no controlado, **cuando** una ruta migrada lo
   atrapa, **entonces** responde 500 genérico sin exponer `error.message` y el
   detalle queda en el log del servidor.

### US2 — Timeout configurable de Ollama (Priority: P1)

Como operador, quiero que las llamadas de generación a Ollama tengan un límite
de espera configurable por parámetro (`ia.ollama.timeout_ms`, ADR_004), para
que un modelo colgado aborte en vez de bloquear el worker para siempre, sin
cambiar ninguna decisión del motor de clasificación.

**Acceptance Scenarios**

1. **Dado** el parámetro `ia.ollama.timeout_ms` con un valor entero positivo,
   **cuando** el cliente Ollama llama a `/api/generate`, **entonces** aplica
   `AbortSignal.timeout` con ese valor (cambiar el parámetro cambia el timeout
   aplicado — test de efecto).
2. **Dado** el parámetro ausente, vacío o inválido, **cuando** se resuelve el
   timeout, **entonces** se aplica el default documentado (120 000 ms).
3. **Dado** un fetch a Ollama que nunca responde, **cuando** vence el timeout,
   **entonces** la promesa aborta (rechaza) y el llamador recibe un error, no
   una espera infinita.
4. **Dado** una llamada que responde dentro del límite, **cuando** se aplica el
   timeout, **entonces** la respuesta y la clasificación son idénticas a las de
   antes (no se toca rúbrica, umbrales, terna ni modelos).

## Edge Cases

- `AppError` con `statusCode` fuera de lo común (p.ej. 413/503): se respeta tal
  cual (la pieza central usa `error.statusCode`, sin lista blanca).
- `ZodError` crudo lanzado fuera de `withValidation`: también mapea a 400.
- Valores no-`Error` lanzados (string, `null`, objetos planos): 500 genérico.
- `ia.ollama.timeout_ms` = `"0"`, negativo, no numérico o vacío: se ignora y
  aplica el default (fail-safe).
- Tabla `ParametroSistema` no disponible (startup temprano): fallback silencioso
  al default, igual que `getOllamaBaseUrl`.

## Functional Requirements

- **FR-001**: El sistema DEBE centralizar la conversión error→respuesta en
  `src/lib/api-handler.ts` (`errorToResponse` + wrapper `withErrorHandler`):
  `AppError` → su `statusCode` y `toJSON()`; `ZodError` → 400
  `VALIDATION_ERROR`; cualquier otro error → 500 `INTERNAL_ERROR` genérico.
- **FR-002**: La pieza central NO DEBE filtrar `error.code` de errores no
  controlados al cliente ni exponer `error.message` de excepciones internas;
  el detalle se registra con `console.error` en formato `[Módulo] ...`.
- **FR-003**: Las 18 rutas con el colapso a 403 DEBEN migrarse a la pieza
  central preservando las ramas específicas legítimas previas al colapso
  (p.ej. "Alumno no encontrado" → 404) y las respuestas explícitas de negocio
  (403 por rol/vigencia, 409, 429) que no pasan por el `catch`.
- **FR-004**: El sistema DEBE demostrar equivalencia con tests: para cada forma
  de respuesta legítima actual (AppError 400/401/403/404/409/429/500 y
  contrato `{ error: { message, code } }`), el wrapper produce lo mismo; y el
  colapso indiscriminado a 403 desaparece.
- **FR-005**: Los `fetch` a `/api/generate` de `src/lib/ai/ollama-client.ts`
  DEBEN aplicar `AbortSignal.timeout` con el valor de
  `ia.ollama.timeout_ms` (entero positivo, ms) o el default 120 000 ms.
- **FR-006**: El timeout NO DEBE cambiar ninguna decisión de clasificación:
  solo acota la espera. Se verifica con el test de efecto del motor
  (`efecto-motor-111.test.ts`) verde.
- **FR-007**: El parámetro `ia.ollama.timeout_ms` DEBE existir en el seed
  (`TipoParametro.INTEGER`, `CategoriaParametro.SYSTEM`) con su default y
  descripción documentados; en ausencia del parámetro rige el default en código.

## Success Criteria

- **SC-1**: `grep "safeErrorMessage(error), code: error.code"` en `src/app/api`
  devuelve 0 ocurrencias tras la migración (27 antes, en 18 rutas).
- **SC-2**: El test de equivalencia de `api-handler` pasa: mismos status y
  contrato para AppError/Zod; un `Error` con `code` ya no produce 403.
- **SC-3**: Tests de las rutas migradas verdes sin modificar aserciones.
- **SC-4**: Test de efecto del timeout: cambiar `ia.ollama.timeout_ms` cambia el
  valor pasado a `AbortSignal.timeout`; un fetch colgado aborta.
- **SC-5**: Gate completo verde (tsc + lint + tests + build) y suite completa
  `npm run test` verde, incluido `efecto-motor-111.test.ts`.

## Assumptions

- Las 18 rutas afectadas son todas admin/colegio (autenticadas); no hay rutas
  públicas sin autenticación con este patrón (verificado con grep sobre
  `src/app/api`): la prioridad "públicas primero" no aplica.
- Los 403 explícitos de negocio (rol, vigencia, módulo) fuera del `catch` son
  deliberados y NO se tocan.
- `src/app/api/reportes/procesar/helpers/finalizacion.ts` (`obtenerErrorCode`)
  usa `"code" in error` para estado interno del pipeline (no es un colapso a
  403 ni una respuesta HTTP): NO se migra.
- El default 120 000 ms es generoso frente a las latencias reales de generación
  (modelos grandes en CPU) para no introducir abortos espurios; los timeouts ya
  existentes de embeddings (8 s) y `/api/tags` (10 s) se mantienen.
- Ollama es local (ADR: IA local); un abort por timeout se trata como error de
  clasificación recuperable por el worker, no como decisión del motor.

## Implementación

Completada el 2026-07-29 (bloque B7, cola 002-PI-041). Pieza central
`src/lib/api-handler.ts` (`errorToResponse`/`withErrorHandler`) con test de
equivalencia contra la lógica legacy replicada; **18/18 rutas migradas** (0
colapsos a 403 restantes en `src/app/api`); timeout de generación Ollama vía
`ia.ollama.timeout_ms` (default 120 000 ms) aplicado en
`src/lib/ai/ollama-client.ts` con test de efecto. Gate verde (tsc, lint,
build, suite 1066/1067 — el único fallo es el índice `specs/README.md`,
prohibido en este bloque y a cargo del coordinador). Detalle, commits,
hallazgos (rama deliberada `EXCLUSIVIDAD_ROL` conservada; AppError de auth que
colapsaba a 403 en 5 rutas) y deuda en `cierre.md`; tabla de migración en
`plan.md`.
