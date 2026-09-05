# SPEC-460 · Plan

## Enfoque

Un triplet `--accent-rgb` por tema alimenta el color `--accent` (Button) y la familia Tailwind `accent` (alpha). Aditivo sobre el sistema de temas por clase que ya existía (colegio, padre); se crean los dos que faltaban (admin, profesional).

## Orden

1. `:root`: default pino + `--accent` derivado.
2. `--accent-rgb` a colegio/padre; crear theme-admin (ámbar-ink) y theme-profesional (cielo).
3. Familia Tailwind `accent` → `--accent-rgb`.
4. Aplicar los temas en los layouts admin y profesional.
5. Candado de conducta (estructura CSS + familia + layouts), verificado por mutación.

## Riesgo controlado

Los 3 usos de `accent-{escala}` no se migran: siguen resolviendo, ahora por rol. Pantallas sin tema caen al default pino (sin cambio visual).

## Fuera de alcance

- Migrar los 3 usos de `accent-escala` a clases custom (no hace falta).
- La firma de forma del profesional en la cabecera (Sistema §8.4) — otra spec.
