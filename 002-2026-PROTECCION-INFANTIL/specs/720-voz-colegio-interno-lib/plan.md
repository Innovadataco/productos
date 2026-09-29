# SPEC-720 · Plan

## Impacto en arquitectura
- Candado colegio (`app/dashboard/colegio/voz-usted.candado.test.ts`): pretérito por morfología (-aste/-iste + ancla de SPEC-719) reemplaza los pretéritos a mano; DIRS += `lib/colegio`; `EXCLUIDOS` = `lib/colegio/vigencia.ts` (mixto padre/colegio, documentado).
- Candado interno (`components/modules/tuteo-interno.candado.test.ts`): + la misma clase de pretérito por morfología.
- Copia a usted: `lib/colegio/{seguimiento,notificaciones,onboarding,vigencia}.ts` (solo las cadenas de audiencia colegio; las del padre en vigencia.ts se conservan en tú). Fixture de `PendientesCaso.test.tsx` a usted.

## Orden
1. Fijar la copia de colegio. 2. Morfología + `lib/colegio` en el candado de colegio (con exclusión de vigencia). 3. Morfología en tuteo-interno. 4. Control positivo (viejo → rojo; novel → rojo). 5. Preflight + PR + reportar el árbol compartido como deuda.

## Verificación
- tsc · lint · arch:check · candado colegio (mutación: novel `gestionaste` → rojo) · candado interno · seguimiento.test · PendientesCaso.test.
