# Tareas · SPEC-422 — «Soy profesional» era un enlace muerto

- [x] T001 Verificar la causa en fuente: falta `/registro-profesional` en `publicas`, y `matcheaRuta` es prefijo por segmento (por eso `/registro` no la cubre).
- [x] T002 La línea en `GUARDIAS_ACCESO.publicas`, con el comentario de la trampa.
- [x] T003 Candado en `guardias.test.ts` que **descubre las puertas en el disco** (`src/app/registro*` con `page.tsx`) y exige que estén en `publicas` — cubre la cuarta puerta que nazca.
- [x] T004 El candado cubre también el enlace del correo `/crear-clave/<token>` de cada puerta.
- [x] T005 Siete casos en `middleware.test.ts`: las tres puertas y sus tres enlaces sin sesión → no 307; más el que fija la trampa del prefijo.
- [x] T006 Contraprueba: `esRutaPublica("/registro-inventado")` es `false`.
- [x] T007 **Prueba negativa**: quitar la línea → 4 tests caen nombrando la puerta culpable. Restaurada → 126 en verde.
- [x] T007-bis Regenerar `02-roles-capacidades.md` y `03-pantallas.md`: la línea base documentaba el defecto y al regenerarla las dos filas pasan de `redirigir→/login` a `permitir`.
- [x] T008 Gate + fila en `specs/README.md` + PR.

## Anotado

- La puerta está cerrada **dos** veces: esta abre la ruta (I-297); SPEC-419 (#323) abre el correo (I-296). Las dos tienen que estar en producción.
