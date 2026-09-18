# SPEC-719 · Tasks

## Candado antes del fix
- [x] T1 · Ampliar `voz-usted-profesional-dashboard.candado.test.ts` con la clase pretérito 2ª (`-aste`/`-iste`) + ancla de excepciones. Correr contra el código actual → ROJO (líneas 137/184).

## Fix (Dev 1)
- [x] T2 · `DocumentosRequisitos.tsx`: líneas 22 (comentario), 137, 184 → usted (`enviaste→envió`, `subiste→subió`).
- [x] T3 · `documentos.service.ts:64`: comentario espejo de la insignia → `envió`.

## Verificación
- [x] T4 · Candado VERDE tras el fix.
- [x] T5 · Control positivo: texto viejo → rojo; pretérito novel `mandaste` → rojo; `existe`/camelCase no disparan. Revertido.
- [x] T6 · Barrido de tests del área profesional (limpio salvo la auto-documentación del propio candado).

## Cierre
- [ ] T7 · Preflight (tsc · lint · specs-discipline) · PR verde · reportar al CEO con la lista de otras áreas para radicado separado.

## Fuera
- Pretérito-tuteo en otras áreas (padre/colegio/pagos/expediente/landing/api) y la misma ceguera en los demás candados de voz → radicado separado (voz por área de Diseño). Se listan en el cuerpo del PR.
