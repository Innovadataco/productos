# SPEC-484 · Los PDFs del colegio al hex de marca (pino, no emerald)

**Status**: IMPLEMENTADO (pendiente certificación de Diseño)
**Fecha**: 2026-09-05 · **Dev**: Dev 02 (`idc-63`) · **Origen**: última pieza de color del rediseño; los PDFs generados usan hex crudo. Autoridad de forma: **Diseño** (certifica contra el PDF generado; post-merge).

## Para qué

`react-pdf` no lee CSS vars, así que los PDFs de colegio definen constantes hex locales. Estaban en **emerald** (`#10b981`) — la marca del colegio es **pino**. Diseño fijó el mapeo al **valor claro** de cada token. Cubre los DOS PDFs: `pdf-informe-mensual.tsx` (informe del rector) y `pdf-estadisticas.ts`.

## Mapeo (hex = valor claro del token, `mantener en sync`)

| Constante | Antes | Ahora | Token |
|---|---|---|---|
| `COLOR_PRIMARIO` | `#10b981` | `#0b6e5a` | pino |
| `COLOR_TEXTO` | `#1f2937` | `#0f1815` | tinta |
| `COLOR_MUTED` | `#6b7280` | `#4d5552` | tinta-muted |
| `COLOR_FONDO` | `#f0fdf4` | `#e9f2ee` | tinte pino muy claro (Diseño: no papel neutro) |
| `COLOR_BORDE` | `#e5e7eb` | `#dfe3e1` | línea neutra (solo informe; estadísticas no tiene la constante) |

Además: los `#1f2937`/`#6b7280` inline del informe (33/38) pasan a usar las constantes; los `#e5e7eb` inline de las líneas de tabla de estadísticas → `#dfe3e1` (mismo mapeo gris→línea). Blanco sobre primario (`#ffffff`) se queda. Cada constante lleva `// = valor claro del token <nombre>, mantener en sync`.

## Candado

`src/lib/rediseno/pdf-colegio-hex-marca.candado.test.ts` (fuente, sin BD, **hex — no tokens:check**): afirma cada constante en su hex de marca en AMBOS archivos y **0 emerald crudo** (`#10b981`/`#f0fdf4`). **Verificado por mutación**: volver una constante al emerald → rojo.

## Impacto en arquitectura: no

Solo constantes de color en dos generadores de PDF. No toca `tokens:check` (es hex, no clases Tailwind), ni schema/API/runtime. **Independiente**: no toca los archivos generados union → sin conflicto con otros PRs en vuelo.

## Anotado (residual fuera de alcance)

- `pdf-estadisticas.ts:220`: un `#f9fafb` (gris-50) de zebra de tabla — neutro casi-blanco, no era parte del defecto de marca emerald ni de las constantes que fijó Diseño. Flagueado al CEO por si Diseño lo quiere en un token neutro claro; queda como está por ahora.

## Certificación

Diseño certifica **contra el PDF generado** (no basta el código). Post-merge.
