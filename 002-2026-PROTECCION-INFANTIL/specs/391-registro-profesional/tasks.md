# Tasks · SPEC-391 · L1b

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

- [x] T001 Análisis 15v5: leer /registro/inicio, /api/auth/registro/{solicitar,completar}, RegistroEnlaceService, apelacion-storage, email-padre; reportar hallazgos al CEO
- [x] T002 Aplicar veredicto CEO: (b) autorización en PerfilProfesional + autorizacionSubidaEn; PDF/PNG/JPG; storage protegido tipo apelacion; email primero, perfil después
- [x] T003 Migración aditiva: dos columnas `autorizacionArchivoUrl` y `autorizacionSubidaEn` en `PerfilProfesional`
- [x] T004 `autorizacion-storage.ts` (magic bytes, cifrado, guardar, leer) + test unit (6)
- [x] T005 `dto.ts` con allowlist explícita `CAMPOS_INTERNOS_PROFESIONAL` + `perfilCompletoParaRevision` + test unit (9)
- [x] T006 `perfil-schema.ts` (Zod update — todos opcionales, la regla de EN_REVISION es del dto)
- [x] T007 `email-profesional.ts` + re-export en `email.ts`
- [x] T008 `PerfilProfesionalRepository` (Q-3: cero prisma fuera del DAL)
- [x] T009 Endpoints /api/auth/registro-profesional/{solicitar,completar}
- [x] T010 Endpoints /api/profesional/{perfil,autorizacion} — transición atómica BORRADOR→EN_REVISION
- [x] T011 Chequeo estructural del archivo (no instanceof File, realms distintos undici/jsdom)
- [x] T012 3ª tarjeta «Soy profesional» ámbar en /registro/inicio
- [x] T013 Pantallas /registro-profesional{/page,/crear-clave/[token]/page} y /perfil-profesional/completar/page
- [x] T014 Actualizar placeholders `PROFESIONAL` en 3 `Record<RolUsuario,...>` a /perfil-profesional/completar
- [x] T015 Test integration end-to-end (7): anti-enumeración, cuenta creada, candado espejo, PUT BORRADOR, transición, magic bytes inválido, 403 para PARENT
- [x] T016 Registrar tests unit en vitest.unit.includes.ts
- [x] T017 Regenerar `docs/architecture/{01-modelo-datos,02-roles-capacidades,03-pantallas}.md`
- [x] T018 spec/plan/tasks + fila `specs/README.md`
- [x] T019 Gates: tsc, arch/tokens/locks/ratchets, lint, specs-discipline
- [ ] T020 Verificación en vivo del CEO: la tarjeta ámbar y el flujo hasta ver EN_REVISION
