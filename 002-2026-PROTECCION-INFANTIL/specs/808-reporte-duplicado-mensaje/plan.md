# Plan · SPEC-808 · Reporte duplicado: string + comentario

## Pasos
1. `route.ts:289`: string del 429 → «Ya tienes un reporte sobre esta cuenta» (forma FORMA-SPEC808; sin acusación).
2. `route.ts:281`: comentario → conducta real (dedup autenticado-only, con el porqué) + quitar la ref vencida a «candado 26».
3. Candado `reporte-duplicado-mensaje.candado.test.ts` + registro en `vitest.unit.includes.ts`.

## No se toca
La conducta (dedup, ventana 30d, normalización del identificador) · la tarjeta `ReporteWizard` (carril de Dev-1).

## Verificación
Candado 5/5 · route tests 39/39 (conducta intacta) · tsc · eslint · test:unit completo.

## Señalado al CEO
El 429 lo recibe un autenticado no-PARENT; la forma es padre-facing — apliqué su encuadre; Diseño decide si el respaldo interno quiere otra voz. Y la tarjeta (:312 de ReporteWizard) aún tiene el string viejo: es de Dev-1 (forma «Para Dev-1»).
