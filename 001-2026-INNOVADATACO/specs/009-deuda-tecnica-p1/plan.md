# Implementation Plan: Deuda técnica P1 (saneamiento medido)

**Branch**: `feature/001-scaffolding` (rama de PRUEBAS; dir de spec: `009-deuda-tecnica-p1`) | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: `specs/009-deuda-tecnica-p1/spec.md` (Status: **Pre-aprobada D-063**, alcance medido
por ZEUS y verificado por ODIN antes de escribir código).

## Summary

Cerrar la deuda P1 **medida**: lint a 0 errores en `src/` salvo lo que se declare, código
muerto fuera, las dos listas sin paginar paginadas (§3.3), los dos tests que faltaban (§4.4),
el `require()` eliminado (§8.1) y Zod aplicado donde más entra input (§5.2).

**No es trabajo pesado.** No hay migración: esta spec no toca el esquema.

## Principio que ordena el trabajo: por riesgo creciente

El orden no es por prioridad de la spec, es por **riesgo**. En un turno desatendido lo que
importa es que cada paso quede verde y commiteado antes de empezar el siguiente:

| # | Bloque | Riesgo | Por qué |
|---|---|---|---|
| 1 | Tests que faltan (§4.4) | **Nulo** | solo añade cobertura |
| 2 | `require()` → import dinámico | Bajo | un solo punto, con test recién escrito detrás |
| 3 | Código muerto (`no-unused-vars`) | Bajo | quitar lo que nadie usa; la suite lo prueba |
| 4 | `no-explicit-any` (26) | Medio | tipar, sin tocar comportamiento; `tsc` + `build` de gate |
| 5 | `set-state-in-effect` (13) | **Alto** | cambia efectos de React en componentes sin test |
| 6 | Paginación (§3.3) | **Alto** | cambia la forma de dos respuestas y afecta a 5 consumidores |
| 7 | Zod acotado | Medio | rutas con test; los mensajes actuales no cambian |

## Decisión: qué NO se toca, y por qué (el corte de la noche)

RZ-2 lo dice para los componentes gigantes, pero el criterio es más general: **si no puedo
probar que no rompí nada, no entra**. En concreto:

- **`ThemeContext.tsx:13`** (`set-state-in-effect`): el efecto es justo lo que evita el
  desajuste de hidratación al leer `localStorage`. La corrección de fondo es
  `useSyncExternalStore` — cambio de patrón, no limpieza. Sin test de componente no se puede
  acreditar. **Declarado.**
- **`BaseTab.tsx:729`** (`set-state-in-effect`): calcula posiciones iniciales del grafo desde
  `docs`. Parece un `useMemo`, pero luego el usuario arrastra esos nodos: convertirlo rompe el
  arrastre. Es rediseño de estado. **Declarado.**
- **`exhaustive-deps` (6)**: añadir dependencias a un efecto **cambia cuándo se ejecuta**. En
  `BaseTab` (polling, cola de subida) eso puede producir bucles de peticiones. Son *warnings*,
  no errores. **Declarados**, con la recomendación de tratarlos junto al troceado.
- **`react-hooks/refs` y `react-hooks/purity`** (1+1, `BaseTab`): tocan el uso de refs y una
  lectura de `Date.now()` en render. Ambos dentro del componente de 1378 líneas que RZ-2
  protege. **Declarados.**
- **`scripts/`** (7 problemas): decisión de ZEUS si `scripts/` debe estar bajo la misma vara
  que `src/`. **Reportado**, no tocado.

## Technical Context

**Language/Version**: TypeScript 5.x sobre Node.js >= 22

**Primary Dependencies**: Next.js 16.2.10, React 19.2.4, Prisma 5.22.0, Vitest 4.1.9.
**Una dependencia nueva: `zod` 4.4.3** (la pedía §5.2; no estaba instalada).

**Storage**: PostgreSQL 16 (5435). **Sin migración.**

**Testing**: Vitest en `node`, sin BD ni Ollama. Línea base al empezar: **330 en 44 archivos**.

**Constraints**: `src/lib` y `src/app/api` siguen en 0 `no-explicit-any`; sin bajar la suite;
`tsc` y `build` limpios; sin tocar el esquema, el RAG ni otros productos.

## Constitution Check

*GATE inicial y re-check post-diseño: **PASS**.*

| Principio | Evaluación |
|---|---|
| §0.2 Pruebas | ✅ Cada pieza nueva (`paginacion`, `esquemas`, `mensajeError`) con test propio; §4.4 cerrado. |
| §0.3 Tipado / errores | ✅ `any` a 0 en `src/`; el error de Zod nunca llega al cliente. |
| §1.1 Verdad sobre el código | ✅ La medición de ZEUS se **verificó** antes de escribir; se corrigen dos matices. |
| §2.6 Límites | ✅ Se **implementan** los topes de query (500) y prompt (16000) que la constitución fijaba y ninguna ruta aplicaba. |
| §3.3 Paginación | ✅ Las dos rutas señaladas paginan con la forma prescrita. |
| §5.2 Validación | ✅ Zod instalado y aplicado acotado; el resto declarado. |
| §6.2 Reglas de React | ⚠️ De 13 a 2, **declarados con razón** (FR-001 lo contempla). |
| §8.1 `require()` | ✅ 0 en `src/`. |

**Sin violaciones nuevas.** Las que quedan estaban y quedan **declaradas**, no ocultas.

## Cambios exactos por bloque

1. **§4.4** — `src/lib/audit.test.ts` y `src/lib/documentProcessor.test.ts`.
2. **§8.1** — `extractPdfText` pasa a `await import("pdf2json")`. Efecto lateral bueno: carga
   perezosa, así que la suite puede importar el módulo sin arrastrar el parser.
3. **Código muerto** — `sanitizeJsonText` (señalado desde la línea base), `parseDate`,
   `ProcessingDoc`, estado e imports sin usar, `req` no usado en 3 `GET`.
4. **`any`** — `src/lib/mensajeError.ts` como estrechamiento único para los 18
   `catch (err: any)`; tipos nuevos (`ApiTestResult`, `ApiDocs`, `LogDocumento`) para el resto.
5. **`set-state-in-effect`** — las 11 cargas al montar pasan a ejecutarse dentro de una función
   asíncrona propia del efecto.
6. **Paginación** — `src/lib/paginacion.ts` (topes en un solo sitio) + las dos rutas +
   `itemsDeCuerpo` en `respuestaApi.ts` para que los consumidores acepten ambas formas.
7. **Zod** — `src/lib/esquemas.ts` con los dos esquemas y `validar`, que devuelve **mensaje
   legible**, nunca el `ZodError`.

## Riesgos

- **R-01 · La paginación deja pantallas en blanco.** Mitigación: `itemsDeCuerpo` acepta las dos
  formas; los 5 consumidores actualizados; tests de ruta sobre la forma nueva; `build` verde.
- **R-02 · Un consumidor filtraba en cliente y la paginación lo deja corto en silencio.**
  Ocurría en `fetchProcessingDocs`. Mitigación: pide los estados **al servidor**, que ya sabía
  filtrar por `status`. Es el riesgo que más fácil habría pasado inadvertido.
- **R-03 · Tocar efectos rompe una pantalla sin test.** Mitigación: solo se transforma el
  patrón de carga al montar, que es equivalente; lo demás se declara.
- **R-04 · Zod cambia contratos.** Mitigación: se conservan mensajes y códigos; los topes
  nuevos son cumplimiento explícito de §2.6, no un efecto colateral.
- **R-05 · Tipar el componente de 1378 líneas invita a trocearlo.** Mitigación: RZ-2; se tipa,
  no se parte.

## Complexity Tracking

Sin violaciones. La única dependencia nueva (`zod`) la pide la constitución en §5.2.
