# SPEC-659 / I-403 · Plan

## Enfoque

Una variable (`--pi-accent`) con dos trabajos no se parchea: **se separa** (regla del
radicado). SPEC-661/#564 ya separó el **relleno** (Primario resuelve por tema a cielo) y
dejó el **fantasma** en `pino` INTERINO, confesado, con candado de render. Esta ficha
aterriza la otra mitad — la **marca** — y limpia los rellenos de padre que esquivan la
tubería del acento.

1. **Marca → tinta neutra.** `.btn-ds--fantasma` (texto + borde) pasa de `var(--pi-accent)`
   (pino) a `rgb(var(--tinta-rgb))`. `--tinta-rgb` es role-invariante (mismo en los 4
   temas) y mode-aware (voltea claro/oscuro), ~15.89/18.29 — exactamente lo que el candado
   pide. Es la misma tinta neutra del foco (`.ring-accent`).
2. **Relleno → cielo + tinta oscura.** Los `bg-pino` a mano del padre pasan al patrón ya
   firmado `bg-cielo text-acento-ink`. En esta rama: los dos de `ExpedientesListClient`.
3. **Re-anclar el candado.** El de render afirmaba «neutro = mismo color en 4 temas + ≥4.5»;
   el pino interino lo cumplía. Se añade el ancla CONCRETA: el texto del Fantasma **es
   `--tinta-rgb`**. Así el pino (u otro) cae. Conducta renderizada en Chromium, no regex.

## Por qué no «de paso» el cielo en la marca
Cielo como texto/borde = 2.37:1 sobre papel. La trampa es creer que el outline «empareja»
el acento poniéndolo en cielo. Relleno → cielo; marca → neutra. El candado lo hace
estructural.

## Orden de trabajo
1. ✅ `.btn-ds--fantasma` → tinta neutra + docblock actualizado.
2. ✅ `ExpedientesListClient:91,191` → `bg-cielo text-acento-ink`.
3. ✅ Re-anclar `acento-primario.render.ts` al valor concreto; verificado por mutación
   (pino interino → rojo).
4. ✅ Preflight (render:check · tsc · lint · arch · tokens · unidad) + specs-discipline.
5. ⏳ PR. Merge por el CEO tras firmas (Diseño re-firma contra el head del PR).

## Nombrado, no tocado (para el CEO)
- `AQuienProtejoView.tsx:41` («Agregar un menor») — mismo defecto de relleno, fuera de la
  lista de la FORMA-I403.
- `text-accent` en el padre → I-406 (ficha propia, candado propio). No se tocó.

## Fuera de este plan
- El acento como TEXTO (I-406) y su candado de render.
- El pino semántico (badges/estado).
