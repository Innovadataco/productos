# Tareas · SPEC-439 — El aviso al padre cuando alguien más reporta lo mismo

- [x] T001 Leer en fuente antes de codificar. Resultado: **las dos partes del radicado ya estaban construidas** (SPEC-366, 324, 139). Reportado al CEO, que corrigió el radicado y fijó el alcance real.
- [x] T002 ~~Cablear `notificarCambioCirculoSiCorresponde`~~ **REVERTIDO — el hallazgo era falso.** Ya está llamada desde `scripts/worker-reportes.mjs:226`; el cableado extra habría **duplicado** el aviso. `finalizacion.ts` queda idéntico a `main`. En su lugar, candado sobre el llamador que YA existe.
- [x] T003 `corroboracion-padre.ts`: el aviso al padre que YA había reportado (tercera población, sin cubrir por nadie). Disparo dentro de `detectarYRegistrarMatch`, después de `eventos.crear`.
- [x] T004 Plantilla + regla sembradas idempotentes (`reporte.corroborado_por_otro`). Sin migración: el opt-out lo da `NotificacionPreferencia`.
- [x] T005 `esAnonimo` en `otrosReportesDe` / `OtroReporteDto` / la pantalla de seguimiento — el tipo de autor, nunca la identidad.
- [x] T006 13 candados: cableado (3), reserva (2), conducta del aviso (5), protección de lo preexistente (3).
- [x] T007 Probarlos muriendo en mutaciones distintas: borrar la llamada del worker (1 rojo), quitar los cables y `esAnonimo` (4), romper la conducta del aviso (2), quitar la exclusión de DUPLICADO y la herencia de SPEC-366 (2).
- [x] T008 Actualizar el candado de reserva de SPEC-324 preservando su intención (5 → 6 campos, con el nuevo afirmado como CLASE de autor; las afirmaciones de identidad intactas).
- [x] T009 Gate: `tsc`, lint, unit 283/283, integración de lo tocado + `specs/README.md` + PR.

## Anotado

- **El caché semántico NO se aplicó al duplicado**, y es decisión firme del CEO: SPEC-366 ya cubre el resultado por mejor camino.
- **El candado de clase quedó radicado aparte por el CEO: SPEC-446, a Infraestructura.** Medición entregada: 63 exportaciones de `src/lib` sin llamador en producción + 111 exportadas de más. Condición que fijó el CEO a partir del error de este Dev: el barrido **cuenta llamadores en `scripts/**` (`.mjs` incluido) y en los `command` del compose**, y reproduce este falso positivo como contraprueba.
- **Anotado, no arreglado (orden del CEO):** la llamada del círculo en el worker es fire-and-forget con `.catch()` — si falla, muere en un log. Degradación silenciosa, no ausencia de cableado.
- El cierre real lo hace el CEO en producción: un anónimo sobre un identificador que un padre reportó, y el aviso llegando.
