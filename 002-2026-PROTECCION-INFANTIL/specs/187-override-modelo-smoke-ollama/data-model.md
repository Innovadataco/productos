# Modelo de datos: SPEC-187 — Override de modelo para smoke Ollama

## Impacto en schema Prisma

Ninguno. No se añaden tablas ni columnas.

## Parámetros de sistema

| Clave | Tipo | Default | Editable | Sección | Descripción |
|-------|------|---------|----------|---------|-------------|
| `monitoreo.ollama.smoke.modelo` | STRING | `""` | Sí | Monitoreo | Modelo de Ollama a usar en el smoke real. Si está vacío, usa `ia.rubrica.modelos[0]`. |

## Entidades afectadas

- `ParametroSistema`: nuevo registro opcional.
- `HealthProbe`: el campo `detalle` de los probes `ollama_smoke` con `metodo="SMOKE"` incluirá el modelo y la fuente (`override` / `motor`).

## DTOs / tipos

No se añaden tipos nuevos. Se reutiliza `ResultadoProbe` existente.
