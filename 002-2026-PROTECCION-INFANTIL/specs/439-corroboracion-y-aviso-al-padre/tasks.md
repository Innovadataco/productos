# Tareas · SPEC-439 — El aviso al padre cuando alguien más reporta lo mismo

- [x] T001 Leer en fuente antes de codificar. Resultado: **las dos partes del radicado ya estaban construidas** (SPEC-366, 324, 139). Reportado al CEO, que corrigió el radicado y fijó el alcance real.
- [x] T002 Cablear `notificarCambioCirculoSiCorresponde` en `finalizacion.ts` — construida en SPEC-135/308 y **sin un solo llamador** desde entonces.
- [x] T003 `corroboracion-padre.ts`: el aviso al padre que YA había reportado (tercera población, sin cubrir por nadie). Disparo dentro de `detectarYRegistrarMatch`, después de `eventos.crear`.
- [x] T004 Plantilla + regla sembradas idempotentes (`reporte.corroborado_por_otro`). Sin migración: el opt-out lo da `NotificacionPreferencia`.
- [x] T005 `esAnonimo` en `otrosReportesDe` / `OtroReporteDto` / la pantalla de seguimiento — el tipo de autor, nunca la identidad.
- [x] T006 13 candados: cableado (3), reserva (2), conducta del aviso (5), protección de lo preexistente (3).
- [x] T007 Probarlos muriendo en tres mutaciones distintas: quitar los cables (4 rojos), romper la conducta del aviso (2), quitar la exclusión de DUPLICADO y la herencia de SPEC-366 (2).
- [x] T008 Actualizar el candado de reserva de SPEC-324 preservando su intención (5 → 6 campos, con el nuevo afirmado como CLASE de autor; las afirmaciones de identidad intactas).
- [x] T009 Gate: `tsc`, lint, unit 283/283, integración de lo tocado + `specs/README.md` + PR.

## Anotado

- **El caché semántico NO se aplicó al duplicado**, y es decisión firme del CEO: SPEC-366 ya cubre el resultado por mejor camino.
- **Pendiente de veredicto del CEO:** si el candado de clase «función exportada de dominio sin llamador fuera de tests» va en esta spec o en radicado aparte. Barre todo `src/lib` y puede sacar más muertos de los que 439 absorbe. Dos casos en dos días (I-303 y este) dicen que es una clase, no casualidad.
- El cierre real lo hace el CEO en producción: un anónimo sobre un identificador que un padre reportó, y el aviso llegando.
