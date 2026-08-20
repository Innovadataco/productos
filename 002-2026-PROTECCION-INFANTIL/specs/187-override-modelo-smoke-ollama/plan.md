# Plan de implementación: SPEC-187 — Override de modelo para smoke Ollama (002-PI-082)

## Resumen

Parche pequeño (~30 LOC + tests) sobre `src/lib/monitoreo/probes.ts` para permitir que el smoke real de Ollama use un modelo distinto al vigente del motor, vía parámetro `monitoreo.ollama.smoke.modelo`.

## Cambios de código

### 1. `src/lib/monitoreo/probes.ts`

En `probeOllamaSmoke`, justo antes de leer `ia.rubrica.modelos`:

```ts
const paramOverride = await getParametroSistema("monitoreo.ollama.smoke.modelo");
const overrideModelo = paramOverride?.valor?.trim() || null;

let modelo: string | null = overrideModelo;
let fuenteModelo: "override" | "motor" = overrideModelo ? "override" : "motor";

if (!modelo) {
    // fallback actual a ia.rubrica.modelos[0]
}
```

Los mensajes de detalle se actualizan a:
- Éxito: `smoke real ejecutado, latencia ${latenciaMs} ms (modelo ${modelo}, ${fuenteModelo})`
- Error HTTP: `HTTP ${res.status} (modelo ${modelo}, ${fuenteModelo})`
- Respuesta vacía: `respuesta vacía del modelo ${modelo} (${fuenteModelo})`
- Excepción: `${mensajeError(error)} (modelo ${modelo}, ${fuenteModelo})`

### 2. `prisma/seed.ts`

Añadir `monitoreo.ollama.smoke.modelo` al bloque `monitoreoViejos` (no a `monitoreoNuevos`) para que se siembre con `update: {}` y respete cualquier override ya configurado por el CEO.

```ts
{
    clave: "monitoreo.ollama.smoke.modelo",
    valor: "",
    tipo: TipoParametro.STRING,
    categoria: CategoriaParametro.SYSTEM,
    esPublico: false,
    descripcion: "Modelo de Ollama a usar en el smoke real (override). Si está vacío, usa ia.rubrica.modelos[0].",
},
```

Además, auditar que `monitoreoViejos` (y cualquier otro bloque de parámetros que deba respetar custom) use `update: {}`. Según ZEUS (Bloque G), el bug I-69 era que `update` incluía `valor`; se corrige aquí.

### 3. Tests

Actualizar `src/lib/monitoreo/probes.test.ts`:

- Test con override: crear parámetro `monitoreo.ollama.smoke.modelo=llama-guard3:8b`, verificar que el body de `/api/generate` usa ese modelo y que el detalle incluye `(modelo llama-guard3:8b, override)`.
- Test sin override: asegurar que se sigue usando `ia.rubrica.modelos[0]` y el detalle incluye `(modelo <modelo>, motor)`.
- Test override vacío (solo espacios): tratar como inexistente y hacer fallback.

Crear `prisma/seed-idempotencia.test.ts`:

- Ejecutar seed (o una función exportada del seed) sobre BD limpia.
- Modificar `monitoreo.enabled` a `false`.
- Re-ejecutar seed.
- Verificar que `monitoreo.enabled` sigue en `false`.

## Tareas

Ver [tasks.md](./tasks.md).

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Pisar override del CEO en seed | Usar `ON CONFLICT DO UPDATE` con cuidado; documentar en compuerta si se fuerza default vacío. |
| Cambiar formato del detalle y romper parseos | No se parsea el detalle; el campo `metodo` ya discrimina en el historial. El formato es solo informativo. |
| Test de integración lento | Usar timeout corto en el mock del servidor Ollama. |

## Criterios de aceptación técnica

- Gate local completo verde.
- `arch:check` verde (no cambian rutas ni permisos).
- No tocar `src/lib/ai/**`.
