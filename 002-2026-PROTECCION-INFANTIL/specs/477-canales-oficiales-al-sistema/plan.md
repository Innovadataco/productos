# SPEC-477 · Plan

## Método
Migración de color de un componente de portada a token, con ruling de forma de Diseño (neutro uniforme). Candado de fuente que muere por mutación.

## Orden
1. Rama desde `origin/main` fresco.
2. Leer la fuente: cómo se aplica cada `tone` (círculo del ícono) y el bg de la tarjeta.
3. Quitar los 3 `tone`; tarjeta y círculo a token neutro uniforme; sub a `text-muted`.
4. Candado (0 crudo + uniformidad) + contraprueba por mutación.
5. Preflight D-106 + suite unit.

## Fuera de alcance
- El «marcador pino único» opcional que mencionó Diseño (aparte si lo pide).
- Cualquier otro componente de la portada (hero ya limpio; nav en SPEC-462/478).
