# Tareas · SPEC-441 — La tarjeta del profesional

- [x] T001 Leer en fuente y **refutar el radicado premisa por premisa**: 5 de 6 falsas o parciales. El CEO verificó y corrigió el alcance.
- [x] T002 El precio de la tarjeta pasa a ser el **estándar de la primera cita**, leído en el servidor del mismo helper que la ficha.
- [x] T003 La tarifa informativa **sale** de la tarjeta; sigue en la ficha con su desglose.
- [x] T004 La persona por delante: foto y nombre crecen, el precio pasa a una línea.
- [x] T005 Fuera el nombre técnico del título; en su lugar las especialidades con `+N` real.
- [x] T006 Ubicación con país y atribuida al profesional; sin país no se inventa; sin nombre no hay pin vacío.
- [x] T007 `pais` en el DTO público (interfaz + `select` + mapeo, los tres coordinados).
- [x] T008 Botón volver al directorio **conservando los filtros**.
- [x] T009 Candados nuevos y actualización **con intención** del assert que defendía el defecto.
- [x] T010 Gate: `tsc`, `arch:check`, `tokens:check`, unit, integración H-2, `specs/README.md`.

## Anotado

- **La calificación de familias quedó FUERA del alcance**: no viene de SPEC-429 (su migración borra la tabla con puntaje) ni de ningún otro lado hoy. Si Jelkin la quiere, es un frente nuevo.
- **Foto, grilla del directorio y el literal «Bogotá D.C.» no se tocaron**: ya estaban bien. Tocarlos habría sido trabajo perdido sobre archivos correctos.
- El sello «Nuevo en la red» se conserva tal cual: es la decisión del brief mientras no haya calificaciones.
