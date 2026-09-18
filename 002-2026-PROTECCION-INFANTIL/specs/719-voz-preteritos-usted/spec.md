# SPEC-719 · El candado de voz no cazaba los pretéritos («subiste», «enviaste»)

**Status**: DESARROLLO

**Origen:** Dev 1, midiendo para SPEC-707 (17-09), fuera del alcance de ese PR. Verificado por el CEO contra `origin/main` (529808e3). **Carril:** Dev 1 · Calidad.

## Lo que encontró

En `src/components/modules/profesional/DocumentosRequisitos.tsx` — área que **SPEC-550 exige en usted** — hay tuteo vivo desde SPEC-693:
- línea 137 — «En revisión — **enviaste** un documento nuevo»
- línea 184 — «Ver el que **subiste**»
- línea 22 — el mismo tuteo en un comentario («**subiste** una versión nueva…»)

Lo central no son las tres líneas: **el candado de voz pasó en verde con ese texto adentro.** Su detector cazaba presentes/imperativos/posesivos (VOSEO/TUTEO) pero **no los pretéritos de 2ª persona** (`-aste`/`-iste`), y por ahí entró la clase entera con SPEC-693.

## El arreglo

1. **Corregir los tres textos a usted** (el comentario también: la voz se copia de lo que se lee al lado). `enviaste→envió`, `subiste→subió`. Se corrige además el comentario espejo en `documentos.service.ts:64` (cita la copia de la insignia).
2. **Ampliar el candado a los pretéritos —por MORFOLOGÍA, no por lista.** `voz-usted-profesional-dashboard.candado.test.ts` gana la clase `-aste`/`-iste` de 2ª persona (la 3ª de usted nunca termina así: `subió`/`envió`), con un **ancla de excepciones** para los homógrafos válidos en usted/3ª y sustantivos que terminan igual (`existe`, `insiste`, `consiste`, `contraste`, `triste`…) y el descarte de identificadores camelCase/MAYÚSCULA (`yaExiste`, `onPaste`).
3. **Control positivo (obligatorio):** con el candado ampliado y el texto viejo, se pone rojo; y un pretérito NOVEL que no está en ninguna lista (`mandaste`) también lo pone rojo → caza la CLASE, no dos palabras.

## Fuente única

El candado deriva la clase de la terminación, no de una lista de verbos. Un pretérito nuevo (`reprogramaste`, `guardaste`, …) queda cazado sin editar el candado.

## Candados

- `voz-usted-profesional-dashboard.candado.test.ts` (ampliado): la clase completa (voseo + tuteo + **pretéritos**) en el árbol logueado del profesional. Mutación-verificado: texto viejo → rojo; pretérito novel `mandaste` → rojo; `existe`×4 y los camelCase NO disparan (ancla).

## Impacto

**Impacto en arquitectura:** el detector del candado pasa de una lista de lexemas a incluir una REGLA morfológica (terminación `-aste`/`-iste` de 2ª persona) con un ancla de homógrafos acotada — cierra la clase que dejaba pasar el tuteo en pretérito. Sin cambio de conducta, esquema ni ruta. **Deuda declarada (no en este PR):** los demás candados de voz (`colegio`, `admin`, `padre`, `registro`…) comparten la misma ceguera al pretérito, y el barrido halló ~33 ocurrencias en otras áreas —muchas en zonas cuya voz decide Diseño (p. ej. el área del padre)—; se radica aparte para que cada área reciba su fallo de voz y su candado ampliado.

## Fuera

- Las ocurrencias de pretérito-tuteo en otras áreas (padre, colegio, pagos, expediente, landing, api…): se listan en el cuerpo del PR y se surten al CEO para un radicado separado con la voz por área de Diseño. · No se toca conducta ni forma.
