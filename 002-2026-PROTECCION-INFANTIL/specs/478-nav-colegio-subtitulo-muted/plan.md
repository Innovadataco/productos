# SPEC-478 · Plan

## Método
Cambio de 1 línea, defendido por candado de fuente que muere por mutación. Sin conducta.

## Orden
1. Rama desde `origin/main` fresco.
2. Verificar en fuente el subtítulo y su clase (`text-subtle`).
3. Cambiar a `text-muted`; candado de fuente + contraprueba por mutación.
4. Preflight D-106 + suite unit.

## Fuera de alcance
- Cualquier otro elemento del nav (los estados inactivos ya pasaron a `text-muted` en SPEC-462).
- `CanalesOficiales` (SPEC-477, en stand-by por ruling de token de Diseño).
