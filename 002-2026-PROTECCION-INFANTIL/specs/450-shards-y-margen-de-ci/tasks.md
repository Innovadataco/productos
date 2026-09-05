# Tareas · SPEC-450 — El margen de CI

- [x] T001 Diagnosticar I-282 midiendo job por job. Resultado: **no es un cuelgue**; las tres hipótesis de código quedaron descartadas con evidencia.
- [x] T002 Matriz de 4 → 6 shards, y el **fallback de vitest** también a `/6`.
- [x] T003 El reparto **avisa** por los archivos sin medición y por los pesos provisionales (<3 corridas).
- [x] T004 El actualizador guarda una ventana de 5 muestras y usa **mediana**, no media móvil.
- [x] T005 Señal `::warning` a los 30 min, que **avisa y no corta**.
- [x] T006 Candados, probados muriendo: volver a 4 shards → rojo; subir el techo → rojo.
- [x] T007 Gate: `npm run lint`, `tsc`, `arch:check`, `tokens:check`, unit.

## Anotado

- **`timeout 45m` y el reintento de SPEC-407 quedaron INTACTOS**, por orden del CEO.
- El aviso nuevo **ya destapó 12 archivos sin medición** al escribirlo — varios de las specs de hoy.
- **Regla operativa de I-282:** no se cancela un job antes de los 45 min. Cancelar el de #349 a los 40 alargó la espera un CI completo.
