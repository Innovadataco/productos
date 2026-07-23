# Research — Deuda técnica P0 (Fase 0)

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-22

Hallazgos verificados leyendo el código real (`vitest.config.ts`, `src/lib/auth.ts`,
`src/lib/prisma.ts`, `src/lib/documentProcessor.ts`, las 20 rutas de `src/app/api/`
y los componentes que las consumen), más las mediciones ejecutadas hoy.

## D-01 — Cómo cargar el entorno en Vitest

- **Hecho verificado (spec 001)**: Vitest **no** inyecta `.env` en `process.env` en
  este proyecto. Un test sonda devolvió `JWT_SECRET` de longitud 0 y
  `DATABASE_URL: AUSENTE`, con `.env` presente en la raíz.
- **Decision**: crear `.env.test` versionado con valores dummy y cargarlo desde
  `vitest.config.ts` hacia `process.env` antes de ejecutar la suite.
- **Rationale**: mantiene el entorno de test **explícito y reproducible** (un clon
  limpio pasa la suite sin configurar nada) y **aislado** del `.env` local del
  desarrollador, que contiene credenciales reales. Cumple FR-001 y §0.4: lo
  versionado son valores dummy, no secretos.
- **Alternatives considered**:
  - (a) `setupFiles` con `dotenv.config({path: '.env'})` — rechazado: acopla la suite
    al `.env` real del desarrollador; en CI o clon limpio no existe y vuelve el fallo.
  - (b) Definir las variables inline en `vitest.config.ts` — rechazado: mezcla config
    de herramienta con datos de entorno; más difícil de extender por test.
  - (c) Exigir que cada test haga `vi.stubEnv` — rechazado: repetitivo y no resuelve
    el throw en tiempo de *import* (ver D-02), que ocurre antes del cuerpo del test.

## D-02 — No eliminar el `throw` de `auth.ts`

- **Hecho**: `src/lib/auth.ts:4-8` lanza al evaluarse el módulo si `JWT_SECRET` falta
  o mide menos de 32 caracteres. Es la causa directa del archivo rojo: el `import`
  de la ruta revienta antes de que corra ningún test.
- **Decision**: **conservar** la validación tal cual; resolver el problema
  proveyendo la variable desde `.env.test` (D-01).
- **Rationale**: fallar rápido al arrancar sin secreto de firma es una protección
  deseable en producción — degradarla a validación perezosa cambiaría el
  comportamiento de arranque para acomodar al harness, que es exactamente al revés
  de como debe decidirse. El defecto estaba en el harness, no en la validación.
- **Alternatives considered**: (a) evaluación perezosa dentro de las funciones —
  rechazado por lo anterior; (b) valor por defecto si falta — rechazado: un secreto
  de firma por defecto es un agujero de seguridad.

## D-03 — Forma del contrato de error normalizado

- **Hecho**: hoy conviven al menos tres formas distintas de error:
  `{ error: err.message }`, `{ error: "...", details: error.message }` y
  `{ ok: false, error: err.message, latencyMs }`. Trece archivos filtran el mensaje
  de excepción al cliente.
- **Decision**: forma única `{ error: string }` con el mensaje **legible para el
  usuario**, más un helper `apiError(modulo, accion, mensajeCliente, status, err?)`
  que registra el detalle técnico en el log del servidor con el formato de §2.5.
- **Rationale**: es el contrato mínimo que el frontend ya consume (D-04), no filtra
  interioridades y hace la migración mecánica y verificable con un grep.
- **Alternatives considered**:
  - (a) Añadir un `code` de error de negocio al contrato — rechazado *para esta spec*:
    útil, pero es diseño nuevo, no saneamiento; ampliaría el alcance y tocaría el
    frontend. Candidato a spec futura.
  - (b) Mantener `details` solo en desarrollo (`NODE_ENV`) — rechazado: deja la fuga
    latente y hace que el contrato dependa del entorno, lo que dificulta testearlo.
- **Nota de alcance**: las rutas que devuelven campos extra legítimos junto al error
  (p. ej. `research/analyze` con `rawText`/`latencyMs`, `config/models/test` con
  `text`) conservan esos campos; lo que se elimina es el **mensaje de excepción**.

## D-04 — Verificación previa del contrato con el frontend (de-riesgo de FR-011)

- **Hecho verificado**: los componentes leen `error.error`
  (`src/components/modules/LicitacionesTab.tsx:121` y `:461`,
  `src/components/ProjectForm.tsx:33`); **ningún componente lee `.details`**
  (`grep` sobre `src/components` y `src/app` en `.tsx` → 0 coincidencias).
- **Decision**: eliminar `details` del contrato sin plan de migración del frontend.
- **Rationale**: no hay consumidor; el riesgo de "pantalla mostrando undefined" que
  la spec anticipaba como edge case no se materializa. Aun así, US2 revisa los
  componentes de las rutas migradas antes de dar el tramo por cerrado.

## D-05 — Tipado de los callbacks de pdf2json

- **Hecho**: los 5 `any` de `src/lib/documentProcessor.ts` (líneas 147, 154, 159-161)
  son la firma de los eventos de `pdf2json` y el recorrido `Pages[].Texts[].R[].T`.
  El paquete no expone tipos utilizables para ese flujo en la versión instalada.
- **Decision**: declarar interfaces locales mínimas que describan solo la forma
  consumida (`PdfParserError`, `PdfPage`, `PdfText`, `PdfRun`), en el propio módulo.
- **Rationale**: da seguridad de tipos real en el punto de uso sin depender de que
  la librería publique tipos; es el patrón que la constitución §2.1 pide
  (`unknown` + narrowing en vez de `any`).
- **Alternatives considered**: (a) `@types/pdf2json` — no existe como paquete
  mantenido para esta versión; (b) `unknown` + validación en runtime — rechazado por
  ahora: más código y el JSON de pdf2json ya viene validado por la propia librería.
- **Nota**: `documentProcessor.ts` arrastra además un `require()` de `pdf2json`
  (error de ESLint preexistente, constitución §8.1). **Fuera del alcance** de esta
  spec (que se limita a `any`), pero conviene señalarlo: es el mismo archivo.

## D-06 — Orden US2 antes que US3 (evitar reescribir dos veces)

- **Hecho**: 13 de los 16 archivos con `any` en rutas API son los mismos que filtran
  `err.message`, y buena parte de esos `any` son precisamente `catch (err: any)`.
- **Decision**: ejecutar US2 (errores) antes que US3 (tipado), como pidió ZEUS.
- **Rationale**: migrar a `apiError` convierte `catch (err: any)` en
  `catch (err: unknown)` de forma natural, así que US3 hereda gran parte del trabajo
  ya hecho y solo se ocupa del remanente (filtros de Prisma, `documents/route.ts`,
  `documentProcessor.ts`). El orden inverso obligaría a tocar los mismos archivos dos
  veces con riesgo de conflicto.

## D-07 — Estrategia de mocks para la suite unitaria

- **Hecho**: ya existe un patrón validado en el repositorio —
  `src/app/api/config/apis/[id]/test/route.test.ts` (escrito en la spec 001) mockea
  `@/lib/prisma` con `vi.mock` y `fetch` con `vi.stubGlobal`, y corre sin BD.
- **Decision**: extraer ese patrón a `src/test/prismaMock.ts` y reutilizarlo en los
  16 archivos nuevos de US4.
- **Rationale**: coherencia con lo que ya funciona en el repo y menos repetición; el
  mock del singleton `prisma` es la única dependencia de infraestructura real que
  tienen las rutas.
- **Alternatives considered**: (a) BD de test dedicada (testcontainers o esquema
  aparte) — rechazado explícitamente por la spec (Assumptions): sería suite de
  integración, spec propia; (b) `prisma-mock` / librería externa — rechazado: añade
  dependencia para algo que ya se resuelve con `vi.mock`.

## D-08 — Métrica honesta de ESLint

- **Hecho**: baseline 112 problemas (90 errores + 22 warnings). De ellos, ~34 son
  `no-explicit-any` en las zonas que esta spec sanea; el resto son `prefer-const`,
  variables sin usar, `require()` y `any` en componentes `.tsx` (fuera de alcance).
- **Decision**: el criterio formal es SC-005 (< 112 y 0 `no-explicit-any` en las
  zonas saneadas), pero al cierre se **reporta el número real** alcanzado.
- **Rationale**: un umbral de "menos que 112" se cumple bajando un solo error; sería
  un criterio que no mide nada. El número real es la evidencia útil para ZEUS.
