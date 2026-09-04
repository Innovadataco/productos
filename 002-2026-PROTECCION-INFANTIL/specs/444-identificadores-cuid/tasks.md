# Tareas · SPEC-444 — Los identificadores del padre se validaban como uuid

- [x] T001 Barrido completo `z.string().uuid()` en `src/` con **veredicto por aparición** (9 encontradas) y la evidencia que lo sostiene: esquema de Prisma sin `@default(uuid())` + formato real de ids en base.
- [x] T002 Las 8 apariciones de las 4 rutas pasan a `cuidIdSchema`. La 9.ª (`materiaIdSchema`) se deja: dato heredado real de `Materia` (SPEC-173 · H02).
- [x] T003 Reproducción negativa de conducta: cuid real contra los 3 handlers del padre → no 400 **y** el service recibe el id.
- [x] T004 Contraprueba: `"abc"` → 400 **y** el service no se llama. El arreglo no afloja la validación.
- [x] T005 Candado de clase sobre todo `src/`: un `z.string().uuid()` nuevo pone rojo salvo que se declare con razón. + guarda de que la premisa del esquema siga vigente.
- [x] T006 Probar muriendo **en las dos direcciones**: volver a `uuid()` → 4 rojos; aflojar a `z.string()` → 3 rojos distintos.
- [x] T007 Gate (`tsc`, `lint`, unit de lo tocado) + `specs/README.md` regenerado + PR.

## Anotado

- El cierre real de I-310 **no es el CI verde**: es un padre pidiendo cita en producción y `SolicitudCita` dejando de tener 0 filas. Lo verifica el CEO tras el despliegue.
- La cabecera del radicado dice «Dueño: Dev 01» y el CEO asignó 444 a Dev 02 — reportado para que lo corrija y no se abra la misma rama dos veces (mismo cruce que ya pasó en SPEC-436).
