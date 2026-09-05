# SPEC-483b · Barrido residual del panel de IA + monitoreo (fase 2 admin, mecánico)

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-05 · **Dev**: PI-1 (`idc-32`) · **Origen**: Lote-2 fase 2 (residual fuera del app-dir de admin, hallado en SPEC-483) + ruling de scope de Diseño (**mixto**: chrome mecánico + data-viz aparte). Radicado por el CEO. Disjunto de #400 (colegio) y de #399 (ya mergeado).

## El problema

El conteo admin de SPEC-483 (app-dir) dejó fuera ~91 crudos en `src/components/modules/ia/**` (89) y `monitoreo/LogsTab` (2). Diseño clasificó el scope: casi todo es **chrome/estado** (mecánico), salvo **un** medidor que es **data-viz**.

## El arreglo (mecánico)

Migrados a tokens: `IaPlayground`, `IaModelSelector`, `RubricaTab`, `IaTraceTimeline`, el **chrome** de `IaDocsPanel` (tabs, skeleton), `simulacion/*` (form, tarjetas de métrica, tablas, dashboard, comparador) y `monitoreo/LogsTab`. Mapeo:

- `sky`/`cyan` → **cielo** (`text-cielo`, `bg-cielo`, `border-cielo`, focus-ring `ring-cielo/20`).
- `emerald` y `green` de **éxito** → **pino** / **`text-estado-pino`** (mensajes success, delta positivo).
- `slate`/`gray` → **neutros** (`border-tinta/10`, `bg-tinta/5`, `bg-papel`, `.text-muted` por jerarquía).
- `red` de **error/regresión** → **rubi** / **`text-estado-rubi`** (mensajes de error, borde/fondo de caja de error, delta negativo — criticidad legítima).
- `amber` de **advertencia** → **`text-estado-ambar`** (texto AA).

Los pares light/dark colapsan a un token theme-aware (drop `dark:`). Los colores de **delta** (`format.ts`, `MetricCard`) codifican un **tri-estado discreto** (mejora/empeora/igual), no un gauge continuo → mapean a los tokens de estado (pino/rubi/muted), preservando la lectura.

## EXCLUIDO — data-viz (lo hace Diseño)

**El medidor de confianza de `IaDocsPanel`** (arco SVG cuyo color depende de `confianza >= umbral`): el color **CODIFICA el valor/umbral**. Queda crudo, envuelto en una región `{/* data-viz:inicio … */}` … `{/* data-viz:fin */}` para la pasada dedicada de Diseño (escala: bajo umbral→ámbar · en/sobre→pino · nunca rojo). **No tokenizado a ciegas** (regla de oro).

## Regla de oro (Diseño, reusable — en el candado)

Si un color **codifica un valor** (gauge/escala/métrica coloreada por su valor/heatmap) → **marcar, no swap; ante la duda, marcar**. Si es chrome/estado (borde, fondo, texto, error/ok) → mapeo mecánico.

## Candado — `src/components/modules/ia/ia-residual-barrido.candado.test.ts` (2 tests)

- 0 crudo (`slate/gray/sky/cyan/emerald/red/green/amber`) **fuera** de las regiones `data-viz` en `ia/**` + `monitoreo/LogsTab`.
- El gauge de `IaDocsPanel` sigue **marcado** como data-viz (no tokenizado a ciegas).
- **Verificado por mutación**: reintroducir `bg-slate-500` fuera del gauge → rojo; revertir → verde.

## Impacto en arquitectura:

- Cierra el crudo mecánico del panel de IA + monitoreo. Conducta intacta (solo color); sin cambios de rutas/guardias/menús → `arch:check` inalterado.
- Deja el único data-viz (medidor de confianza) explícitamente marcado para Diseño, con un candado que lo mantiene exento y presente.

## Lo que NO cambia

- El medidor de confianza de `IaDocsPanel` (data-viz, Diseño).
- `tokens-check.ts` / PISO (el PISO lo aprieta el barrido `--tension`).

## Referencias

- **SPEC-483** (barrido admin app-dir) — misma técnica; esta es la fase 2 fuera del app-dir.
- **SPEC-460** (accent por territorio) · Sistema de Diseño v1.x (tokens estado).
- Rama `work/pi-SPEC-483b-ia-monitoreo-residual` desde `origin/main 2e1c80393`.
