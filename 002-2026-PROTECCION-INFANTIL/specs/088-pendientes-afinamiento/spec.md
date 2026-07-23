# Spec 088 — Pendientes de afinamiento (registro vivo)

**Status**: `PLANEADO`
**Rama**: `feature/001-scaffolding`
**Creado**: 2026-07-18 (como 050b; renombrada a 088 por colisión de numeración, spec 087-US2)

## Contexto

Esta spec nace como un **documento de gestión/seguimiento** (antes `050-pendientes-afinamiento/registro.md`): un registro vivo de ajustes de modelo, datos y configuración que NO se tocan durante la fase de desarrollo y se resuelven todos juntos en la fase de AFINAMIENTO, post-despliegue, con aprobación del owner.

El contenido operativo vive en [`registro.md`](./registro.md) (ítems A1-A5: curaduría del fixture, umbral de revisión, peso de fuente, modelo de desempate, error silencioso).

## Alcance

- Mantener el registro de pendientes de afinamiento con disparador y fuente por ítem.
- Ningún ítem se ejecuta en desarrollo; cada uno se convierte en su propia spec al entrar a afinamiento.

## Criterio de salida

Cuando un ítem del registro se activa, se crea su spec dedicada (Spec-Kit completo) y se marca como DESPACHADO en `registro.md`. La spec 088 se cierra cuando el registro queda vacío.

## Historial de numeración

- Creada como "050-pendientes-afinamiento" (050b) el 2026-07-18.
- Renombrada a 088 el 2026-07-23 por colisión con `050-mejora-prompt-clasificador` (spec 087).
