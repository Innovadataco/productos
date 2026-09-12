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
- **Relleno:** `ExpedientesListClient.tsx:91` («+ Reportar una situación»), `:191` («Abrir expediente») y `AQuienProtejoView.tsx:41` («Agregar un menor», estado vacío de «A quién protejo») → `bg-cielo text-acento-ink` (antes `bg-pino` a mano). *(Los otros CTA de la ampliación —`MisCitasList`, `IdentificadorBusquedaClient`— ya estaban en cielo en main: trabajo en paralelo; no se tocan.)*
- **Candado de la MARCA (conducta renderizada, no regex):** `acento-primario.render.ts` ahora mide `--tinta-rgb` y exige que el TEXTO del Fantasma sea **ese valor concreto** en los 4 temas × 2 modos. El pino interino pasaba (3)+(4) (theme-invariante, 5.42) pero ahora cae. Verificado por mutación.
- **Seleccionado del toggle (`PanelAgregar.tsx:135,152`):** Diseño decidió que el seleccionado del padre sigue el acento **como TINTE, no relleno sólido**: `border-pino bg-pino text-white` → `border-cielo bg-cielo/10 text-estado-cielo`, hover → `border-cielo/40`. Jerarquía legible sin leer el color: acción primaria = relleno sólido + tinta oscura; opción elegida = tinte + tinta legible. (NO cielo sólido + blanco = 2.70/2.17 de I-404; NO `text-cielo` crudo = 2.37.)
- **Candado del RELLENO/ACENTO (conducta, no lista):** `acento-relleno-sin-pino-crudo.candado.test.ts` — **ningún elemento interactivo del padre usa `bg-pino`/`border-pino` SÓLIDO de acento**, ni ESTÁTICO (`className="…bg-pino…"`) ni CONDICIONAL (`className={activo ? "border-pino bg-pino…" : …}`: el seleccionado de un toggle). Sin base ni lista. Verificado por mutación (static y conditional). Distinción ESTRUCTURAL: deja fuera el pino SEMÁNTICO (opacidad `/10`, variable sobre `<span>`), las pseudo-clases `focus:`/`hover:` (foco, SPEC-662), y `text-pino` (I-406).

## La trampa (explícita)
La respuesta intuitiva a «arregla el pino» es «ponelo en cielo». Para el **relleno** es correcto; para la **marca es el error** (cielo como texto/borde = 2.37:1). Relleno → cielo; marca → neutra.

## Fuera de alcance (nombrado, no tocado)
- **`PanelAgregar.tsx` focos de `<input>` (`:115,166,185,200`)** usan `focus:border-pino focus:ring-pino/25` — pino como color de FOCO de input. Es el carril del foco (SPEC-662), no el relleno/seleccionado que arregla esta ficha; el candado lo excluye por el prefijo `focus:`. Nombrado para Diseño.
- **`PanelAgregar.tsx:217`** un botón de texto con `text-pino` (acento como TEXTO) — adyacente a I-406. No tocado.
- **I-406** (`.theme-padre .text-accent` = cielo crudo como TEXTO, 2.37:1): no se toca; va a su ficha con su candado. Este barrido no introdujo ni tocó `text-accent`.
- **Pino SEMÁNTICO** (badges «Activo»/«Sin novedades»/riesgo bajo, dots de estado): se queda — es estado, no acento.

## Restricciones que NO se tocan
- La firma del Primario (gradiente/órbita) no se reparte.
- El rubí sigue reservado (fantasma-rubí solo danger).
- `--pi-accent-ink-rgb` NUNCA a secas (default blanco, I-404): el relleno usa `text-acento-ink` en contexto padre (tema fija la tinta oscura).
