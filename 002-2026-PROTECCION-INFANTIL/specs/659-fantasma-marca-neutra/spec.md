# SPEC-659 / I-403 · El acento del padre por superficie — relleno CIELO, marca TINTA NEUTRA

**Status**: DESARROLLO
**Rama:** `work/pi-SPEC-659-fantasma-marca-neutra` · **Autor de la spec:** Dev 1 · **Radicado:** `RADICADO-SPEC-659-2026-09-11.md`
**Forma (autoridad Diseño):** `FORMA-I403-ACENTO-PADRE-RELLENO-CIELO-MARCA-NEUTRA` · **Deriva de:** I-392 / SPEC-661 · **Relacionado:** I-406 (acento como TEXTO, ficha aparte).

**Impacto en arquitectura:** cero esquema, cero API, cero migración — es CSS de tokens + dos enlaces del padre + el candado de render. `--pi-accent` cumplía dos roles (Primario = relleno; Fantasma = texto/borde); SPEC-661/#564 resolvió el relleno por tema y dejó el Fantasma en `pino` INTERINO. Esto **aterriza** el Fantasma en TINTA NEUTRA (`--tinta-rgb`, role-invariante) — separa la variable, no la parchea. El candado de render (`acento-primario.render.ts`, check requerido) se **re-ancla** al valor concreto, así el pino interino deja de pasar. El relleno del padre que iba en `bg-pino` a mano pasa a `bg-cielo` + rótulo de tinta oscura (mismo patrón firmado en `MisCitasList`/`IdentificadorBusquedaClient`).

## La regla (Diseño, FORMA-I403)
El acento del rol (cielo, D-132) es seguro como **RELLENO** (la tinta del rótulo carga el contraste) y **falla como MARCA** (texto/borde): `cielo` = 2.37:1 sobre papel. Por eso:
- **Relleno (fill)** → **cielo** + rótulo de tinta oscura (6.84 claro / 8.51 oscuro).
- **Marca (borde/texto: outline/«fantasma»)** → **tinta neutra** (`--tinta-rgb`), **nunca** el acento del rol, **nunca** el pino interino.

## Lo que se hizo (verificado contra main `a194b8897`)
- **Marca:** `.btn-ds--fantasma` (`globals.css`) texto y borde → `rgb(var(--tinta-rgb))` (antes `var(--pi-accent)` = pino interino). Hover → velo de tinta. Docblock actualizado: la decisión ATERRIZÓ.
- **Relleno:** `ExpedientesListClient.tsx:91` («+ Reportar una situación») y `:191` («Abrir expediente») → `bg-cielo text-acento-ink` (antes `bg-pino text-papel`). *(Los otros CTA de la ampliación —`MisCitasList`, `IdentificadorBusquedaClient`— ya estaban en `bg-cielo text-acento-ink` en main: los arregló trabajo en paralelo; no se tocan.)*
- **Candado (conducta renderizada, no regex):** `acento-primario.render.ts` ahora mide `--tinta-rgb` y exige que el TEXTO del Fantasma sea **ese valor concreto** en los 4 temas × 2 modos. El pino interino pasaba (3)+(4) (theme-invariante, 5.42) pero ahora cae. Verificado por mutación.

## La trampa (explícita)
La respuesta intuitiva a «arregla el pino» es «ponelo en cielo». Para el **relleno** es correcto; para la **marca es el error** (cielo como texto/borde = 2.37:1). Relleno → cielo; marca → neutra.

## Fuera de alcance (nombrado, no tocado)
- **`AQuienProtejoView.tsx:41`** («Agregar un menor», estado vacío de «A quién protejo») usa `bg-pino ... text-white` a mano — **misma clase de defecto de relleno**, pero NO está en la lista de la FORMA-I403. Se nombra para que el CEO decida (ficha propia o se folddea).
- **I-406** (`.theme-padre .text-accent` = cielo crudo como TEXTO, 2.37:1): no se toca; va a su ficha con su candado. Este barrido no introdujo ni tocó `text-accent`.
- **Pino SEMÁNTICO** (badges «Activo»/«Sin novedades»/riesgo bajo, dots de estado): se queda — es estado, no acento.

## Restricciones que NO se tocan
- La firma del Primario (gradiente/órbita) no se reparte.
- El rubí sigue reservado (fantasma-rubí solo danger).
- `--pi-accent-ink-rgb` NUNCA a secas (default blanco, I-404): el relleno usa `text-acento-ink` en contexto padre (tema fija la tinta oscura).
