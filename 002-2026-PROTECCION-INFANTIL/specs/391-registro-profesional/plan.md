# Plan · SPEC-391 · L1b — el profesional se registra

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

## Decisiones

**(b) sobre (a) para la autorización.** Se agrega `autorizacionArchivoUrl` (y `autorizacionSubidaEn`, aviso CEO 08:40) al `PerfilProfesional`, no se crea una fila fake de `VerificacionProfesional` con `MAS_INFORMACION`. Motivos que el CEO reforzó: (1) la fila de verificación es el historial legal — quien revisó y qué resultado — y una fila que no fue revisión ensucia justo lo que la ley obliga a tener limpio; (2) la autorización es del profesional, no de una revisión — es su consentimiento vigente; (3) `autorizacionSubidaEn` deja comparar contra `VerificacionProfesional.revisadoEn` y demostrar por sí solo que la autorización fue PREVIA.

**Reuso máximo del padre**, no duplicación. `RegistroEnlaceService` ya está parametrizado por rol desde SPEC-344 — se pasa `rol: "PROFESIONAL"` sin tocar el servicio ni el token. El schema Zod (`registroSolicitarSchema`, `registroCompletarSchema`) se reusa tal cual: solo email y contraseña con las mismas reglas. Los correos siguen el patrón de `email-padre.ts` — archivo hermano `email-profesional.ts`.

**Storage propio, no `escudo-storage`.** La autorización lleva PII y por ley es reservada; el escudo de un colegio es casi público. Se crea `autorizacion-storage.ts` con la misma criptografía de apelaciones — importando `cifrarBuffer/sha256Hex` en vez de reimplementarlas.

**Magic bytes obligatorios.** La validación por extensión declarada es un teatro; el archivo se abre y se leen los primeros bytes para decidir. Aceptados: PDF, PNG y JPG (foto del documento con el teléfono, aviso CEO 04:32).

**DTO con allowlist explícita.** Un `select` por Prisma no basta como candado — cambia con cada refactor. Un DTO `toPerfilProfesionalPublico` con constructor manual y el test que enumera el conjunto exacto de claves rompe cualquier fuga. `CAMPOS_INTERNOS_PROFESIONAL` se exporta como el vector negativo del test para que sea fácil sumar internos futuros.

**Transición atómica de estado en el propio endpoint que la dispara.** Tanto `PUT /perfil` como `POST /autorizacion` verifican `perfilCompletoParaRevision(actualizado)` y hacen el `cambiarEstado` en el mismo request. Un worker aparte introduciría latencia y un tercer camino de bug. La regla vive en `dto.ts` y se usa desde los dos endpoints — un solo lugar donde cambia si algún día se añade un requisito.

**Repositorio DAL** para no romper Q-3. Los routes no importan `prisma` — todo va por `PerfilProfesionalRepository`. También facilita testear con transacciones en L2 si el admin necesita atomicidad.

**Multipart binario en tests con boundary manual + `latin1`.** El `FormData`/`File` de jsdom cuelga al `request.formData()` del handler (patrón documentado en `colegio/carga` y `pagos/renovacion`). Se arma el body como string con `latin1` para preservar bytes. El handler acepta el archivo con chequeo estructural (no `instanceof File`, porque undici y jsdom lo tienen en realms distintos).

**Placeholders `PROFESIONAL` actualizados**: los cinco `Record<RolUsuario, ...>` que L1a llenó con `"/"` ahora apuntan a `/perfil-profesional/completar` — la home efectiva del profesional recién creado hasta que L5 (panel del profesional) exista.

## Archivos

- `prisma/schema.prisma` — dos columnas aditivas en `PerfilProfesional`.
- `prisma/migrations/20260903050000_spec_391_autorizacion_profesional/migration.sql`.
- `src/lib/profesional/autorizacion-storage.ts` + `.test.ts`.
- `src/lib/profesional/dto.ts` + `.test.ts`.
- `src/lib/profesional/perfil-schema.ts`.
- `src/lib/email-profesional.ts` + re-export en `email.ts`.
- `src/lib/dal/repositories/perfil-profesional.ts`.
- `src/app/api/auth/registro-profesional/{solicitar,completar}/route.ts`.
- `src/app/api/profesional/{perfil,autorizacion}/route.ts` + `perfil-l1b.test.ts`.
- `src/app/registro/inicio/page.tsx` — 3ª tarjeta.
- `src/app/registro-profesional/page.tsx`.
- `src/app/registro-profesional/crear-clave/[token]/page.tsx`.
- `src/app/perfil-profesional/completar/page.tsx`.
- `src/app/consentimiento/page.tsx` · `src/lib/e2e/helpers.ts` · `src/lib/e2e/journeys/sesion-roles.test.tsx` — placeholder `PROFESIONAL` actualizado.
- `vitest.unit.includes.ts` — registro de los dos tests unit.
- `docs/architecture/{01-modelo-datos,02-roles-capacidades,03-pantallas}.md` regenerados.
