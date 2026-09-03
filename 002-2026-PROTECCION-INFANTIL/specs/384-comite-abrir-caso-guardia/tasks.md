# Tasks · SPEC-384 · el comité no puede abrir ningún caso

**Status**: IMPLEMENTADO
**Fecha**: 2026-09-03 · **Dev**: Guardianes (PI-1)

- [x] T001 Leer instructivo 006 + candado 22v5: enumerar los 5 callsites de `reportes-revision` en `src/`
- [x] T002 Leer `permisos-modulos.ts`, la rama muerta `route.ts:51` y `ComiteBandeja.tsx:165-231` (candado 15v5)
- [x] T003 Nuevo helper `assertAnyModulo(user, claves[])` en `permisos-modulos.ts`
- [x] T004 I-278 detalle: `assertAnyModulo(["bandeja_reportes","comite_bandeja"])` en `[id]/route.ts` + 2 tests
- [x] T005 I-278 lista: mismo cambio en `route.ts` + 1 test (adenda del CEO tras revisión del scope)
- [x] T006 Candado 26: archivo dedicado con 3 tests (clasificar, confirmar, reasignar → comité 403)
- [x] T007 I-279: split de `error` en `errorLista`/`errorAccion` en `ComiteBandeja.tsx`; segundo `<ErrorState>` con `description={errorAccion}` sin `onRetry`
- [x] T008 I-279: `handleVer` limpia `errorAccion` al abrir; setea `errorAccion` con `err.message` en catch
- [x] T009 Unit test I-279: `asignar → 403` + assert que el mensaje real llega y que el texto viejo NO aparece
- [x] T010 Docs: spec/plan/tasks + fila `specs/README.md`
- [x] T011 Gates: tsc, lint, arch/tokens/locks/ratchets, specs-discipline
- [ ] T012 Verificación en vivo del CEO con la cuenta real del comité PI de Jelkin
