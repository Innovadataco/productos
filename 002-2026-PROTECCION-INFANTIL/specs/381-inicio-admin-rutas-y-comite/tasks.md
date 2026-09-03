# SPEC-381 · Tasks

- [X] T001 Auditoría de las 7 rutas de `inicio-admin.ts`: 6 tienen page.tsx, 1 no
- [X] T002 [FR-002] Redirigir las 2 señales de correos → `/dashboard/admin/estadisticas/salud-motor`
- [X] T003 [FR-003] Candado `src/lib/dal/services/inicio-admin.ratchet.test.ts` con 1 test por ruta
- [X] T004 Registrar en `vitest.unit.includes.ts`
- [X] T005 Reproducir I-270 en vivo con admin: NO reproduce (2 endpoints 200, pantalla carga)
- [X] T006 Rastrear en `docker inspect` + `journalctl -u docker`: pi-app reinició 05:48:18→05:48:29 UTC
- [X] T007 [FR-004] Log defensivo en `ComiteBandeja.tsx` catches (fetchSolicitudes y fetchConsolidaciones)
- [X] T008 Gate: tsc, tests del candado, tests de ComiteBandeja existentes
- [ ] T009 [Post-merge] verificación viva: hacer clic desde el Inicio en "correos no salen" y confirmar que abre la pantalla de salud
