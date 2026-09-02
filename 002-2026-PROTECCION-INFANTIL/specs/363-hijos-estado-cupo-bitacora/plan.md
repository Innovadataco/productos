# SPEC-363 · Plan

1. Rojo CI #241 (bloquea el merge): el fixture usaba documento "3003" (4 dígitos) que la validación
   F7 rechaza → arreglar el fixture en la rama #241 (payload real).
2. `tope-hijos.ts`: fuente única del tope y su mensaje.
3. `cambiarEstadoHijo`: cupo inyectado al reactivar (BUG1) — audita {estado} (BUG2, ya lo hacía).
4. `[id]/route.ts`: separa estado (→ cambiarEstadoHijo) de correcciones (→ actualizarHijo).
5. POST route usa el helper compartido (una sola verdad del texto).
6. Tests por el route real: BUG1 (reactivar sobre el tope → 409), BUG2 (audit {estado}), mixto.
