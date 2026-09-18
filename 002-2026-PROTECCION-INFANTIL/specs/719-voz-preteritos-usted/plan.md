# SPEC-719 · Plan

## Impacto en arquitectura

- **Candado (detector)** — `voz-usted-profesional-dashboard.candado.test.ts` gana una REGLA morfológica: pretérito de 2ª persona `-aste`/`-iste` (tú y vos coinciden), con `PRETERITO_EXCEPCIONES` (ancla de homógrafos válidos en usted/3ª: `existe`, `insiste`, `consiste`, `contraste`, `triste`…) y descarte de identificadores por mayúscula interna (`yaExiste`, `onPaste`). Se integra al mismo `it` que ya barre VOSEO/TUTEO, sobre el mismo árbol (comentarios fuera por `sinComentarios`).
- **Copia** — `DocumentosRequisitos.tsx` (líneas 22, 137, 184) y el comentario espejo de `documentos.service.ts:64` pasan a usted (`enviaste→envió`, `subiste→subió`). Cambio de voz, no de forma ni conducta.
- Sin esquema, sin migración, sin ruta.

## Orden

1. Ampliar el candado (morfología + ancla). Correr contra el código actual → ROJO (líneas 137/184).
2. Corregir los tres textos + el comentario espejo → VERDE.
3. Control positivo: pretérito novel `mandaste` → ROJO; revertir.
4. Barrido: tests del área profesional (limpios) + barrido de otras áreas (se listan y se surten al CEO).
5. Preflight + PR.

## Verificación

- Candado verde tras el fix; rojo con el texto viejo y con un pretérito novel (mutación en los dos sentidos).
- `existe`×4 y los identificadores camelCase NO disparan (ancla correcta).
- tsc · lint · specs-discipline · sin regresión en la suite de documentos.
