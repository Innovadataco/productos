# Tasks: SPEC-130 — Cifrado en reposo del texto del reporte

**Estado**: PENDIENTE — compuerta §4.

Las tareas (`TNNN`) se generan con `/speckit.tasks` **tras la aprobación de ZEUS** del
spec.md y plan.md de esta carpeta (instructivo 002-PI-053). Este archivo existe como
marcador para la disciplina de specs; no contiene tareas aún.

Punto de decisión reservado a ZEUS: en DUPLICADO y en las resoluciones humanas, ¿anonimizar
con la util PII actual o purgar `texto` a marcador conservando `textoOriginal` cifrado
(recomendación ODIN: purgar `texto`; plan.md D4).

Orden previsto por el plan (se materializará en TNNN al aprobarse):

1. Helper `src/lib/texto-reporte-cifrado.ts` + tests (cifrar/descifrar/idempotencia) — TDD.
2. Escritura cifrada en creación y lectura descifrada en el pipeline (D2/D3) + tests de
   regresión del pipeline (clasificación intacta).
3. Política por estado terminal (duplicado al cierre; revisión/spam a la resolución) + tests.
4. Script `scripts/migrar-cifrado-texto-reportes.ts` (lotes, conteos, idempotente) + prueba en dev.
5. Gates: suite + tsc + lint + build + arch:check; validación con `quickstart.md`.
6. Cierre: sección Implementación en spec.md + índice specs/README.md.
