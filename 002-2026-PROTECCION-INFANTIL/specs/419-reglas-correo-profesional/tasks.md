# Tareas · SPEC-419 — El psicólogo puede recibir su enlace de registro

- [x] T001 Acotar el defecto en fuente: el emisor y el servicio de registro estaban bien; faltaba el catálogo del motor. El `TokenRegistro` se creaba desde siempre.
- [x] T002 `prisma/seed.ts`: plantilla + regla `PROFESIONAL`/`obligatoria` para `auth.registro_enlace_profesional` y `auth.bienvenida_profesional`, siguiendo el patrón de la puerta del padre (SPEC-339).
- [x] T003 `solicitar/route.test.ts` (3) contra BD real: con regla → fila `ENCOLADA` con el enlace dentro; **sin regla → misma 202 y cero filas** (la reproducción de I-296); el token se crea igual.
- [x] T004 `email-profesional.candado.test.ts` (9): eventos leídos del emisor, regla + plantilla por evento, rol y obligatoriedad, variables presentes, y los dos `throw` en pie.
- [x] T005 Seed corrido contra base limpia: las dos reglas quedan `rol=PROFESIONAL, obligatoria=t, activa=t`.
- [x] T006 Gate (`tsc`, `lint`, unit) + fila en `specs/README.md` + PR.

## Anotado

- El **202 no se toca** (anti-enumeración SPEC-338) y el **`throw` no se ablanda**: el arreglo era sembrar.
- La bienvenida (`completar/route.ts:71`) tenía el mismo agujero y queda cerrada por el mismo seed.
