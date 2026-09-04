# Tareas · SPEC-436 — Los documentos del profesional

- [x] T001 Migración: tabla `DocumentoProfesional` + rename `autorizacionArchivoUrl` → `autorizacionArchivoId` (PerfilProfesional y VerificacionProfesional).
- [x] T002 Repositorio `DocumentoProfesionalRepository` (upsert por requisito, listar por perfil, buscar uno).
- [x] T003 `POST /api/profesional/documentos` — sube/reemplaza el documento de un requisito válido del parámetro; reusa `autorizacion-storage`.
- [x] T004 `GET /api/profesional/documentos` — qué tiene cargado el dueño (para pintar la pantalla).
- [x] T005 Servir descifrado al vuelo, auditado: el dueño (`/api/profesional/documentos/[clave]`) y el Verificador/ADMIN de esa ficha (`/api/admin/verificacion-profesionales/[id]/documentos/[clave]`). `clave` = requisito o `autorizacion`.
- [x] T006 `abrirFicha` devuelve el estado de cada documento; la ficha enlaza cada uno y dice «sin documento».
- [x] T007 Guardia de servidor: no se marca CUMPLE un requisito sin documento.
- [x] T008 Pantalla del profesional: bloque de documentos derivado del parámetro.
- [x] T009 Candados: 404 reproducido, `leerAutorizacion` con llamador, permisos con contraprueba, auditoría leída en BD, CUMPLE sin documento, quinto requisito sin tocar código.
- [x] T010 Gate + fila en `specs/README.md` + PR.

## Anotado

- **Cero valores de enum nuevos** — la auditoría reusa `PROFESIONAL_AUTORIZACION_ACCESO`, huérfano desde SPEC-391. No hay que coordinar con BI.

## Hallazgo reportado aparte (no se arregla en esta spec)

`src/lib/test-utils.ts` le da a **todos los roles todos los módulos activos** en cada `resetDatabase()`
(43 × 8 = 344 filas). Consecuencia: cualquier test que afirme «a este rol lo bloquea `assertModulo`»
pasa por la razón equivocada. **Producción está bien** — `seed-modulos-grants.ts` es selectivo. Por eso
la ruta que sirve el documento exige el **rol en código además del módulo**: así el 403 se prueba de
verdad y un permiso mal configurado no abre un documento reservado. Reportado al CEO para ficha propia.
