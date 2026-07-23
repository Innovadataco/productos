# Research — Hotfix de validación funcional (Fase 0)

**Spec**: [spec.md](./spec.md) · **Fecha**: 2026-07-23

Hallazgos verificados leyendo el código real y consultando la base en ejecución.

## D-01 — La bandera `Secure` se resuelve por variable de entorno

- **Decision**: nueva variable `AUTH_COOKIE_SECURE`, leída en el punto donde se emite la
  cookie. Default **`true`**; solo el valor explícito `"false"` la desactiva.
- **Rationale**: D-036 de ZEUS. Es una característica de **despliegue**, no un parámetro
  de negocio: si viviera en `ModuleSetting`, cualquiera con acceso a la interfaz podría
  desactivar un control de seguridad de la sesión. Por eso constituye la **excepción
  explícita** a la precedencia de §0.7 (BD/UI > entorno > default): aquí el entorno es la
  única fuente admitida.
- **Interpretación del valor** (edge case de la spec): se activa `Secure` salvo que el
  valor, normalizado a minúsculas y sin espacios, sea exactamente `"false"`. Cualquier
  otro contenido —vacío, `"sí"`, `"1"`, basura— deja la bandera **activada**. Ante
  ambigüedad, gana el comportamiento seguro.
- **Alternatives considered**: (a) derivar de la URL pública configurada (`https://…` →
  `Secure`) — rechazado: más magia, mismo resultado, y falla tras un proxy TLS;
  (b) HTTPS local con certificados de desarrollo — descartado en D-033;
  (c) dejarlo en `ModuleSetting` — descartado por D-036.

## D-02 — La UI deja de imponer el literal de `baseUrl`

- **Hecho**: `configuracion/page.tsx:102` inicializa el formulario con
  `baseUrl: "http://localhost:11434"` y `:289` hace `form.baseUrl || "http://localhost:11434"`.
  Ese valor viaja como parámetro explícito de la petición y, por diseño de FR-010 de la
  spec 001, **el valor explícito manda sobre todo lo demás**. La UI estaba ganándole la
  partida al backend.
- **Decision**: el estado inicial deja `baseUrl` vacío y *Descubrir* construye la URL
  **sin** el parámetro cuando el campo está vacío.
- **Rationale**: así la precedencia queda íntegramente en el backend, que es donde ya
  está implementada y probada (`resolveOllamaBaseUrl`). El usuario que escriba una URL
  sigue mandando: se envía el parámetro solo si hay valor.
- **Nota**: el literal de la línea `:380` es el `placeholder` del campo. **No se toca**:
  es ayuda visual, no un valor enviado.

## D-03 — Idempotencia del seed: una estrategia por tabla

El seed no puede lograr idempotencia borrando (FR-009). La forma correcta depende de si
la tabla tiene una clave natural única, y **no todas la tienen**:

| Tabla | ¿Clave única hoy? | Estrategia |
|---|---|---|
| `AgentApi` | **Sí** (`key @unique`) | `upsert` por `key` — estructuralmente idempotente |
| `EntidadLicitacion` | **No** | Añadir `@unique` a `key` (migración) → `upsert` |
| `LicitacionStatus` | **No** | Añadir `@unique` a `key` (migración) → `upsert` |
| `AiModel` | **No, y no debe tenerla** | `findFirst` por `modelPath` + `create` si falta |

- **Rationale de la migración**: la spec exige (edge case) que la unicidad la garantice la
  base y no el orden de ejecución. Para dos catálogos puros, una clave repetida no
  significa nada: el `@unique` es la modelización correcta. Las tablas están **vacías**
  (0 filas verificadas), así que el índice se crea sin riesgo de violación.
- **Rationale de NO añadir unicidad a `AiModel`**: es configuración de usuario, no
  catálogo. Dos entradas del mismo `modelPath` con temperaturas distintas es un uso
  legítimo; imponer `@@unique([provider, modelPath])` prohibiría algo válido para ganar
  comodidad en el seed. Se acepta que el seed de modelos sea idempotente por consulta
  previa en lugar de por restricción.
- **Alternatives considered**: `deleteMany` + `createMany` como hace hoy
  `scripts/seedApis.mjs` — rechazado explícitamente: es idempotente en el recuento pero
  **destruye la configuración del usuario** en cada ejecución (una API desactivada, un
  modelo marcado activo). Es justo lo que FR-009 prohíbe.

## D-04 — Contenido del seed: extraído del código, no inventado

- **`LicitacionStatus`**: las **cinco** claves que la interfaz ya reconoce y colorea, en
  `LicitacionesTab.tsx:49-55` y `LicitacionCard.tsx:35-41`: `en-proceso`, `abierta`,
  `cerrada`, `adjudicada`, `cancelada`. Sembrar otras dejaría estados sin color; sembrar
  menos dejaría código muerto.
- **`EntidadLicitacion`**: se derivan de `src/lib/entidadesColombia.ts` (52 entidades
  oficiales ya usadas por el módulo de documentos), con `key` generada por slug del
  nombre. Fuente única: si mañana crece esa lista, el seed crece con ella.
- **`AgentApi`**: se reutiliza el catálogo que ya existe en `scripts/seedApis.mjs`; lo que
  cambia es **cómo** se escribe (upsert en vez de borrar y recrear), no **qué**.
- **`AiModel`**: un único modelo de referencia (`nomic-embed-text`, proveedor `ollama`,
  `baseUrl` vacío para que aplique la precedencia del backend), **inactivo** por defecto.
  No se activa nada automáticamente: activar un modelo es decisión del operador.

## D-05 — `projects`: autorización y contrato de error

- **Hecho**: `projects/route.ts` es la **única** ruta que quedó fuera del contrato
  normalizado de la spec 002 — su `GET` y su `catch` siguen con `console.error` +
  `NextResponse.json` directo.
- **Decision**: al añadir `verifyAuth()` al `GET` se migra también su `catch` a
  `apiError`, cerrando la última excepción del contrato.
- **Rationale**: se está tocando el archivo de todos modos; dejarlo a medias obligaría a
  volver. El `POST` ya usa `apiError` desde la spec 002.

## D-06 — Pruebas sin BD ni Ollama

- **Decision**: `projects/route.ts` estrena archivo de pruebas con los mocks ya
  establecidos (`@/test/prismaMock`, `@/test/authMock`); la resolución de la bandera de
  cookie se prueba como función pura.
- **Rationale**: §0.2 exige test para toda ruta modificada, y `projects` no tenía ninguno
  (quedó fuera de los módulos críticos de la spec 002). La suite sigue corriendo sin
  infraestructura (FR-016).
- **Fuera**: no se montan pruebas de componentes `.tsx` para `configuracion/page.tsx`. No
  existe hoy ningún arnés `.tsx` y montarlo es un frente propio (declarado fuera de
  alcance en la spec).

## D-07 — Lo que NO se toca en esta spec

Durante la verificación se observaron rutas `GET` sin `verifyAuth` más allá de
`projects`. **Están fuera de alcance por decisión de ZEUS** (incidencias I-008 e I-009,
spec 005): cerrarlas ahora, antes de que la sesión funcione, dejaría la interfaz entera
respondiendo 401. Se dejan exactamente como están.
