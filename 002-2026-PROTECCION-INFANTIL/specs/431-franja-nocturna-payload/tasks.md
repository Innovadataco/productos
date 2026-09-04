# Tareas · SPEC-431 — La franja horaria le mentía al modelo

- [x] T001 `franjaDe` en `armar-payload.ts`: restar `OFFSET_BOGOTA_MS` antes de leer la hora, como `lectura-capa1.ts`.
- [x] T002 Reescribir el fixture y los asserts de `armar-payload.test.ts`: hora de Bogotá, assert fuerte renombrado, hecho a hecho, bordes del día.
- [x] T003 Exportar `franjaBogota` de `hechos-caso.ts` y contrastar las dos implementaciones sobre las 24 horas.
- [x] T004 Probar muriendo: reintroducir `getUTCHours()` y ver caer 4 tests.
- [x] T005 Gate (`tsc`, `lint`, unit de lo tocado) + fila en `specs/README.md` + PR.

## Anotado

- `ejecutar-analisis.ts:176` NO se toca: su `timeStyle` es a propósito (SPEC-349).
- Los textos de análisis ya generados con la franja corrida no se regeneran (decisión de Jelkin).
